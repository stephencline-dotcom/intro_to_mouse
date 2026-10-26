const {test,expect}=require('@playwright/test');
const state={freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week5',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null};
async function setup(page){
 const attempts=new Map();let serial=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/classroom-state')return json(state);
  if(p==='/api/settings')return json({soundEnabled:false,freezeScreenFeatureEnabled:false,trainingPauseEnabled:false,mousePracticeEnabled:true});
  if(p==='/api/mouse-data/join')return json({token:'fake-token',student:{id:'fake-student',name:'Automated Student'},classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
  if(p==='/api/mouse-data/attempts/start'){
   const id=`mock-${++serial}`;attempts.set(id,{id,...req.postDataJSON(),status:'started',wrongActions:0});
   return json({tracked:true,attempt:{id,attempt_number:1}});
  }
  const m=p.match(/^\/api\/mouse-data\/attempts\/(mock-\d+)$/);
  if(m&&req.method()==='PUT'){
   const attempt=attempts.get(m[1]);if(!attempt)return route.fulfill({status:404,body:'{}'});
   Object.assign(attempt,req.postDataJSON());return json({success:true});
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
// Uses the game's real wheel listener and CSS-transformed scene, not scrollTop or DOM clicks.
async function reveal(page,viewportSelector,object){
 const viewport=page.locator(viewportSelector);
 const box=await viewport.boundingBox();if(!box)throw Error('Missing game viewport');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<42;i++){
  const p=await object.evaluate(el=>{
   const r=el.getBoundingClientRect(),v=el.closest('[id$="Viewport"]').getBoundingClientRect();
   const x=r.left+r.width/2,y=r.top+r.height/2;
   const hit=document.elementFromPoint(x,y);
   const visible=x>v.left+12&&x<v.right-12&&y>v.top+18&&y<v.bottom-18&&(hit===el||el.contains(hit));
   return {x,y,visible,direction:y<v.top+18?-1:y>v.bottom-18?1:0};
  });
  if(p.visible)return p;
  if(!p.direction)throw Error('Object is vertically in viewport but blocked; inspect layout');
  await page.mouse.wheel(0,p.direction*100);
  await page.waitForTimeout(65);
 }
 throw Error('Could not reveal object using the actual wheel input');
}
async function saved(attempts,step,status,wrong){
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status===status&&(wrong===undefined||a.wrongActions===wrong)),{timeout:12000}).toBe(true);
}
// Completion tests exercise real mouse/wheel input and mock only API persistence.
// No direct invocation of game completion or tracking APIs.
async function completeWheelRound(page, {viewport,scene,progress,desiredScroll,round,roundCount,celebration}) {
  const view = page.locator(viewport);
  const box = await view.boundingBox();

  if (!box) throw Error(`Missing viewport ${viewport}`);

  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2
  );

  const position = async () => page.locator(scene).evaluate(el => {
    const match = el.style.transform.match(/translateY\(-?([\d.]+)px\)/);
    return match ? Number(match[1]) : NaN;
  });

  // Move toward the exact required scroll position.
  for (let n = 0; n < 80; n++) {
    const p = await position();

    if (!Number.isFinite(p)) {
      throw Error('Could not read scene position');
    }

    const difference = desiredScroll - p;

    if (Math.abs(difference) <= 2) break;

    const amount = Math.min(55, Math.max(22, Math.abs(difference)));

    await page.mouse.wheel(
      0,
      Math.sign(difference) * amount
    );

    await page.waitForTimeout(35);
  }

  const finalPosition = await position();

  console.log(
    `ROUND ${round}: target=${desiredScroll}, actual=${finalPosition}`
  );

  // Ensure the game receives a final wheel event,
  // followed by enough time to recognize the stopped target.
  await page.mouse.wheel(0, 22);
  await page.mouse.wheel(0, -22);

  await page.waitForTimeout(1500);

  if (round < roundCount) {
    await expect(page.locator(progress))
      .toContainText(`${round + 1} of ${roundCount}`, {timeout:6500});
  } else {
    await expect(page.locator(celebration))
      .toBeVisible({timeout:6500});
  }
}
test('Scroll Practice: all four animals found by wheel saves completed',async({page})=>{
 const attempts=await setup(page);
 await findStep(page,'#week5ScrollPracticeViewport');
 const progress=page.locator('#week5ScrollPracticeProgress');
 const targets=[150,980,430,780];
 for(let i=0;i<targets.length;i++){
   await expect(progress).toContainText(`${i+1} of 4`);
   const scroll=Math.max(0,Math.min(900,targets[i]-170));
   await completeWheelRound(page,{viewport:'#week5ScrollPracticeViewport',scene:'#week5ScrollPracticeScene',progress:'#week5ScrollPracticeProgress',desiredScroll:scroll,round:i+1,roundCount:4,celebration:'.week5-scroll-practice-celebration'});
 }
 await saved(attempts,'week5-scroll-practice','completed',0);
});
test('Stop at the Target: all four floors reached by wheel saves completed',async({page})=>{
 const attempts=await setup(page);
 await findStep(page,'#week5StopTargetArea');
 const area=page.locator('#week5StopTargetArea');
 const box=await area.boundingBox();if(!box)throw Error('Stop Target area missing');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 const progress=page.locator('#week5StopTargetProgress');
 for(let round=1;round<=4;round++){
   await expect(progress).toContainText(`${round} of 4`);
   for(let n=0;n<70;n++){
     const coords=await page.evaluate(()=>({
       current:parseFloat(document.getElementById('week5StopTargetElevator').style.top),
       target:parseFloat(document.getElementById('week5StopTargetFloor').style.top)
     }));
     if(!Number.isFinite(coords.current)||!Number.isFinite(coords.target))throw Error('Could not read elevator/target position');
     const diff=coords.target-coords.current;
     if(Math.abs(diff)<=9)break;
     await page.mouse.wheel(0,Math.sign(diff)*Math.min(55,Math.max(25,Math.abs(diff)*3.5)));
     await page.waitForTimeout(24);
   }
   if(round<4)await expect(progress).toContainText(`${round+1} of 4`,{timeout:7000});
   else await expect(page.locator('.week5-stop-target-celebration')).toBeVisible({timeout:7000});
 }
 await saved(attempts,'week5-stop-target','completed',0);
});
test('Scroll & Drag: four correct physical drops save completed',async({page})=>{
 const attempts=await setup(page);
 await findStep(page,'#week5ScrollDragViewport');
 const progress=page.locator('#week5ScrollDragProgress');
 for(const [i,id] of ['present','book','ball','flower'].entries()){
   await expect(progress).toContainText(`${i+1} of 4`);
   const item=page.locator(`[data-scroll-drag-object="${id}"]`);
   const p=await reveal(page,'#week5ScrollDragViewport',item);
   const destination=page.locator('#week5ScrollDragDestination');
   const d=await destination.boundingBox();if(!d)throw Error('Drop destination missing');
   await page.mouse.move(p.x,p.y);
   await page.mouse.down();
   await page.mouse.move(d.x+d.width/2,d.y+d.height/2,{steps:18});
   await page.mouse.up();
   if(i<3)await expect(progress).toContainText(`${i+2} of 4`,{timeout:7000});
 }
 await expect(page.locator('.week5-scroll-drag-celebration')).toBeVisible({timeout:7000});
 await saved(attempts,'week5-scroll-drag','completed',0);
});



