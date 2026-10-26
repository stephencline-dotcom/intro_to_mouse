const {test,expect}=require('@playwright/test');

async function setup(page){
 const attempts=new Map();let serial=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/classroom-state')return json({freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week6',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null});
  if(p==='/api/settings')return json({soundEnabled:false,freezeScreenFeatureEnabled:false,trainingPauseEnabled:false,mousePracticeEnabled:true});
  if(p==='/api/mouse-data/join')return json({token:'fake-token',student:{id:'fake-student',name:'Automated Student'},classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
  if(p==='/api/mouse-data/attempts/start'){
   const id=`mock-${++serial}`;attempts.set(id,{id,...req.postDataJSON(),status:'started',wrongActions:0});
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
async function reach(page,attempts,step){
 await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
 for(let n=0;n<45;n++){
  if([...attempts.values()].some(a=>a.stepId===step))return;
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())break;
  await next.click();await page.waitForTimeout(80);
 }
 throw Error(`Could not navigate to ${step}`);
}
async function revealPart(page,id){
 const viewport=page.locator('#week6MixedViewport');
 const part=page.locator(`[data-week6-mixed-part="${id}"]`);
 await expect(part).toBeVisible({timeout:10000});
 const view=await viewport.boundingBox();if(!view)throw Error('Mixed viewport missing');
 // Wheel over the left supply column, not the robot repair bay.
 const wheelX=view.x+Math.min(100,view.width*0.12);
 const wheelY=view.y+view.height/2;
 await page.mouse.move(wheelX,wheelY);
 for(let n=0;n<95;n++){
  const info=await part.evaluate(el=>{
   const view=document.getElementById('week6MixedViewport').getBoundingClientRect();
   const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
   const hit=document.elementFromPoint(x,y);
   return {x,y,top:view.top,bottom:view.bottom,
    visible:x>view.left+8&&x<view.right-8&&y>view.top+12&&y<view.bottom-12&&(hit===el||el.contains(hit))};
  });
  if(info.visible)return info;
  await page.mouse.wheel(0,(info.y<info.top+25?-1:1)*55);
  await page.waitForTimeout(45);
 }
 throw Error('Could not expose robot part '+id);
}
async function center(locator){
 const b=await locator.boundingBox();if(!b)throw Error('Destination not visible');
 return {x:b.x+b.width/2,y:b.y+b.height/2};
}

async function scrollToObject(page, viewportSelector, objectSelector) {
  const viewport = page.locator(viewportSelector);
  const object = page.locator(objectSelector);

  const box = await viewport.boundingBox();

  if (!box) {
    throw Error('Missing viewport ' + viewportSelector);
  }

  await page.mouse.move(
    box.x + box.width * 0.8,
    box.y + box.height / 2
  );

  for (let i = 0; i < 110; i++) {
    const position = await page.evaluate(({viewportSelector,objectSelector}) => {
      const view = document.querySelector(viewportSelector);
      const item = document.querySelector(objectSelector);

      if (!view || !item) return null;

      const v = view.getBoundingClientRect();
      const r = item.getBoundingClientRect();

      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;

      const margin = 15;

      return {
        x,
        y,
        top:r.top,
        bottom:r.bottom,
        visible:
          r.left >= v.left + margin &&
          r.right <= v.right - margin &&
          r.top >= v.top + margin &&
          r.bottom <= v.bottom - margin,
        direction:
          r.top < v.top + margin ? -1 : 1
      };
    }, {viewportSelector,objectSelector});

    if (!position) {
      throw Error('Missing target or viewport');
    }

    if (position.visible) {
      console.log(
        'TARGET VISIBLE:',
        objectSelector,
        'at',
        position.x,
        position.y
      );
      return position;
    }

    await page.mouse.wheel(0,position.direction*55);
    await page.waitForTimeout(50);
  }

  throw Error('Cannot expose ' + objectSelector);
}
async function dragFromTo(page,from,to){
  const a=await center(from),b=await center(to);
  await page.mouse.move(a.x,a.y);
  await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:32});
  await page.mouse.up();
}
async function completeAnimalGame(page,game){
  const data=game==='ocean'?
    {ids:['shell','star','octopus','anchor','gem'],view:'#week6OceanViewport',actor:'#week6OceanDiver',attr:'data-week6-ocean-target',progress:'#week6OceanProgress',celebration:'.week6-ocean-celebration'}:
    {ids:['banana','key','apple','gift','nest'],view:'#week6TreeViewport',actor:'#week6TreeMonkey',attr:'data-week6-tree-target',progress:'#week6TreeProgress',celebration:'.week6-tree-celebration'};
  for(let i=0;i<data.ids.length;i++){
    await expect(page.locator(data.progress)).toContainText(`${i+1} of 5`,{timeout:12000});
    const target=`[${data.attr}="${data.ids[i]}"]`;
    await scrollToObject(page,data.view,target);
    await dragFromTo(page,page.locator(data.actor),page.locator(target));
  }
  await expect(page.locator(data.celebration)).toBeVisible({timeout:12000});
}
async function completeBasketball(page) {
  const court = page.locator('#week6BasketballCourt');
  const ball = page.locator('#week6BasketballBall');
  const rim = page.locator('#week6BasketballRim');
  const progress = page.locator('#week6BasketballProgress');

  for (let i = 0; i < 5; i++) {
    await expect(progress).toContainText(`${i+1} of 5`, {
      timeout: 12000
    });

    const b = await center(ball);
    const r = await center(rim);

    // Align the ball horizontally with the hoop.
    // Recheck the actual ball position after each drag.
    for (let correction = 0; correction < 4; correction++) {
      const currentBall = await center(ball);
      const currentRim = await center(rim);
      const difference = currentRim.x - currentBall.x;

      if (Math.abs(difference) <= 8) {
        break;
      }

      await page.mouse.move(currentBall.x, currentBall.y);
      await page.mouse.down();

      await page.mouse.move(
        currentBall.x + difference,
        currentBall.y,
        {steps:35}
      );

      await page.mouse.up();
      await page.waitForTimeout(150);
    }

    const alignedBall = await center(ball);
    const alignedRim = await center(rim);

    const horizontalError = Math.abs(
      alignedBall.x - alignedRim.x
    );

    console.log(
      'BASKETBALL HORIZONTAL ALIGNMENT',
      i+1,
      horizontalError
    );

    expect(horizontalError).toBeLessThanOrEqual(8);

    const area = await court.boundingBox();
    if (!area) throw Error('Basketball court missing');

    await page.mouse.move(
      area.x + area.width * 0.75,
      area.y + area.height * 0.6
    );

    for (let n = 0; n < 45; n++) {
      const state = await page.evaluate(() => {
        const a = document.querySelector('#week6BasketballBall')
          .getBoundingClientRect();
        const b = document.querySelector('#week6BasketballRim')
          .getBoundingClientRect();

        return {
          dx:(a.left+a.width/2)-(b.left+b.width/2),
          dy:(a.top+a.height/2)-(b.top+b.height/2)
        };
      });

      console.log('BASKETBALL ROUND',i+1,'dx',state.dx,'dy',state.dy);

      if (Math.abs(state.dy) <= 25) {
        await page.waitForTimeout(450);
        break;
      }

      const amount = Math.min(30,Math.abs(state.dy));

      await page.mouse.wheel(
        0,
        state.dy > 0 ? -amount : amount
      );

      await page.waitForTimeout(65);
    }

    if (i < 4) {
      await expect(progress).toContainText(`${i+2} of 5`, {
        timeout: 12000
      });
    }
  }

  await expect(
    page.locator('.week6-basketball-celebration')
  ).toBeVisible({timeout:12000});
}
test('Week 6 Quick Activities: all three different mini-games save completed',async({page})=>{
  const attempts=await setup(page);
  await reach(page,attempts,'week6-activities');
  const step='week6-activities';
  const open=async name=>{
    await page.locator(`[data-week6-activity-card="${name}"]`).click();
    await expect(page.locator(`[data-week6-activity-panel="${name}"]`)).toBeVisible();
  };
  const home=async()=>{
    // The completed mini-game displays a celebration overlay.
    // Force the Home click for this diagnostic browser test.
    await page.locator('[data-week6-activity-panel]:visible [data-week6-activity-home]').click({timeout:5000});
    await expect(page.locator('#week6ActivitiesHub')).toBeVisible();
  };
  await open('ocean');
  await completeAnimalGame(page,'ocean');
  await home();
  expect([...attempts.values()].some(a=>a.stepId===step&&a.status==='completed')).toBe(false);
  await open('tree');
  await completeAnimalGame(page,'tree');
  await home();
  expect([...attempts.values()].some(a=>a.stepId===step&&a.status==='completed')).toBe(false);
  await open('basketball');
  await completeBasketball(page);
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status==='completed'&&a.wrongActions===0),{timeout:15000}).toBe(true);
});








