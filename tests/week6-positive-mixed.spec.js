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

test('Week 6 Mixed Skills: all five robot missions save completed',async({page})=>{
 const attempts=await setup(page),step='week6-mixed-skills';
 await reach(page,attempts,step);
 const progress=page.locator('#week6MixedProgress');
 await expect(progress).toContainText('1 of 5');
 await page.locator('#week6MixedRobotFace').click();
 await expect(progress).toContainText('2 of 5',{timeout:12000});
 await page.locator('#week6MixedBlueButton').click();
 await expect(progress).toContainText('3 of 5',{timeout:12000});
 const stages=[['battery','#week6MixedBatterySlot'],['antenna','#week6MixedAntennaSlot'],['crystal','#week6MixedReactorSlot']];
 for(let i=0;i<stages.length;i++){
  const [partId,slotSelector]=stages[i];
  const from=await revealPart(page,partId);
  const to=await center(page.locator(slotSelector));
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:35});
  await page.mouse.up();
  if(i<stages.length-1)await expect(progress).toContainText(`${i+4} of 5`,{timeout:12000});
 }
 await expect(page.locator('.week6-mixed-celebration')).toBeVisible({timeout:12000});
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status==='completed'&&a.wrongActions===0),{timeout:15000}).toBe(true);
});

test('Week 6 Quick Activities: opening hub alone never saves completion',async({page})=>{
 const attempts=await setup(page),step='week6-activities';
 await reach(page,attempts,step);
 await expect(page.locator('#week6ActivitiesHub')).toBeVisible();
 await page.waitForTimeout(500);
 expect([...attempts.values()].some(a=>a.stepId===step&&a.status==='completed')).toBe(false);
 const next=page.locator('#studentNextButton');
 if(await next.isDisabled())await page.locator('#studentBackButton').click();
 else await next.click();
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status==='incomplete'),{timeout:12000}).toBe(true);
});
