const {test,expect}=require('@playwright/test');
const state={freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week5',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null};
async function setup(page){
 const attempts=new Map();let serial=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/classroom-state')return json(state);
  if(p==='/api/settings')return json({soundEnabled:false,freezeScreenFeatureEnabled:false,trainingPauseEnabled:false,mousePracticeEnabled:true});
  if(p==='/api/mouse-data/join')return json({token:'fake-token',student:{id:'fake-student',name:'Automated Student'},classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
  if(p==='/api/mouse-data/attempts/start'){
   const id=`mock-${++serial}`;attempts.set(id,{id,...req.postDataJSON(),status:'started',wrongActions:0});
   return json({tracked:true,attempt:{id,attempt_number:1}});
  }
  const m=p.match(/^\/api\/mouse-data\/attempts\/(mock-\d+)$/);
  if(m&&req.method()==='PUT'){
   const attempt=attempts.get(m[1]);if(!attempt)return route.fulfill({status:404,body:'{}'});
   Object.assign(attempt,req.postDataJSON());return json({success:true});
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
async function findStep(page,selector){
 await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
 for(let i=0;i<28;i++){
  if(await page.locator(selector).count())return;
  const next=page.locator('#studentNextButton');if(await next.isDisabled())break;
  await next.click();
 }
 throw new Error(`Unable to navigate to ${selector}`);
}
// Uses the game's real wheel listener and CSS-transformed scene, not scrollTop or DOM clicks.
async function reveal(page,viewportSelector,object){
 const viewport=page.locator(viewportSelector);
 const box=await viewport.boundingBox();if(!box)throw Error('Missing game viewport');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<42;i++){
  const p=await object.evaluate(el=>{
   const r=el.getBoundingClientRect(),v=el.closest('[id$="Viewport"]').getBoundingClientRect();
   const x=r.left+r.width/2,y=r.top+r.height/2;
   const hit=document.elementFromPoint(x,y);
   const visible=x>v.left+12&&x<v.right-12&&y>v.top+18&&y<v.bottom-18&&(hit===el||el.contains(hit));
   return {x,y,visible,direction:y<v.top+18?-1:y>v.bottom-18?1:0};
  });
  if(p.visible)return p;
  if(!p.direction)throw Error('Object is vertically in viewport but blocked; inspect layout');
  await page.mouse.wheel(0,p.direction*100);
  await page.waitForTimeout(65);
 }
 throw Error('Could not reveal object using the actual wheel input');
}
async function saved(attempts,step,status,wrong){
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step&&a.status===status&&(wrong===undefined||a.wrongActions===wrong)),{timeout:12000}).toBe(true);
}
test('Scroll & Click: four correct finds save completed',async({page})=>{
 const attempts=await setup(page);await findStep(page,'#week5ScrollClickViewport');
 const progress=page.locator('#week5ScrollClickProgress');
 for(const [i,id] of ['balloon','star','apple','rocket'].entries()){
  await expect(progress).toContainText(`${i+1} of 4`);
  const item=page.locator(`[data-scroll-click-object="${id}"]`);
  const p=await reveal(page,'#week5ScrollClickViewport',item);
  await page.mouse.click(p.x,p.y);
  if(i<3)await expect(progress).toContainText(`${i+2} of 4`,{timeout:5000});
 }
 await expect(page.locator('.week5-scroll-click-celebration')).toBeVisible({timeout:8000});
 await saved(attempts,'week5-scroll-click','completed',0);
});
test('Scroll & Drag: selecting the wrong object saves one mistake',async({page})=>{
 const attempts=await setup(page);await findStep(page,'#week5ScrollDragViewport');
 const item=page.locator('[data-scroll-drag-object="book"]');
 const p=await reveal(page,'#week5ScrollDragViewport',item);
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.up();
 await page.locator('#studentNextButton').click();
 await saved(attempts,'week5-scroll-drag','incomplete',1);
});
test('Scroll & Drag: releasing the correct object outside the destination saves one mistake',async({page})=>{
 const attempts=await setup(page);await findStep(page,'#week5ScrollDragViewport');
 const item=page.locator('[data-scroll-drag-object="present"]');
 const p=await reveal(page,'#week5ScrollDragViewport',item);
 const v=await page.locator('#week5ScrollDragViewport').boundingBox();
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await page.mouse.move(v.x+v.width/2,v.y+v.height/2,{steps:12});
 await page.mouse.up();
 await page.locator('#studentNextButton').click();
 await saved(attempts,'week5-scroll-drag','incomplete',1);
});
