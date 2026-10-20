const {build}=require('esbuild');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sharp=require('sharp');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{WorldMapsPage}from'./apps/web/src/features/world-maps/WorldMapsPage';import{prepareSceneImages,paintScene,emptyScene,sceneFromJSON}from'./apps/web/src/features/world-maps/creative-map';import{mapAssets}from'./apps/web/src/features/world-maps/creative-assets';window.testMap={prepareSceneImages,paintScene,emptyScene,sceneFromJSON,mapAssets};createRoot(document.getElementById('root')).render(<WorldMapsPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'tmp/creative-test',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'}});
 let maps=[],generated;const bitmap=await sharp({create:{width:1600,height:1000,channels:3,background:'#777568'}}).png().toBuffer();
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1680,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),p=new URL(r.url()).pathname;
 if(p.startsWith('/map-assets/'))return route.fulfill({contentType:'image/webp',body:await fs.readFile('apps/web/public'+p)});
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
 await page.getByRole('button',{name:'Полный экран',exact:true}).click();assert.equal(await page.getByLabel('Набор ассетов').inputValue(),'painted');await page.getByLabel('Набор ассетов').selectOption('all');
 const canvas=page.getByLabel('Холст ручной карты');await canvas.waitFor();
 const click=async(x,y,modifiers=[])=>{const b=await canvas.boundingBox();await canvas.click({position:{x:x*b.width/1600,y:y*b.height/1000},modifiers});};
 const drag=async(x,y,dx,dy)=>{const b=await canvas.boundingBox(),s=b.width/1600;await page.mouse.move(b.x+x*s,b.y+y*s);await page.mouse.down();await page.mouse.move(b.x+(x+dx)*s,b.y+(y+dy)*s,{steps:8});await page.mouse.up();};
 const btn=name=>page.getByRole('button',{name,exact:true});
 const asset=async(name,x,y)=>{await page.getByLabel('Поиск ассетов').fill(name);await btn(name).click();await click(x,y);};
 // Raster regression: merged rooms must have no internal wall, cuts make holes.
 const geometry=await page.evaluate(()=>{const {emptyScene,paintScene}=window.testMap;const s=emptyScene();s.grid=false;s.hatching=false;s.items=[{id:'a',kind:'room',x:300,y:300,w:300,h:300,rotation:0,color:'#ffffff',layerId:'dungeon'},{id:'b',kind:'room',x:500,y:300,w:300,h:300,rotation:0,color:'#ffffff',layerId:'dungeon'}];const c=document.createElement('canvas');c.width=1600;c.height=1000;paintScene(c,s);const ctx=c.getContext('2d'),read=(x,y)=>[...ctx.getImageData(x,y,1,1).data];const interior=read(450,310),wall=read(148,310);s.items.push({id:'cut',kind:'cut',x:300,y:300,w:60,h:60,rotation:0,color:'#ffffff',layerId:'dungeon',points:[[300,250],[300,350]]});paintScene(c,s);const hole=read(300,300);s.layers.find(l=>l.id==='dungeon').visible=false;paintScene(c,s);return {interior,wall,hole,hidden:read(200,200),count:window.testMap.mapAssets.length};});
  const compatibility=await page.evaluate(()=>{const {sceneFromJSON}=window.testMap;const old={version:1,background:'#777568',grid:true,items:[{id:'old-tree',kind:'tree',x:100,y:100,w:60,h:60,rotation:0,color:'#345b38'}]};const migrated=sceneFromJSON(JSON.stringify(old));let invalidRejected=false;try{sceneFromJSON(JSON.stringify({...old,layers:{length:1}}));}catch{invalidRejected=true;}return {version:migrated.version,kind:migrated.items[0].kind,layer:migrated.items[0].layerId,invalidRejected};});assert.deepEqual(compatibility,{version:2,kind:'tree',layer:'props',invalidRejected:true});assert.deepEqual(geometry.interior,[250,247,237,255]);assert.deepEqual(geometry.wall,[53,53,47,255]);assert.deepEqual(geometry.hole,[233,228,216,255]);assert.deepEqual(geometry.hidden,geometry.hole);assert.ok(geometry.count>=50);
 const raster=await page.evaluate(async()=>{const {emptyScene,prepareSceneImages,paintScene}=window.testMap;const s=emptyScene();s.grid=false;s.background='#ff00ff';s.items=[{id:'raster',kind:'asset',assetId:'tree',x:500,y:500,w:400,h:400,color:'#ffffff',rotation:0,layerId:'props'}];await prepareSceneImages(s);const c=document.createElement('canvas');c.width=1600;c.height=1000;paintScene(c,s);const ctx=c.getContext('2d');return {center:[...ctx.getImageData(500,500,1,1).data],corner:[...ctx.getImageData(301,301,1,1).data]};});assert.notDeepEqual(raster.center,[255,0,255,255]);assert.deepEqual(raster.corner,[255,0,255,255]);
 // A failed asset request must block export preparation, then be retryable.
 await page.route('**/map-assets/painted-v1/lantern.webp',route=>route.abort());
 const loadLamp=()=>page.evaluate(async()=>{const s=window.testMap.emptyScene();s.items=[{id:'lamp-test',kind:'asset',assetId:'lantern',x:100,y:100,w:40,h:40,color:'#fff',rotation:0,layerId:'props'}];try{await window.testMap.prepareSceneImages(s);return true;}catch{return false;}});
 assert.equal(await loadLamp(),false);await page.unroute('**/map-assets/painted-v1/lantern.webp');assert.equal(await loadLamp(),true);
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

 // Outdoor modes preserve objects; new terrain, road and river tools persist and undo.
 await btn('Полный экран').click();
 const countBefore=JSON.parse(maps[0].creative).items.length;
 for(const mode of ['Город','Деревня','Открытая местность']){await btn(mode).click();assert.equal(await btn(mode).getAttribute('aria-pressed'),'true');}
 await btn('Грунт').click();await page.getByLabel('Материал кисти').selectOption('sand');await drag(100,100,250,100);
 await btn('Дорога').click();await page.getByLabel('Материал кисти').selectOption('earth');await drag(300,150,400,250);
 await btn('Река').click();await drag(1250,50,120,850);
 await page.getByLabel('Категория ассетов').selectOption('Здания');await asset('Коттедж',600,600);
 await page.getByLabel('Категория ассетов').selectOption('Растительность');await asset('Дуб раскидистый · зрелое',250,600);
 await page.getByLabel('Рассыпать кистью').check();await drag(200,800,650,0);await page.getByLabel('Рассыпать кистью').uncheck();
 const outdoorJSON=JSON.parse((await download('Проект JSON')).toString()).scene;
 assert.equal(outdoorJSON.mapType,'wilderness');assert.equal(outdoorJSON.surface,'grass');assert.ok(outdoorJSON.items.length>countBefore+8);
 for(const kind of ['terrain','road','river'])assert.ok(outdoorJSON.items.some(i=>i.kind===kind&&i.layerId==='terrain'&&i.points.length>2));
 await btn('Сохранить карту').click();await page.getByText('Ручная карта сохранена',{exact:true}).waitFor();assert.deepEqual(JSON.parse(maps[0].creative),outdoorJSON);
 // A representative city composition exercises detailed roofs, ground and water at 1x and true 3x.
 const town=await page.evaluate(()=>{const s=window.testMap.emptyScene();s.mapType='city';s.surface='grass';s.grid=false;s.hatching=false;let n=0;
 const add=(kind,x,y,w,h,extra={})=>s.items.push({id:'town-'+(++n),kind,x,y,w,h,rotation:0,color:'#ffffff',layerId:kind==='asset'?'props':'terrain',...extra});
 add('river',200,0,155,155,{points:[[240,0],[195,160],[260,330],[185,520],[230,750],[170,1000]]});
 add('road',380,500,95,95,{material:'cobble',points:[[280,500],[520,500],[780,520],[1100,500],[1600,530]]});
 add('road',900,0,75,75,{material:'earth',points:[[850,0],[880,250],[890,500],[950,750],[1000,1000]]});
 for(let y=0;y<3;y++)for(let x=0;x<5;x++){const id=['cottage','townhouse','slate-house','thatch-house','tavern-roof'][(x+y)%5],a=window.testMap.mapAssets.find(a=>a.id===id);add('asset',440+x*230,140+y*310,a.w*.85,a.h*.85,{assetId:id,rotation:y%2?90:0});}
 for(let i=0;i<33;i++){const x=i<13?45+(i%3)*34:330+(i*137)%1200,y=i<13?40+i*75:30+(i*197)%940;add('asset',x,y,65+(i%3)*12,65+(i%3)*12,{assetId:'oak-'+(i%3+1),rotation:i*31%360-180});}
 add('asset',208,500,190,120,{assetId:'bridge'});add('asset',1180,530,80,80,{assetId:'fountain'});add('asset',1300,880,170,125,{assetId:'field-3'});add('asset',1450,830,150,150,{assetId:'windmill'});
 for(let i=0;i<6;i++)add('asset',470+i*180,580,30,30,{assetId:'streetlamp'});
 return s;});
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'town.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({scene:town}))});await page.getByText('Проект открыт. Проверь карту перед сохранением.',{exact:true}).waitFor();
 await page.getByLabel('Название ручной карты').fill('Речной город');await page.getByLabel('Поиск ассетов').fill('');await page.getByLabel('Категория ассетов').selectOption('Здания');await btn('Выбрать').click();
 await fs.writeFile('tmp/creative-town.png',await download('Скачать PNG'));await page.screenshot({path:'tmp/creative-town-editor.png',fullPage:true});
 await page.getByText('Экспорт и горячие клавиши',{exact:true}).click();await page.getByLabel('Разрешение PNG').selectOption('3');const high=await download('Скачать PNG');assert.equal((await sharp(high).metadata()).width,4800);
 // Re-rendered paths differ from simply enlarging the 1x bitmap.
 const enlarged=await sharp(await fs.readFile('tmp/creative-town.png')).resize(4800,3000).raw().toBuffer();const highRaw=await sharp(high).raw().toBuffer();assert.notDeepEqual(highRaw,enlarged);

 await page.getByLabel('Разрешение PNG').selectOption('1');
 await page.getByLabel('Показывать сетку').check();assert.equal(JSON.parse((await download('Проект JSON')).toString()).scene.grid,true);await page.getByLabel('Показывать сетку').uncheck();
 await btn('Линейка').click();await drag(400,300,150,200);assert.equal(await page.getByLabel('Измеренное расстояние').textContent(),'25 фт');
 const beforeMeasure=JSON.parse((await download('Проект JSON')).toString()).scene;assert.equal(beforeMeasure.items.length,town.items.length);
 await page.getByText('Размер карты и масштаб',{exact:true}).click();assert.equal(await page.getByLabel('Футов в клетке').inputValue(),'5');
 await page.getByLabel('Ширина карты в клетках').fill('40');await page.getByLabel('Высота карты в клетках').fill('30');await btn('Применить размер').click();
 assert.equal(await canvas.getAttribute('width'),'2000');assert.equal(await canvas.getAttribute('height'),'1500');
 const expanded=JSON.parse((await download('Проект JSON')).toString()).scene;assert.deepEqual(expanded.items,beforeMeasure.items);
 await btn('Отменить').click();assert.equal(await canvas.getAttribute('width'),'1600');await btn('Повторить').click();assert.equal(await canvas.getAttribute('width'),'2000');
 await page.getByLabel('Ширина карты в клетках').fill('4');await btn('Применить размер').click();await page.getByRole('alert').filter({hasText:'За новым краем'}).waitFor();await btn('Закрыть').click();assert.equal(await canvas.getAttribute('width'),'2000');
 const wideDrag=async(x,y,dx,dy)=>{const b=await canvas.boundingBox(),scale=b.width/2000;await page.mouse.move(b.x+x*scale,b.y+y*scale);await page.mouse.down();await page.mouse.move(b.x+(x+dx)*scale,b.y+(y+dy)*scale,{steps:8});await page.mouse.up();};
 await btn('Линейка').click();await wideDrag(1700,1100,150,200);assert.equal(await page.getByLabel('Измеренное расстояние').textContent(),'25 фт');
 await page.getByLabel('Ширина карты в клетках').fill('40');await page.screenshot({path:'tmp/creative-ruler-desktop.png',fullPage:true});await btn('Приблизить холст').click();await wideDrag(400,300,150,200);assert.equal(await page.getByLabel('Измеренное расстояние').textContent(),'25 фт');await btn('Вписать холст').click();
 await page.getByLabel('Футов в клетке').fill('10');assert.equal(await page.getByLabel('Измеренное расстояние').textContent(),'50 фт');
 const scaledProps=JSON.parse((await download('Проект JSON')).toString()).scene.items;for(const original of expanded.items.filter(i=>i.kind==='asset')){const scaled=scaledProps.find(i=>i.id===original.id);assert.equal(scaled.w,original.w/2);assert.equal(scaled.h,original.h/2);}
 await page.getByLabel('Категория ассетов').selectOption('Мебель');await page.getByLabel('Поиск ассетов').fill('Стол');await btn('Стол').click();const cb=await canvas.boundingBox();await canvas.click({position:{x:1750*cb.width/2000,y:200*cb.height/1500}});await page.getByLabel('Ширина предмета в футах').fill('12');assert.equal(await page.getByLabel('Ширина предмета в футах').inputValue(),'12');
 const sizedItem=JSON.parse((await download('Проект JSON')).toString()).scene.items.at(-1);assert.equal(sizedItem.w,60);assert.equal(sizedItem.assetId,'table');
 await btn('Комната').click();await wideDrag(1700,1100,200,200);const resizedPNG=await download('Скачать PNG');const resizedMeta=await sharp(resizedPNG).metadata();assert.equal(resizedMeta.width,2000);assert.equal(resizedMeta.height,1500);const floorPixel=await sharp(resizedPNG).extract({left:1803,top:1203,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...floorPixel],[250,247,237]);
 await btn('Сохранить карту').click();await page.getByText('Ручная карта сохранена',{exact:true}).waitFor();assert.equal(JSON.parse(maps[0].creative).width,2000);assert.equal(JSON.parse(maps[0].creative).feetPerCell,10);
 await page.reload();await canvas.waitFor();assert.equal(await canvas.getAttribute('width'),'2000');await page.getByText('Размер карты и масштаб',{exact:true}).click();assert.equal(await page.getByLabel('Футов в клетке').inputValue(),'10');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/creative-studio-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 assert.deepEqual(errors,[]);console.log(`Creative studio passed: ${geometry.count} assets, merged floors/cuts, polygon/cave/corridor, layers/locks, move/rotate/duplicate, undo/redo, save/reopen, PNG/JSON, draft recovery, AI source/style, outdoor modes/terrain/roads/rivers/scatter, true 3x render, resize/undo/bounds/reopen, feet ruler/scale, 390px.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
