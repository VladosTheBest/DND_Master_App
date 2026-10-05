const {build}=require('esbuild');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
  const result=await build({entryPoints:['apps/web/src/features/ai-jobs/ai-completion-sound.ts'],bundle:true,write:false,format:'cjs',platform:'browser'});
  const storage=new Map();let notes=[];
  function tab(){
    const listeners={};
    class AudioContext{
      state='running';currentTime=0;destination={};resume(){return Promise.resolve();}
      createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
      createOscillator(){const frequency={value:0};return {frequency,connect(){},disconnect(){},start(){notes.push(frequency.value);},stop(){}};}
    }
    const context={exports:{},AudioContext,Event:class{},navigator:{locks:{request:async(_,fn)=>fn()}},window:{addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
    context.module={exports:context.exports};vm.runInNewContext(result.outputFiles[0].text,context);context.module.exports.prepareAISound();listeners.pointerdown();return context.module.exports;
  }
  const a=tab(),b=tab();
  const observe=(api,id,state)=>api.observeAIJobs([{id,state}]);
  observe(a,'historical','succeeded');assert.equal(notes.length,0);
  observe(a,'new','running');observe(b,'new','running');observe(a,'new','succeeded');observe(b,'new','succeeded');observe(a,'new','succeeded');
  assert.deepEqual(notes,[660,880]);
  a.setSoundEnabled(false);observe(a,'muted','queued');observe(a,'muted','succeeded');assert.equal(notes.length,2);
  a.setSoundEnabled(true);observe(a,'error','running');observe(a,'error','failed');assert.deepEqual(notes,[660,880,440,330]);
  a.notifyAICompletion('direct');b.notifyAICompletion('direct');assert.equal(notes.length,6);
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage();
    await page.route('https://sound.local/',route=>route.fulfill({contentType:'text/html',body:'<button>Enable audio</button>'}));
    await page.goto('https://sound.local/');
    const browserCode=await build({entryPoints:['apps/web/src/features/ai-jobs/ai-completion-sound.ts'],bundle:true,write:false,format:'iife',globalName:'AISound'});
    await page.addScriptTag({content:browserCode.outputFiles[0].text});
    await page.evaluate(()=>{window.tones=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.tones++;return original.call(this);};AISound.prepareAISound();});
    await page.getByRole('button').click();await page.evaluate(()=>AISound.observeAIJobs([{id:'background',state:'running'}]));
    const other=await browser.newPage();await other.bringToFront();
    await page.evaluate(()=>AISound.observeAIJobs([{id:'background',state:'succeeded'}]));
    await page.waitForFunction(()=>window.tones===2);
    await page.evaluate(()=>AISound.observeAIJobs([{id:'background',state:'succeeded'}]));assert.equal(await page.evaluate(()=>window.tones),2);
  }finally{await browser.close();}
  console.log('PASS: completion tones, old history silent, polling and cross-tab deduplication, mute, failure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
