const { test, expect } = require('@playwright/test');

// These checks use the actual student website and intercepted APIs.
// They never write to the real classroom or Supabase.
const state = {
  freezeScreenArmed: false, freezeCycle: 0, freezeUnlockVersion: 0,
  trainingPaused: false, currentLessonStep: 0, lessonControlMode: 'student',
  activeLesson: 'week4', reviewMovementReleased: false,
  reviewActivitiesReleased: false, fingerHighlight: null
};

async function setup(page) {
  const attempts = new Map();
  let serial = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = data => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if (pathname === '/api/classroom-state') return json(state);
    if (pathname === '/api/settings') return json({soundEnabled:false,freezeScreenFeatureEnabled:false,trainingPauseEnabled:false,mousePracticeEnabled:true});
    if (pathname === '/api/mouse-data/join') return json({token:'fake-token',student:{id:'fake-student',name:'Automated Student'},classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
    if (pathname === '/api/mouse-data/attempts/start') {
      const meta = request.postDataJSON();
      const id = `mock-${++serial}`;
      attempts.set(id,{id,...meta,status:'started',wrongActions:0,correctActions:0});
      return json({tracked:true,attempt:{id,attempt_number:1}});
    }
    const match = pathname.match(/^\/api\/mouse-data\/attempts\/(mock-\d+)$/);
    if (match && request.method() === 'PUT') {
      const record = attempts.get(match[1]);
      if (!record) return route.fulfill({status:404,body:'{"error":"Unknown attempt"}'});
      Object.assign(record,request.postDataJSON());
      return json({success:true});
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

async function findStep(page,target) {
  await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
  for (let i=0;i<25;i++) {
    if (await page.locator(target).count()) return;
    const next=page.locator('#studentNextButton');
    if (await next.isDisabled()) break;
    await next.click();
  }
  throw new Error(`Cannot navigate to ${target}`);
}

async function wrongDrop(page,selector) {
  const obj=page.locator(selector).first();
  await expect(obj).toBeVisible();
  const box=await obj.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+75,y+35,{steps:12});
  await page.mouse.up();
}

for (const item of [
  {name:'Warm-Up',target:'#week4BackpackArea',object:'.week4-backpack-object',step:'week4-warm-up'},
  {name:'Clean Up',target:'#week4CleanUpArea',object:'.week4-clean-object',step:'week4-clean-up'},
  {name:'Puzzle',target:'#week4PuzzleArea',object:'.week4-puzzle-piece',step:'week4-puzzle'},
  {name:'Drag Master Challenge',target:'#week4ChallengeArea',object:'.week4-master-object',step:'week4-challenge'}
]) {
  test(`${item.name}: incorrect drag saves one mistake and stays incomplete`,async ({page}) => {
    const attempts=await setup(page);
    await findStep(page,item.target);
    await expect.poll(()=>[...attempts.values()].some(x=>x.stepId===item.step)).toBe(true);
    await wrongDrop(page,item.object);
    await page.locator('#studentNextButton').click();
    await expect.poll(()=>[...attempts.values()].some(x=>x.stepId===item.step&&x.wrongActions===1),{timeout:10000}).toBe(true);
    const result=[...attempts.values()].find(x=>x.stepId===item.step);
    expect(result.status).toBe('incomplete');
  });
}

test('Quick Activities: entering and leaving hub without all three games is incomplete',async ({page})=>{
  const attempts=await setup(page);
  await findStep(page,'#week4ActivitiesHub');
  await expect.poll(()=>[...attempts.values()].some(x=>x.stepId==='week4-activities')).toBe(true);
  await page.locator('#studentNextButton').click();
  await expect.poll(()=>[...attempts.values()].some(x=>x.stepId==='week4-activities'&&x.status==='incomplete')).toBe(true);
  expect([...attempts.values()].find(x=>x.stepId==='week4-activities').status).toBe('incomplete');
});
