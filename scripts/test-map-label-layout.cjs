const {build}=require('esbuild');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const bundle=await build({stdin:{contents:`import {arrangeMapLabels} from './apps/web/src/features/world-maps/map-label-layout';window.arrange=arrangeMapLabels;`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1536,height:1024}});
    await page.goto('about:blank');await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result=await page.evaluate(()=>{
      const labels=Array.from({length:22},(_,i)=>({id:`label-${i}`,text:i%3===0?'ДЛИННОЕ НАЗВАНИЕ РЕГИОНА':`Поселение ${i}`,role:i%3===0?'region':'settlement',size:i%3===0?48:24,x:.25+(i%5)*.13,y:.16+Math.floor(i/5)*.16,rotation:i%3===0?55:0,curve:i%3===0?30:0,span:360,font:'serif',bold:true,italic:false,color:'#eee8ff',outline:'#211b30'}));
      labels[1].x=labels[2].x;labels[1].y=labels[2].y;
      labels[3].x=.99;labels[3].y=.04;
      const map={width:1536,height:1024,labels};const snapshot=JSON.stringify(map),result=window.arrange(map);
      return {result,unchanged:JSON.stringify(map)===snapshot,original:labels};
    });
    assert.ok(result.unchanged);assert.equal(result.result.map.labels.length,22);assert.equal(result.result.unresolved,0);
    for(let i=0;i<22;i++){const before=result.original[i],after=result.result.map.labels[i];assert.equal(after.text,before.text);assert.ok(after.size<=20);if(i!==3)assert.ok(Math.abs(after.x-before.x)<=.066);assert.ok(Math.abs(after.rotation)<=35);}
    const boxes=result.result.boxes;for(let i=0;i<boxes.length;i++){const a=boxes[i];assert.ok(a.left>=17.99&&a.top>=17.99&&a.right<=982.01&&a.bottom<=1024/1536*1000-17.99);for(const b of boxes.slice(i+1))assert.ok(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),'overlapping labels');}
    const dense=await page.evaluate(()=>window.arrange({width:1536,height:1024,labels:Array.from({length:100},(_,i)=>({id:String(i),text:'Очень длинное название поселения',role:'settlement',size:24,x:.5,y:.5,rotation:0,font:'serif',bold:true,italic:false,color:'#eee8ff',outline:'#211b30'}))}));
    assert.equal(dense.map.labels.length,100);assert.ok(dense.unresolved>0,'must report impossible density');
    console.log('PASS: measured curved/rotated Cyrillic labels, crowded anchors, frame bounds, restrained type, immutable input and dense-layout warning.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
