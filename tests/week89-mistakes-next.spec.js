const {test,expect}=require('@playwright/test');
async function setup(page){
 const attempts=new Map();let serial=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/classroom-state')return json({freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week9',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null});
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
async function physicalClick(page,locator){
 await expect(locator).toBeVisible({timeout:10000});
 const box=await locator.boundingBox();
 if(!box)throw Error('Target has no bounding box');
 const x=box.x+box.width/2,y=box.y+box.height/2;
 const hit=await page.evaluate(({x,y})=>{
  const el=document.elementFromPoint(x,y);
  return el?.outerHTML?.slice(0,250)||null;
 },{x,y});
 console.log('PHYSICAL CLICK',x,y,'hit:',hit);
 await page.mouse.click(x,y);
}
for(const {id,target} of [
 {id:'week9-treasure-map',target:'[data-week9-treasure-spot].week9-treasure-spot-active'},
 {id:'week9-silly-scene',target:'[data-week9-silly-target="sky"]'}
]){
 test(`${id}: wrong left click saves exactly one mistake`,async({page})=>{
  const attempts=await setup(page);
  await reach(page,attempts,id);
  const item=page.locator(target).first();
  await physicalClick(page,item);
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())await page.locator('#studentBackButton').click();
  else await next.click();
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='incomplete'&&a.wrongActions===1),{timeout:12000}).toBe(true);
 });
}
