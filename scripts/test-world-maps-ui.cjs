const {build}=require('esbuild');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sharp=require('sharp');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async()=>{
  const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{WorldMapsPage}from'./apps/web/src/features/world-maps/WorldMapsPage';import{AIChat}from'./apps/web/src/features/ai-jobs/AIChat';import'./apps/web/src/app.css';import'./apps/web/src/styles/workspace.css';createRoot(document.getElementById('root')).render(location.pathname==='/chat'?<AIChat campaignId="campaign" jobs={[]} refreshJobs={()=>{}}/>:<WorldMapsPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'tmp/map-test',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'},loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'}});
  // A synthetic nonuniform bitmap makes export/background checks deterministic.
  const pixels=Buffer.alloc(900*600*3);for(let y=0;y<600;y++)for(let x=0;x<900;x++){const i=(y*900+x)*3,land=x>190+Math.sin(y/50)*95&&x<680+Math.cos(y/80)*65;pixels[i]=land?75+x%30:35;pixels[i+1]=land?90+y%35:55;pixels[i+2]=land?72:85+y%25;}
  const bitmap=await sharp(pixels,{raw:{width:900,height:600,channels:3}}).png().toBuffer();
  const original={id:'map-one',title:'Северный архипелаг',prompt:'Острова и горы',imageUrl:'/uploads/map.png',width:900,height:600,revision:0,provider:'codex',createdAt:new Date().toISOString(),labels:[{id:'port',text:'Северная гавань',x:.5,y:.5,size:24,rotation:0,font:'serif',color:'#eee8ff',outline:'#211b30',bold:true,italic:false}]};
  let maps=[structuredClone(original)],posted,job=null,saves=0;
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const request=route.request(),u=new URL(request.url());
      if(u.pathname.startsWith('/uploads/'))return route.fulfill({contentType:'image/png',body:bitmap});
      if(u.pathname==='/api/campaigns')return route.fulfill({json:{data:[{id:'campaign',title:'Северная кампания'}]}});
      if(u.pathname.endsWith('/uploads'))return route.fulfill({json:{data:{url:'/uploads/reference.png',fileName:'ref.png',contentType:'image/png',size:bitmap.length}}});
      if(u.pathname.endsWith('/world-maps/generate')){posted=request.postDataJSON();assert.equal(request.headers().prefer,'respond-async');job={id:'map-job',kind:'world-map',campaignId:'campaign',state:'running',stage:'Рисую фон карты без надписей'};return route.fulfill({status:202,json:{data:job}});}
      if(u.pathname==='/api/ai/jobs/map-job')return route.fulfill({json:{data:job}});
      if(u.pathname.endsWith('/world-maps'))return route.fulfill({json:{data:maps}});
      if(u.pathname.endsWith('/world-maps/map-one')){const input=request.postDataJSON();assert.equal(input.revision,maps[0].revision);saves++;maps[0]={...maps[0],...input,revision:input.revision+1};return route.fulfill({json:{data:maps[0]}});}
      if(u.pathname.endsWith('/ai/chat'))return route.fulfill({json:{data:{turns:[],sessions:[]}}});
      if(u.pathname==='/maps'||u.pathname==='/chat')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>'});
      return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'application/javascript',body:bundle.outputFiles.find(f=>f.path.endsWith(u.pathname.endsWith('.css')?'.css':'.js')).text});
    });
    await page.goto('https://maps.local/maps?campaign=campaign');await page.getByLabel('Текст подписи').waitFor();
    const before=await page.getByRole('button',{name:'Подпись: Северная гавань',exact:true}).boundingBox();
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+60,before.y+before.height/2+40);await page.mouse.up();
    await page.getByLabel('Текст подписи').fill('Новая гавань');
    await page.getByRole('button',{name:'Курсив',exact:true}).click();
    await page.getByRole('button',{name:'Подпись',exact:true}).click();assert.equal(await page.locator('.world-map-surface text').count(),2);
    await page.getByRole('button',{name:'Удалить подпись',exact:true}).click();assert.equal(await page.locator('.world-map-surface text').count(),1);
    await page.getByRole('button',{name:'Отменить правку',exact:true}).click();assert.equal(await page.locator('.world-map-surface text').count(),2);
    await page.getByRole('button',{name:'Повторить правку',exact:true}).click();assert.equal(await page.locator('.world-map-surface text').count(),1);
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByText('Карта сохранена',{exact:true}).waitFor();assert.equal(saves,1);assert.equal(maps[0].labels[0].text,'Новая гавань');assert.ok(maps[0].labels[0].x>.55);assert.ok(maps[0].labels[0].italic);
    await page.reload();await page.getByLabel('Текст подписи').waitFor();assert.equal(await page.getByLabel('Текст подписи').inputValue(),'Новая гавань');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PNG',exact:true}).click();const download=await downloadPromise;const exported=await fs.readFile(await download.path());const meta=await sharp(exported).metadata();assert.equal(meta.width,900);assert.equal(meta.height,600);
    const exportedPixels=await sharp(exported).removeAlpha().raw().toBuffer();assert.ok(!exportedPixels.equals(pixels),'PNG omitted labels');assert.deepEqual([...exportedPixels.subarray(0,3)],[...pixels.subarray(0,3)],'PNG lost map background');
    await page.screenshot({path:'tmp/world-maps-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/world-maps-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
    await page.getByRole('button',{name:'Новая карта',exact:true}).click();await page.getByLabel('Описание карты').fill('Остров на основе референса');
    await page.locator('input[type=file]').setInputFiles({name:'ref.png',mimeType:'image/png',buffer:bitmap});await page.getByAltText('Референс карты').waitFor();
    await page.getByRole('button',{name:'Создать карту',exact:true}).click();await page.getByText('Рисую фон карты без надписей',{exact:true}).waitFor();assert.equal(posted.referenceUrl,'/uploads/reference.png');assert.ok(posted.requestId.length>=16);
    // Return to the composer after reload; the asynchronous job remains recoverable.
    await page.reload();await page.getByRole('button',{name:'Новая карта',exact:true}).click();await page.getByText('Рисую фон карты без надписей',{exact:true}).waitFor();
    const second={...original,id:'map-two',title:'Новый остров'};maps.push(second);job={...job,state:'succeeded',result:{data:second}};
    await page.getByLabel('Название карты').waitFor();assert.equal(await page.getByLabel('Название карты').inputValue(),'Новый остров');
    await page.goto('https://maps.local/chat');await page.getByRole('button',{name:'Карта мира',exact:true}).click();await page.getByLabel('Описание карты').fill('Карта из чата');await page.getByRole('button',{name:'Создать карту',exact:true}).click();await page.getByText('Рисую фон карты без надписей',{exact:true}).waitFor();job={...job,state:'succeeded',result:{data:second}};await page.getByRole('link',{name:/Новый остров/}).waitFor();assert.match(await page.getByRole('link',{name:/Новый остров/}).getAttribute('href'),/\/maps\?campaign=campaign&map=map-two/);
    assert.deepEqual(errors,[]);console.log('World maps UI passed: drag, edit, undo/redo, save/reopen, PNG pixels, 1440/390px, reference, async recovery, chat generation/link.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
