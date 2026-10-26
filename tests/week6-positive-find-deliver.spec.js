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
// Scroll the transformed scene using real wheel events until the requested
// object is visible and actually receives pointer events.
async function expose(page, viewportSelector, itemSelector) {
 const viewport=page.locator(viewportSelector), item=page.locator(itemSelector);
 await expect(item).toHaveCount(1);
 const box=await viewport.boundingBox();if(!box)throw Error('Viewport not visible');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<90;i++){
  const info=await item.evaluate(el=>{
   const v=el.closest('[id$="Viewport"]')?.getBoundingClientRect();
   const r=el.getBoundingClientRect();
   if(!v)return {missing:true};
   const x=r.left+r.width/2,y=r.top+r.height/2;
   const hit=document.elementFromPoint(x,y);
   return {x,y,top:v.top,bottom:v.bottom,left:v.left,right:v.right,
    visible:x>v.left+8&&x<v.right-8&&y>v.top+12&&y<v.bottom-12&&(hit===el||el.contains(hit))};
  });
  if(info.missing)throw Error('Object viewport missing');
  if(info.visible)return {x:info.x,y:info.y};
  const direction=info.y<info.top+25?-1:1;
  await page.mouse.wheel(0,direction*55);
  await page.waitForTimeout(50);
 }
 throw Error('Could not expose '+itemSelector+' with real wheel input');
}
async function savedCompleted(attempts,step){
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status==='completed'&&a.wrongActions===0),{timeout:15000}).toBe(true);
}
test('Week 6 Treasure Hunt: five correct treasure finds save completed',async({page})=>{
 const attempts=await setup(page),step='week6-scroll-click';await reach(page,attempts,step);
 const ids=['key','gem','map','crown','chest'];
 for(let i=0;i<ids.length;i++){
  await expect(page.locator('#week6TreasureProgress')).toContainText(`${i+1} of 5`);
  const point=await expose(page,'#week6TreasureViewport',`[data-week6-treasure="${ids[i]}"]`);
  await page.mouse.click(point.x,point.y);
  if(i<ids.length-1)await expect(page.locator('#week6TreasureProgress')).toContainText(`${i+2} of 5`,{timeout:10000});
 }
 await expect(page.locator('.week6-treasure-celebration')).toBeVisible({timeout:10000});
 await savedCompleted(attempts,step);
});
test('Week 6 Delivery: four correct physical drags save completed',async({page})=>{
 const attempts=await setup(page),step='week6-scroll-drag';await reach(page,attempts,step);
 const ids=['backpack','book','apple','ball'];
 for(let i=0;i<ids.length;i++){
  await expect(page.locator('#week6DeliveryProgress')).toContainText(`${i+1} of 4`);
  const from=await expose(page,'#week6DeliveryViewport',`[data-week6-delivery="${ids[i]}"]`);
  const destination=page.locator('#week6DeliveryDestination');
  const b=await destination.boundingBox();if(!b)throw Error('Destination not visible');
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:35});
  await page.mouse.up();
  if(i<ids.length-1)await expect(page.locator('#week6DeliveryProgress')).toContainText(`${i+2} of 4`,{timeout:10000});
 }
 await expect(page.locator('.week6-delivery-celebration')).toBeVisible({timeout:10000});
 await savedCompleted(attempts,step);
});
