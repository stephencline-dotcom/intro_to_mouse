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

async function reach(page,attempts,id){
 await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
 for(let n=0;n<45;n++){
  if([...attempts.values()].some(a=>a.stepId===id))return;
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())break;
  await next.click();await page.waitForTimeout(80);
 }
 throw Error('Could not reach '+id);
}
async function leave(page){
 const next=page.locator('#studentNextButton');
 if(await next.isDisabled())await page.locator('#studentBackButton').click();
 else await next.click();
}
const cases=[
 {id:'week9-meet-right-click',target:'#week9RightObject'},
 {id:'week9-dress-character',target:'#week9DressCharacter'},
 {id:'week9-pet-care',target:'#week9PetAnimal'},
 {id:'week9-robot-repair',target:'[data-week9-robot-part].week9-robot-part-active'}
];
for(const {id,target} of cases){
 test(`${id}: physical wrong left click saves exactly one mistake`,async({page})=>{
  const attempts=await setup(page,'week9');
  await reach(page,attempts,id);
  const item=page.locator(target).first();
  await expect(item).toBeVisible({timeout:12000});
   if (id === 'week9-robot-repair') {
     const box = await item.boundingBox();

     if (!box) {
       throw Error('Robot part has no bounding box');
     }

     const x = box.x + box.width / 2;
     const y = box.y + box.height / 2;

     console.log('ROBOT PHYSICAL CLICK', x, y);

     await page.mouse.move(x, y);
     await page.mouse.down();
     await page.mouse.up();

     console.log('ROBOT CLICK COMPLETED');
   } else {
     await item.click();
   }
  await leave(page);
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='incomplete'&&a.wrongActions===1),{timeout:12000}).toBe(true);
 });
}




