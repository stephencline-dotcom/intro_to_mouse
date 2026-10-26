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
async function leaveAndVerify(page,attempts,step){
 const next=page.locator('#studentNextButton');
 if(await next.isDisabled())await page.locator('#studentBackButton').click();
 else await next.click();
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.wrongActions===1&&a.status==='incomplete'),{timeout:12000}).toBe(true);
}
async function openRobot(page,attempts){
 const step='week6-mixed-skills';
 await reach(page,attempts,step);
 await expect(page.locator('#week6MixedViewport')).toBeVisible();
 await page.locator('#week6MixedRobotFace').click();
 await expect(page.locator('#week6MixedProgress')).toContainText('2 of 5',{timeout:10000});
 return step;
}
test('Week 6 Mixed Skills: pressing red robot button saves one mistake',async({page})=>{
 const attempts=await setup(page);
 const step=await openRobot(page,attempts);
 await page.locator('[data-week6-robot-button="red"]').click();
 await expect(page.locator('#week6MixedStatus')).toContainText('❌');
 await leaveAndVerify(page,attempts,step);
});
test('Week 6 Mixed Skills: wrong robot part saves one mistake',async({page})=>{
 const attempts=await setup(page);
 const step=await openRobot(page,attempts);
 await page.locator('#week6MixedBlueButton').click();
 await expect(page.locator('#week6MixedProgress')).toContainText('3 of 5',{timeout:10000});
 const wrong=page.locator('[data-week6-mixed-part]:not([data-week6-mixed-part="battery"]):visible').first();
 await expect(wrong).toBeVisible({timeout:10000});
 const box=await wrong.boundingBox();
 if(!box)throw Error('Wrong robot part not visible');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();await page.mouse.up();
 await expect(page.locator('#week6MixedStatus')).toContainText('❌');
 await leaveAndVerify(page,attempts,step);
});
