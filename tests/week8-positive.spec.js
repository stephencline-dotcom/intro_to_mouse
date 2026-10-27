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
 {id:'week8-fireflies',selector:'[data-week8-firefly].week8-firefly-target',count:5,done:'#week8FirefliesComplete'},
 {id:'week8-space-launch',selector:'[data-week8-launch-control].week8-launch-control-active',count:5,done:'#week8LaunchComplete'},
 {id:'week8-museum',selector:'[data-week8-museum-item].week8-museum-frame-target',count:5,done:'#week8MuseumComplete'},
 {id:'week8-special-delivery',selector:'[data-week8-delivery-package].week8-delivery-package-active',count:5,done:'#week8DeliveryComplete'},
 {id:'week8-carnival',selector:'[data-week8-carnival-game].week8-carnival-game-active',count:5,done:'#week8CarnivalComplete'},
 {id:'week8-computer-rescue',selector:'[data-week8-boss-bomb].week8-boss-bomb-active',count:5,done:'#week8BossComplete'}
];
async function exposeMuseumTarget(page,locator){
  const viewport=page.locator('#week8MuseumViewport');

  await expect(viewport).toBeVisible({timeout:12000});

  for(let attempt=0;attempt<60;attempt++){
    const info=await locator.evaluate(el=>{
      const v=document.getElementById('week8MuseumViewport');
      const r=el.getBoundingClientRect();
      const box=v.getBoundingClientRect();

      const x=r.left+r.width/2;
      const y=r.top+r.height/2;

      const hit=document.elementFromPoint(x,y);

      return {
        x,y,
        top:box.top,
        bottom:box.bottom,
        visible:
          x>box.left+10 &&
          x<box.right-10 &&
          y>box.top+25 &&
          y<box.bottom-25 &&
          (hit===el || el.contains(hit))
      };
    });

    if(info.visible){
      // Stop any smooth scrolling before measuring the target.
      await viewport.evaluate(el=>{
        el.scrollTo({
          top:el.scrollTop,
          behavior:'instant'
        });
      });

      await page.waitForTimeout(250);

      const stable=await locator.evaluate(el=>{
        const r=el.getBoundingClientRect();
        const v=document.getElementById('week8MuseumViewport').getBoundingClientRect();
        const x=r.left+r.width/2;
        const y=r.top+r.height/2;
        const hit=document.elementFromPoint(x,y);

        return {
          x,y,
          visible:
            x>v.left+10 &&
            x<v.right-10 &&
            y>v.top+25 &&
            y<v.bottom-25 &&
            (hit===el || el.contains(hit))
        };
      });

      if(stable.visible){
        console.log('MUSEUM TARGET STABLE',stable.x,stable.y);
        return;
      }
    }

    const direction=info.y<info.top+25?-1:1;

    await viewport.evaluate((el,direction)=>{
      el.scrollTop+=direction*90;
    },direction);

    await page.waitForTimeout(60);
  }

  throw Error('Museum target could not be exposed');
}
async function doubleClickPhysical(page,locator){
 await expect(locator).toBeVisible({timeout:12000});
 // The museum uses an actual scrollable gallery; expose its target first.
 // Animated targets may never become stable.
 // Use their current physical coordinates instead.
 const b=await locator.boundingBox();
 if(!b)throw Error('Target has no bounding box');
 const x=b.x+b.width/2,y=b.y+b.height/2;
 const hit=await page.evaluate(({x,y})=>{
  const e=document.elementFromPoint(x,y);
  return e?e.outerHTML.slice(0,150):'none';
 },{x,y});
 console.log('DOUBLE CLICK',x,y,'hit',hit);
 await page.mouse.move(x,y);
 await page.mouse.click(x,y,{clickCount:2,delay:75});
}
for(const {id,selector,count,done} of cases){
 test(`${id}: all five real double-click rounds save completed`,async({page})=>{
  const attempts=await setup(page,'week8');
  await reach(page,attempts,id);
  const target=page.locator(selector);
  for(let round=0;round<count;round++){
   await expect(target).toHaveCount(1,{timeout:12000});
   console.log(id,'ROUND',round+1);
   if(id==='week8-museum'){
     // MUSEUM SCROLL REPAIR
     await exposeMuseumTarget(page,target);
   }
   await doubleClickPhysical(page,target);
   if(round<count-1){
    await page.waitForTimeout(id==='week8-computer-rescue'?2200:1050);
   }
  }
  await expect(page.locator(done)).toBeVisible({timeout:15000});
  const next=page.locator('#studentNextButton');
  if(await next.isDisabled())await page.locator('#studentBackButton').click();
  else await next.click();
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===id&&a.status==='completed'),{timeout:12000}).toBe(true);
 });
}



