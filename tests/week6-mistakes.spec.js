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
// Find a real clickable incorrect object within the viewport. Wheel scrolls the game's
// transformed scene rather than changing scrollTop (the viewport uses overflow:hidden).
async function revealWrong(page,viewportSelector,itemSelector,correctId){
 const viewport=page.locator(viewportSelector);
 const box=await viewport.boundingBox();if(!box)throw Error('Game viewport missing');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let sweep=0;sweep<2;sweep++){
  for(let n=0;n<35;n++){
   const candidate=await page.evaluate(({viewportSelector,itemSelector,correctId})=>{
    const view=document.querySelector(viewportSelector)?.getBoundingClientRect();
    if(!view)return null;
    for(const el of document.querySelectorAll(itemSelector)){
     const value=el.getAttribute(itemSelector.includes('treasure')?'data-week6-treasure':'data-week6-delivery');
     if(value===correctId)continue;
     const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
     if(x<view.left+12||x>view.right-12||y<view.top+12||y>view.bottom-12)continue;
     const top=document.elementFromPoint(x,y);
     if(top===el||el.contains(top))return {x,y,value};
    }
    return null;
   },{viewportSelector,itemSelector,correctId});
   if(candidate)return candidate;
   await page.mouse.wheel(0,sweep===0?-100:100);
   await page.waitForTimeout(65);
  }
 }
 throw Error(`No incorrect ${itemSelector} could be exposed by real wheel input`);
}
async function leaveAndVerify(page,attempts,step){
 const next=page.locator('#studentNextButton');
 if(await next.isDisabled())await page.locator('#studentBackButton').click();
 else await next.click();
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.wrongActions===1&&a.status==='incomplete'),{timeout:12000}).toBe(true);
}
test('Week 6 Treasure Hunt: wrong treasure click saves one mistake',async({page})=>{
 const attempts=await setup(page),step='week6-scroll-click';await reach(page,attempts,step);
 await expect(page.locator('#week6TreasureViewport')).toBeVisible();
 const point=await revealWrong(page,'#week6TreasureViewport','[data-week6-treasure]','key');
 await page.mouse.click(point.x,point.y);
 await leaveAndVerify(page,attempts,step);
});
test('Week 6 Delivery: wrong object selection saves one mistake',async({page})=>{
 const attempts=await setup(page),step='week6-scroll-drag';await reach(page,attempts,step);
 await expect(page.locator('#week6DeliveryViewport')).toBeVisible();
 const point=await revealWrong(page,'#week6DeliveryViewport','[data-week6-delivery]','backpack');
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.up();
 await leaveAndVerify(page,attempts,step);
});
