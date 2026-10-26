const {test,expect}=require('@playwright/test');
const groups={
 week6:['week6-warm-up','week6-precision','week6-scroll-click','week6-scroll-drag','week6-mixed-skills','week6-activities'],
 week7:['week7-click-rhythm','week7-select-or-open','week7-animal-doors','week7-picture-gallery','week7-hatch-eggs']
};
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
for(const [week,ids] of Object.entries(groups)){
 for(const id of ids){
  test(`${id}: begins an attempt and leaving without success stays incomplete`,async({page})=>{
   const attempts=await setup(page,week);
   await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
   let found=false;
   for(let n=0;n<45;n++){
    if([...attempts.values()].some(a=>a.stepId===id)){found=true;break;}
    const next=page.locator('#studentNextButton');
    if(await next.isDisabled())break;
    await next.click();
    await page.waitForTimeout(80);
   }
   expect(found,`Could not reach tracked step ${id}; check lesson selection and step navigation`).toBe(true);
   const next=page.locator('#studentNextButton');
   if(await next.isDisabled()){
    // Final step: navigate backward to save the attempt.
    await page.locator('#studentBackButton').click();
   }else{
    await next.click();
   }
   await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='incomplete'),{timeout:12000}).toBe(true);
   const record=[...attempts.values()].find(a=>a.stepId===id&&a.status==='incomplete');
   expect(record.wrongActions).toBe(0);
  });
 }
}
