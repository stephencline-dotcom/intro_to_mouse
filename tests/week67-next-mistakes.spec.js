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


test('Week 7 Click Rhythm: one click then timeout saves one mistake', async ({page}) => {
  const attempts = await setup(page);
  await reach(page, attempts, 'week7-click-rhythm');
  const drum = page.locator('#week7ClickRhythmDrum');
  await expect(drum).toBeVisible();
  await drum.click();
  await expect.poll(async () => page.locator('#week7ClickRhythmStatus').innerText(), {timeout:5000}).toContain('TOO SLOW');
  await page.waitForTimeout(1100);
  const next = page.locator('#studentNextButton');
  if (await next.isDisabled()) await page.locator('#studentBackButton').click();
  else await next.click();
  await expect.poll(() => [...attempts.values()].some(a => a.stepId === 'week7-click-rhythm' && a.wrongActions === 1 && a.status === 'incomplete'), {timeout:12000}).toBe(true);
});

test('Week 7 Select or Open: wrong desktop icon saves one mistake', async ({page}) => {
  const attempts = await setup(page);
  await reach(page, attempts, 'week7-select-or-open');
  const wrong = page.locator('[data-week7-desktop-icon]:not([data-week7-desktop-icon="cat"])').first();
  await expect(wrong).toBeVisible();
  await wrong.click();
  await expect(page.locator('#week7SelectOpenStatus')).toContainText('TRY AGAIN');
  const next = page.locator('#studentNextButton');
  if (await next.isDisabled()) await page.locator('#studentBackButton').click();
  else await next.click();
  await expect.poll(() => [...attempts.values()].some(a => a.stepId === 'week7-select-or-open' && a.wrongActions === 1 && a.status === 'incomplete'), {timeout:12000}).toBe(true);
});
