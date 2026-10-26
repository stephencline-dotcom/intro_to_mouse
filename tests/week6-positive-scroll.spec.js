const {test,expect}=require('@playwright/test');
async function setup(page,week){
 const attempts=new Map();let serial=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/classroom-state')return json({freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:week,reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null});
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

async function reach(page,attempts,id,area){
 await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
 for(let n=0;n<45;n++){
  if([...attempts.values()].some(a=>a.stepId===id)){
   await expect(page.locator(area)).toBeVisible();return;
  }
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())break;
  await next.click();await page.waitForTimeout(80);
 }
 throw Error('Could not reach '+id);
}
async function moveTo(page,area,object,target,round){
 const box=await page.locator(area).boundingBox();
 if(!box)throw Error('Missing area '+area);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<90;i++){
  const actual=Number.parseFloat(await page.locator(object).evaluate(el=>el.style.top));
  const goal=target==='#week6WarmUpBottomTarget'?278:target==='#week6WarmUpTopTarget'?62:Number.parseFloat(await page.locator(target).evaluate(el=>el.style.top));
  if(!Number.isFinite(actual)||!Number.isFinite(goal))throw Error('Invalid position '+actual+' '+goal);
  const delta=goal-actual;
  if(Math.abs(delta)<=2)break;
  // Use small real wheel steps to avoid overshooting precision targets.
  await page.mouse.wheel(0,Math.sign(delta)*Math.min(40,Math.max(1,Math.abs(delta)*3)));
  await page.waitForTimeout(25);
 }
 // The game checks success only after wheel input has stopped.
 await page.waitForTimeout(1250);
 console.log('ROUND '+round, 'object=',await page.locator(object).evaluate(el=>el.style.top), 'target=',await page.locator(target).evaluate(el=>el.style.top));
}
async function verifySaved(attempts,id){
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='completed'&&a.wrongActions===0),{timeout:15000}).toBe(true);
}
test('Week 6 Warm-Up: four correct scroll stops save completed',async({page})=>{
 const attempts=await setup(page,'week6');
 await reach(page,attempts,'week6-warm-up','#week6WarmUpArea');
 const progress=page.locator('#week6WarmUpProgress');
 for(let i=1;i<=4;i++){
  await expect(progress).toContainText(`${i} of 4`);
  await moveTo(page,'#week6WarmUpArea','#week6WarmUpBall',i%2?'#week6WarmUpBottomTarget':'#week6WarmUpTopTarget',i);
  if(i<4)await expect(progress).toContainText(`${i+1} of 4`,{timeout:10000});
 }
 await expect(page.locator('.week6-warm-up-celebration')).toBeVisible({timeout:10000});
 await verifySaved(attempts,'week6-warm-up');
});
test('Week 6 Precision: four rocket landings save completed',async({page})=>{
 const attempts=await setup(page,'week6');
 await reach(page,attempts,'week6-precision','#week6PrecisionArea');
 const progress=page.locator('#week6PrecisionProgress');
 for(let i=1;i<=4;i++){
  await expect(progress).toContainText(`${i} of 4`);
  await moveTo(page,'#week6PrecisionArea','#week6PrecisionRocket','#week6PrecisionTarget',i);
  if(i<4)await expect(progress).toContainText(`${i+1} of 4`,{timeout:10000});
 }
 await expect(page.locator('.week6-precision-celebration')).toBeVisible({timeout:10000});
 await verifySaved(attempts,'week6-precision');
});
