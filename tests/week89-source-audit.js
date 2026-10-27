const fs=require('fs');
const source=fs.readFileSync('public/js/shared/student-lesson-controller.js','utf8');
const ids=JSON.parse(fs.readFileSync(__dirname+'/week89-tracking-manifest.json','utf8'));
let count=0;
for(const id of ids){
 if(!source.includes('HandsOnMouseData?.complete?.(); // tracking-'+id)) throw Error('Missing completion hook: '+id);
 if(!source.includes('HandsOnMouseData?.wrongEach?.(); // tracking-'+id)) throw Error('Missing mistake hook: '+id);
 console.log('PASS tracking hooks',id);count+=2;
}
console.log('PASS',count,'static hook checks. Browser verification is still required.');
