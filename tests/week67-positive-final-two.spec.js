const {test,expect}=require('@playwright/test');

async function setup(page){
  const attempts=new Map();let serial=0;
  await page.route('**/api/**',async route=>{
    const req=route.request(),p=new URL(req.url()).pathname;
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(p==='/api/classroom-state')return json({freezeScreenArmed:false,freezeCycle:0,freezeUnlockVersion:0,trainingPaused:false,currentLessonStep:0,lessonControlMode:'student',activeLesson:'week7',reviewMovementReleased:false,reviewActivitiesReleased:false,fingerHighlight:null});
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
  for(let i=0;i<45;i++){
    if([...attempts.values()].some(a=>a.stepId===step))return;
    const next=page.locator('#studentNextButton');
    if(await next.isDisabled())break;
    await next.click();
    await page.waitForTimeout(80);
  }
  throw Error(`Could not navigate to ${step}`);
}



// Complete five genuine two-click rounds. The game receives actual mouse events.
async function doubleClickSamePoint(page, locator) {
  await expect(locator).toBeVisible({timeout:10000});
  const b=await locator.boundingBox();
  if(!b)throw Error('Target has no bounding box');
  const x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);
  await page.mouse.click(x,y);
  await page.waitForTimeout(65);
  await page.mouse.click(x,y);
}

test('Week 7 Click Rhythm: five correct double-click pairs save completed',async({page})=>{
 const attempts=await setup(page);
 await reach(page,attempts,'week7-click-rhythm');
 const drum=page.locator('#week7ClickRhythmDrum');
 const screen=page.locator('#week7ClickRhythmScreen');
 for(let round=1;round<=5;round++){
   await doubleClickSamePoint(page,drum);
   await expect(page.locator('.week7-rhythm-star-complete')).toHaveCount(round,{timeout:10000});
   if(round<5)await expect(page.locator('#week7ClickRhythmStatus')).toHaveText('YOUR TURN!',{timeout:10000});
 }
 await expect(screen).toHaveClass(/week7-rhythm-complete/,{timeout:12000});
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId==='week7-click-rhythm'&&a.status==='completed'&&a.wrongActions===0),{timeout:12000}).toBe(true);
});

test('Week 7 Select or Open: three single selections and three double-click opens save completed',async({page})=>{
 const attempts=await setup(page);
 await reach(page,attempts,'week7-select-or-open');
 const rounds=[['cat','select'],['games','open'],['rocket','select'],['animals','open'],['music','select'],['art','open']];
 const progress=page.locator('#week7SelectOpenProgress');
 for(let i=0;i<rounds.length;i++){
   const [id,action]=rounds[i];
   if(i>0)await expect(progress).toContainText(`${i+1} of 6`,{timeout:12000});
   const icon=page.locator(`[data-week7-desktop-icon="${id}"]`);
   if(action==='select'){
     await icon.click();
   }else{
     await doubleClickSamePoint(page,icon);
   }
   if(i<rounds.length-1){
     await expect(page.locator('#week7SelectOpenStatus')).toHaveText('YOUR TURN!',{timeout:12000});
   }
 }
 await expect(page.locator('#week7SelectOpenCompletion')).toBeVisible({timeout:12000});
 await expect.poll(()=>[...attempts.values()].some(a=>a.stepId==='week7-select-or-open'&&a.status==='completed'&&a.wrongActions===0),{timeout:12000}).toBe(true);
});
