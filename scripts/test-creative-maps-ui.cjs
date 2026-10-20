const {build}=require('esbuild');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sharp=require('sharp');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{WorldMapsPage}from'./apps/web/src/features/world-maps/WorldMapsPage';import{paintScene,emptyScene,sceneFromJSON}from'./apps/web/src/features/world-maps/creative-map';import{mapAssets}from'./apps/web/src/features/world-maps/creative-assets';window.testMap={paintScene,emptyScene,sceneFromJSON,mapAssets};createRoot(document.getElementById('root')).render(<WorldMapsPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'tmp/creative-test',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'}});
 let maps=[],generated;const bitmap=await sharp({create:{width:1600,height:1000,channels:3,background:'#777568'}}).png().toBuffer();
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1680,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),p=new URL(r.url()).pathname;
 if(p.startsWith('/uploads/'))return route.fulfill({contentType:'image/png',body:bitmap});
 if(p==='/api/campaigns')return route.fulfill({json:{data:[{id:'campaign',title:'Тестовая кампания'}]}});
 if(p==='/api/campaigns/campaign')return route.fulfill({json:{data:{locations:[]}}});
 if(p.endsWith('/uploads'))return route.fulfill({json:{data:{url:'/uploads/owner/campaign/canvas.png'}}});
 if(p.endsWith('/creative')){const input=r.postDataJSON(),old=maps.find(m=>m.id===input.id);assert.equal(input.revision,old?.revision||0);const m={...input,revision:input.revision+1,width:1600,height:1000,provider:'creative',labels:[],scale:'site',createdAt:new Date().toISOString()};maps=[m,...maps.filter(v=>v.id!==m.id)];return route.fulfill({json:{data:m}});}
 if(p.endsWith('/generate')){generated=r.postDataJSON();return route.fulfill({status:402,json:{error:{message:'Тест: генерация не запускалась'}}});}
 if(p.endsWith('/world-maps'))return route.fulfill({json:{data:maps}});
 if(p==='/api/ai/jobs')return route.fulfill({json:{data:[]}});
 if(p==='/maps')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>'});
 return route.fulfill({contentType:p.endsWith('.css')?'text/css':'application/javascript',body:bundle.outputFiles.find(f=>f.path.endsWith(p.endsWith('.css')?'.css':'.js')).text});});
 await page.goto('https://creative.local/maps?campaign=campaign');await page.getByRole('button',{name:'Креатив · рисовать карту'}).click();
 await page.getByRole('button',{name:'Полный экран',exact:true}).click();
 const canvas=page.getByLabel('Холст ручной карты');await canvas.waitFor();
 const click=async(x,y,modifiers=[])=>{const b=await canvas.boundingBox();await canvas.click({position:{x:x*b.width/1600,y:y*b.height/1000},modifiers});};
 const drag=async(x,y,dx,dy)=>{const b=await canvas.boundingBox(),s=b.width/1600;await page.mouse.move(b.x+x*s,b.y+y*s);await page.mouse.down();await page.mouse.move(b.x+(x+dx)*s,b.y+(y+dy)*s,{steps:8});await page.mouse.up();};
 const btn=name=>page.getByRole('button',{name,exact:true});
 const asset=async(name,x,y)=>{await page.getByLabel('Поиск ассетов').fill(name);await btn(name).click();await click(x,y);};
 // Raster regression: merged rooms must have no internal wall, cuts make holes.
 const geometry=await page.evaluate(()=>{const {emptyScene,paintScene}=window.testMap;const s=emptyScene();s.grid=false;s.hatching=false;s.items=[{id:'a',kind:'room',x:300,y:300,w:300,h:300,rotation:0,color:'#ffffff',layerId:'dungeon'},{id:'b',kind:'room',x:500,y:300,w:300,h:300,rotation:0,color:'#ffffff',layerId:'dungeon'}];const c=document.createElement('canvas');c.width=1600;c.height=1000;paintScene(c,s);const ctx=c.getContext('2d'),read=(x,y)=>[...ctx.getImageData(x,y,1,1).data];const interior=read(450,310),wall=read(148,310);s.items.push({id:'cut',kind:'cut',x:300,y:300,w:60,h:60,rotation:0,color:'#ffffff',layerId:'dungeon',points:[[300,250],[300,350]]});paintScene(c,s);const hole=read(300,300);s.layers.find(l=>l.id==='dungeon').visible=false;paintScene(c,s);return {interior,wall,hole,hidden:read(200,200),count:window.testMap.mapAssets.length};});
  const compatibility=await page.evaluate(()=>{const {sceneFromJSON}=window.testMap;const old={version:1,background:'#777568',grid:true,items:[{id:'old-tree',kind:'tree',x:100,y:100,w:60,h:60,rotation:0,color:'#345b38'}]};const migrated=sceneFromJSON(JSON.stringify(old));let invalidRejected=false;try{sceneFromJSON(JSON.stringify({...old,layers:{length:1}}));}catch{invalidRejected=true;}return {version:migrated.version,kind:migrated.items[0].kind,layer:migrated.items[0].layerId,invalidRejected};});assert.deepEqual(compatibility,{version:2,kind:'tree',layer:'props',invalidRejected:true});assert.deepEqual(geometry.interior,[250,247,237,255]);assert.deepEqual(geometry.wall,[53,53,47,255]);assert.deepEqual(geometry.hole,[233,228,216,255]);assert.deepEqual(geometry.hidden,geometry.hole);assert.ok(geometry.count>=50);
 const assetIDs=await page.evaluate(()=>window.testMap.mapAssets.map(a=>a.id).sort());
 const server=await fs.readFile('apps/server/internal/httpapi/world_maps_creative.go','utf8');const allowed=server.match(/var creativeAssetIDs = map\[string\]bool\{([^}]+)\}/s)[1];assert.deepEqual([...allowed.matchAll(/"([^"]+)":\s*true/g)].map(m=>m[1]).sort(),assetIDs,'frontend/backend asset catalog drift');
 await page.getByLabel('Название ручной карты').fill('Забытое святилище');
 await drag(200,200,350,300);await drag(900,200,350,300);await btn('Коридор').click();await drag(525,350,400,0);
 await btn('Круглая комната').click();await drag(550,600,350,300);await btn('Коридор').click();await drag(725,350,0,300);
 await btn('Многоугольник').click();for(const [x,y]of [[1050,650],[1300,600],[1400,800],[1150,900]])await click(x,y);await btn('Замкнуть контур').click();
 await btn('Пещера').click();await drag(300,700,180,100);await btn('Отменить').click();await btn('Повторить').click();
 await btn('Вырезать пол').click();await drag(300,225,100,0);await btn('Отменить').click();
 await asset('Стол',360,350);await btn('Выбрать').click();await drag(360,350,25,25);await page.getByLabel('Поворот',{exact:true}).fill('45');await btn('Дубликат').click();await btn('Удалить объект').click();
 await asset('Кровать',1000,300);await asset('Сундук',1175,425);await asset('Алтарь',725,750);await asset('Колонна',625,725);await asset('Колонна',825,725);await asset('Дерево',150,650);
 await btn('Подпись').click();await click(725,150);await page.getByLabel('Текст объекта').fill('ЗАБЫТОЕ СВЯТИЛИЩЕ');
 // Layer visibility and locks are real document changes; locked floors cannot be edited.
 await btn('Заблокировать слой Помещения').click();await btn('Комната').click();await drag(80,80,100,100);await page.getByRole('alert').filter({hasText:'Выбери видимый'}).waitFor();await btn('Закрыть').click();await btn('Разблокировать слой Помещения').click();
 await btn('Скрыть слой Декорации').click();await btn('Показать слой Декорации').click();
 await btn('Сохранить карту').click();await page.getByText('Ручная карта сохранена',{exact:true}).waitFor();
 const scene=JSON.parse(maps[0].creative);assert.equal(scene.version,2);assert.equal(scene.layers.length,4);assert.ok(scene.items.some(i=>i.kind==='polygon'&&i.points.length===4));assert.ok(scene.items.some(i=>i.kind==='asset'&&i.assetId==='table'&&i.rotation===45));assert.equal(scene.items.filter(i=>i.kind==='room').length,2);
 const download=async(name)=>{const promise=page.waitForEvent('download');await btn(name).click();return fs.readFile(await (await promise).path());};
 const png=await download('Скачать PNG');const meta=await sharp(png).metadata();assert.equal(meta.width,1600);assert.equal(meta.height,1000);assert.ok((await sharp(png).stats()).channels[0].stdev>15);
 const json=JSON.parse((await download('Проект JSON')).toString());assert.equal(json.scene.items.length,scene.items.length);
  // Custom uploads are actual raster inputs to the renderer; JSON import roundtrips the scene.
 await page.locator('input[type=file][accept="image/png,image/jpeg,image/webp"]').setInputFiles({name:'custom.png',mimeType:'image/png',buffer:bitmap});
 await page.getByText('Объект',{exact:true}).waitFor();await btn('Скачать PNG').isEnabled();
 const withImage=await download('Скачать PNG');const imagePixel=await sharp(withImage).extract({left:803,top:503,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...imagePixel],[119,117,104]);
 await btn('Удалить объект').click();
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.getByText('Проект открыт. Проверь карту перед сохранением.',{exact:true}).waitFor();
 await page.getByText('Экспорт и горячие клавиши',{exact:true}).click();await page.getByLabel('Разрешение PNG').selectOption('2');assert.equal((await sharp(await download('Скачать PNG')).metadata()).width,3200);await page.getByLabel('Разрешение PNG').selectOption('1');await page.getByText('Экспорт и горячие клавиши',{exact:true}).click();
 await page.getByLabel('Поиск ассетов').fill('');await btn('Выбрать').click();await click(1500,50);await page.screenshot({path:'tmp/creative-studio-desktop.png',fullPage:true});
 // Wheel zoom anchors to pointer and does not scroll the page; pan changes only camera.
 const before=await canvas.boundingBox(),vp=await page.getByLabel('Рабочая область карты').boundingBox();await page.mouse.move(vp.x+vp.width/2,vp.y+vp.height/2);await page.mouse.wheel(0,-100);await page.waitForFunction(w=>document.querySelector('canvas').getBoundingClientRect().width>w,before.width);await btn('Вписать холст').click();
 await page.reload();await canvas.waitFor();await btn('Полный экран').click();assert.equal(await page.getByLabel('Название ручной карты').inputValue(),'Забытое святилище');
 await page.getByLabel('Название ручной карты').fill('Черновик святилища');await page.waitForFunction(()=>Object.keys(sessionStorage).some(k=>k.includes('creative-draft')));page.once('dialog',d=>d.accept());await page.reload();await btn('Восстановить черновик').click();assert.equal(await page.getByLabel('Название ручной карты').inputValue(),'Черновик святилища');await btn('Сохранить карту').click();await page.getByText('Ручная карта сохранена',{exact:true}).waitFor();
 await btn('Оформить с AI').click();await page.getByLabel('Стиль',{exact:true}).selectOption('Акварель на пергаменте');await btn('Создать новый вариант').click();await page.getByText('Тест: генерация не запускалась',{exact:true}).waitFor();assert.equal(generated.sourceMapId,maps[0].id);assert.equal(generated.sourceRevision,2);assert.ok(generated.prompt.includes('Акварель'));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/creative-studio-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 assert.deepEqual(errors,[]);console.log(`Creative studio passed: ${geometry.count} assets, merged floors/cuts, polygon/cave/corridor, layers/locks, move/rotate/duplicate, undo/redo, save/reopen, PNG/JSON, draft recovery, AI source/style, 390px.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
