const {test,expect}=require('@playwright/test');
const state={freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week5',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null};
async function setup(page){
 const attempts=new Map();let next=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const json=x=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p==='/api/classroom-state')return json(state);
  if(p==='/api/settings')return json({soundEnabled:false,freezeScreenFeatureEnabled:false,trainingPauseEnabled:false,mousePracticeEnabled:true});
  if(p==='/api/mouse-data/join')return json({token:'fake-token',student:{id:'fake-student',name:'Automated Student'},classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
  if(p==='/api/mouse-data/attempts/start'){
   const meta=req.postDataJSON(),id=`mock-${++next}`;
   attempts.set(id,{id,...meta,status:'started',wrongActions:0,correctActions:0});
   return json({tracked:true,attempt:{id,attempt_number:1}});
  }
  const m=p.match(/^\/api\/mouse-data\/attempts\/(mock-\d+)$/);
  if(m&&req.method()==='PUT'){
   const a=attempts.get(m[1]);if(!a)return route.fulfill({status:404,body:'{}'});
   Object.assign(a,req.postDataJSON());return json({success:true});
  }
  return json({});
 });
 await page.goto('/?student-signin=1');
 await expect(page.locator('#mouseStudentSignIn')).toBeVisible({timeout:15000});
 await page.locator('[name="classCode"]').fill('TEST01');
 await page.locator('[name="studentName"]').fill('Automated Student');
 await page.locator('#mouseStudentSignIn button[type="submit"]').click();
 await expect(page.locator('#mouseStudentSignIn')).toHaveCount(0);
 return attempts;
}
async function findStep(page,selector){
 await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
 for(let i=0;i<28;i++){
  if(await page.locator(selector).count())return;
  const next=page.locator('#studentNextButton');if(await next.isDisabled())break;
  await next.click();
 }
 throw new Error(`Unable to navigate to ${selector}`);
}
for(const [name,selector,step] of [
 ['Scroll Practice','#week5ScrollPracticeViewport','week5-scroll-practice'],
 ['Stop at the Target','#week5StopTargetArea','week5-stop-target'],
 ['Scroll & Click','#week5ScrollClickViewport','week5-scroll-click'],
 ['Scroll & Drag','#week5ScrollDragViewport','week5-scroll-drag']
]){
 test(`${name}: student step starts and ordinary wheel does not count as wrong`,async({page})=>{
  const attempts=await setup(page);await findStep(page,selector);
  await expect.poll(()=>[...attempts.values()].some(x=>x.stepId===step),{timeout:10000}).toBe(true);
  const area=page.locator(selector);await expect(area).toBeVisible();
  await area.hover();await page.mouse.wheel(0,65);await page.mouse.wheel(0,-65);
  await page.locator('#studentNextButton').click();
  await expect.poll(()=>[...attempts.values()].some(x=>x.stepId===step&&x.status==='incomplete'),{timeout:10000}).toBe(true);
  const saved=[...attempts.values()].find(x=>x.stepId===step);
  expect(saved.wrongActions).toBe(0);
 });
}
// Additional behavior checks intentionally use physical mouse input, not direct tracker calls.
test('Scroll & Click: incorrect object click is saved as one mistake',async({page})=>{
  const attempts=await setup(page);
  await findStep(page,'#week5ScrollClickViewport');

  const viewport=page.locator('#week5ScrollClickViewport');
  const objects=page.locator('[data-scroll-click-object]');
  const target=page.locator('#week5ScrollClickTarget');

  const desired=(await target.innerText()).toUpperCase();

  let wrong=null;

  for(let i=0;i<await objects.count();i++){
    const item=objects.nth(i);
    const name=(await item.getAttribute('data-scroll-click-object')||'').toUpperCase();

    if(!desired.includes(name)){
      wrong=item;
      break;
    }
  }

  expect(wrong).not.toBeNull();

  const box=await viewport.boundingBox();

  if(!box){
    throw new Error('Scroll viewport is missing.');
  }

  await page.mouse.move(
    box.x+box.width/2,
    box.y+box.height/2
  );

  let clicked=false;

  for(let attempt=0;attempt<60;attempt++){
    const position=await wrong.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      const view=document.getElementById('week5ScrollClickViewport')
        .getBoundingClientRect();

      const x=rect.left+rect.width/2;
      const y=rect.top+rect.height/2;

      const top=document.elementFromPoint(x,y);

      return {
        x,y,
        visible:
          x>view.left+10 &&
          x<view.right-10 &&
          y>view.top+15 &&
          y<view.bottom-15 &&
          (top===el || el.contains(top))
      };
    });

    if(position.visible){
      await page.mouse.click(position.x,position.y);
      clicked=true;
      break;
    }

    // Move toward the selected object, not always downward.
    const direction = await wrong.evaluate(el => {
      const objectRect = el.getBoundingClientRect();
      const viewRect = document
        .getElementById('week5ScrollClickViewport')
        .getBoundingClientRect();

      const objectY = objectRect.top + objectRect.height / 2;

      if (objectY < viewRect.top + 20) return -1;
      if (objectY > viewRect.bottom - 20) return 1;

      return 0;
    });

    if (direction === 0) {
      throw new Error(
        'Object is vertically visible but another element blocks it.'
      );
    }

    await page.mouse.wheel(0, direction * 100);
    await page.waitForTimeout(100);
  }

  expect(clicked,'Could not expose wrong object using mouse wheel').toBe(true);

  await page.locator('#studentNextButton').click();

  await expect.poll(
    ()=>[...attempts.values()].some(
      x=>x.stepId==='week5-scroll-click'&&x.wrongActions===1
    ),
    {timeout:10000}
  ).toBe(true);
});







