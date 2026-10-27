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
async function clickVisible(page,locator){
 await expect(locator).toBeVisible({timeout:12000});
 await locator.scrollIntoViewIfNeeded({timeout:5000}).catch(()=>{});
 const b=await locator.boundingBox();
 if(!b)throw Error('No bounding box for '+locator);
 const x=b.x+b.width/2,y=b.y+b.height/2;
 const hit=await page.evaluate(({x,y})=>{
  const e=document.elementFromPoint(x,y);
  return e?e.outerHTML.slice(0,200):'none';
 },{x,y});
 console.log('PHYSICAL CLICK',x,y,'hit:',hit);
 await page.mouse.click(x,y);
}
const cases=[
 {id:'week8-fireflies',selector:'[data-week8-firefly]:not(.week8-firefly-target)'},
 {id:'week8-space-launch',selector:'[data-week8-launch-control]:not(.week8-launch-control-active)'},
 {id:'week8-museum',selector:'[data-week8-museum-item]:not(.week8-museum-frame-target)'},
 {id:'week8-special-delivery',selector:'[data-week8-delivery-package]:not(.week8-delivery-package-active)'},
 {id:'week8-carnival',selector:'[data-week8-carnival-game]:not(.week8-carnival-game-active)'},
 {id:'week8-computer-rescue',selector:'[data-week8-boss-bomb]:not(.week8-boss-bomb-active)'}
];
for(const {id,selector} of cases){
 test(`${id}: one incorrect physical click saves one mistake`,async({page})=>{
  const attempts=await setup(page,'week8');
  await reach(page,attempts,id);
  if(id==='week8-computer-rescue'){
   await expect(page.locator('.week8-boss-bomb-active')).toBeVisible({timeout:10000});
  }
  const target=page.locator(selector).first();
  await clickVisible(page,target);
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())await page.locator('#studentBackButton').click();
  else await next.click();
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='incomplete'&&a.wrongActions===1),{timeout:12000}).toBe(true);
 });
}
