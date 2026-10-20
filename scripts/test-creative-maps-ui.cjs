const {build}=require('esbuild');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sharp=require('sharp');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{WorldMapsPage}from'./apps/web/src/features/world-maps/WorldMapsPage';createRoot(document.getElementById('root')).render(<WorldMapsPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'tmp/creative-test',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'}});
 let maps=[],generated;const bitmap=await sharp({create:{width:1600,height:1000,channels:3,background:'#777568'}}).png().toBuffer();
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),p=new URL(r.url()).pathname;
 if(p.startsWith('/uploads/'))return route.fulfill({contentType:'image/png',body:bitmap});
 if(p==='/api/campaigns')return route.fulfill({json:{data:[{id:'campaign',title:'Тестовая кампания'}]}});
 if(p==='/api/campaigns/campaign')return route.fulfill({json:{data:{locations:[]}}});
 if(p.endsWith('/uploads'))return route.fulfill({json:{data:{url:'/uploads/canvas.png'}}});
 if(p.endsWith('/creative')){const input=r.postDataJSON(),old=maps.find(m=>m.id===input.id);assert.equal(input.revision,old?.revision||0);const m={...input,revision:input.revision+1,width:1600,height:1000,provider:'creative',labels:[],scale:'site',createdAt:new Date().toISOString()};maps=[m];return route.fulfill({json:{data:m}});}
 if(p.endsWith('/generate')){generated=r.postDataJSON();return route.fulfill({status:402,json:{error:{message:'Тест: генерация не запускалась'}}});}
 if(p.endsWith('/world-maps'))return route.fulfill({json:{data:maps}});
 if(p==='/api/ai/jobs')return route.fulfill({json:{data:[]}});
 if(p==='/maps')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>'});
 return route.fulfill({contentType:p.endsWith('.css')?'text/css':'application/javascript',body:bundle.outputFiles.find(f=>f.path.endsWith(p.endsWith('.css')?'.css':'.js')).text});});
 await page.goto('https://creative.local/maps?campaign=campaign');await page.getByRole('button',{name:'Креатив · рисовать карту'}).click();
 const canvas=page.getByLabel('Холст ручной карты');const box=await canvas.boundingBox();
 const drag=async(x,y,dx,dy)=>{await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.move(box.x+x+dx,box.y+y+dy,{steps:10});await page.mouse.up();};
 await drag(60,60,230,180);
 await page.getByRole('button',{name:'Дерево',exact:true}).click();await canvas.click({position:{x:350,y:160}});
 await page.getByRole('button',{name:'Стол',exact:true}).click();await canvas.click({position:{x:170,y:150}});
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.getByRole('button',{name:'Повторить',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать',exact:true}).click();await drag(170,150,30,20);await page.getByLabel('Поворот',{exact:true}).fill('45');
  await page.getByRole('button',{name:'Стена',exact:true}).click();await drag(70,280,250,0);
 await page.getByRole('button',{name:'Ластик',exact:true}).click();await canvas.click({position:{x:190,y:280}});
 await page.getByRole('button',{name:'Кисть',exact:true}).click();await drag(60,320,100,40);await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.getByRole('button',{name:'Сохранить карту',exact:true}).click();await page.getByText('Ручная карта сохранена',{exact:true}).waitFor();
 assert.equal(maps.length,1);const scene=JSON.parse(maps[0].creative);assert.equal(scene.items.length,3,JSON.stringify(scene.items));assert.equal(scene.items[2].rotation,45);assert.ok(scene.items[0].w>300);
 const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PNG'}).click();const dl=await promise;const png=await fs.readFile(await dl.path());const meta=await sharp(png).metadata();assert.equal(meta.width,1600);assert.equal(meta.height,1000);const stats=await sharp(png).stats();assert.ok(stats.channels[0].stdev>5,'blank export');
 await page.reload();await canvas.waitFor();await page.getByRole('button',{name:'Оформить с AI'}).click();await page.getByLabel('Стиль',{exact:true}).selectOption('Акварель на пергаменте');await page.getByRole('button',{name:'Создать новый вариант'}).click();await page.getByText('Тест: генерация не запускалась',{exact:true}).waitFor();assert.equal(generated.sourceMapId,maps[0].id);assert.equal(generated.sourceRevision,1);assert.ok(generated.prompt.includes('Акварель'));
 await page.screenshot({path:'tmp/creative-map-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/creative-map-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 assert.deepEqual(errors,[]);console.log('Creative UI passed: drawing, decoration, move/rotation, undo/redo, save/reopen, PNG, AI source/style, mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
