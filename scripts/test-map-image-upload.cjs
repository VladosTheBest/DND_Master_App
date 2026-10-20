const {build}=require('esbuild');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const bundle=await build({stdin:{contents:"import{prepareMapImage}from'./apps/web/src/features/world-maps/map-image-upload';import{creativePNG,emptyScene}from'./apps/web/src/features/world-maps/creative-map';window.testImages={prepareMapImage,creativePNG,emptyScene};",resolveDir:process.cwd()},bundle:true,write:false});
 const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();await page.goto('about:blank');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const png=await sharp({create:{width:60,height:40,channels:4,background:'#778855'}}).png().toBuffer(),avif=await sharp(png).avif().toBuffer();
 const result=await page.evaluate(async({png,avif})=>{const {prepareMapImage,creativePNG,emptyScene}=window.testImages;
  const original=new File([new Uint8Array(png)],'map.png',{type:'image/png'});const same=await prepareMapImage(original);
  const converted=await prepareMapImage(new File([new Uint8Array(avif)],'map.avif',{type:'image/avif'})),bitmap=await createImageBitmap(converted);const dimensions=[bitmap.width,bitmap.height];bitmap.close();
  let tooLarge=false;const oversized=new File([],'huge.png',{type:'image/png'});Object.defineProperty(oversized,'size',{value:100*1024*1024+1});try{await prepareMapImage(oversized);}catch(e){tooLarge=e.message.includes('100 МБ');}
  let invalid=false;try{await prepareMapImage(new File(['garbage'],'fake.png',{type:'image/png'}));}catch{invalid=true;}
  const output=await creativePNG({...emptyScene(),width:3200,height:1800,grid:false},2),large=await createImageBitmap(output);const exportSize=[large.width,large.height];large.close();return {same:same===original,converted:converted.type,dimensions,tooLarge,invalid,exportSize};
 },{png:[...png],avif:[...avif]});
 assert.deepEqual(result,{same:true,converted:'image/png',dimensions:[60,40],tooLarge:true,invalid:true,exportSize:[6400,3600]});console.log('Map upload passed: AVIF conversion, PNG, byte limit, invalid content, 23 MP export');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
