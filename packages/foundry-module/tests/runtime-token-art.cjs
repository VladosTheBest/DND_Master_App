const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const module=await fs.readFile('packages/foundry-module/scripts/token-art.mjs'),portrait=await fs.readFile(process.env.TOKEN_TEST_PORTRAIT);
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/module.mjs'?'text/javascript':req.url==='/portrait.png'?'image/png':'text/html');res.end(req.url==='/module.mjs'?module:req.url==='/portrait.png'?portrait:'<body style="background:#888"></body>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:600,height:600}});await page.goto(`http://127.0.0.1:${server.address().port}`);
 const result=await page.evaluate(async()=>{
  const {roundTokenAsset}=await import('/module.mjs');let uploads=0,blob;
  globalThis.foundry={applications:{apps:{FilePicker:{implementation:{createDirectory:async()=>{},upload:async(_s,_p,file)=>{uploads++;blob=file;return {path:'round.png'}}}}}}};
  const state={campaignId:'test'};await roundTokenAsset(state,'/portrait.png');await roundTokenAsset(state,'/portrait.png');
  const img=new Image();img.src=URL.createObjectURL(blob);await img.decode();document.body.append(img);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
  return {uploads,width:img.naturalWidth,height:img.naturalHeight,corner:ctx.getImageData(0,0,1,1).data[3],center:ctx.getImageData(256,256,1,1).data[3]};
 });assert.deepEqual(result,{uploads:1,width:512,height:512,corner:0,center:255});await page.screenshot({path:'tmp/round-token-preview.png'});console.log('Browser PNG rendering, transparent corners, opaque center and cached upload: PASS');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
