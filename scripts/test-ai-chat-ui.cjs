const {build} = require('esbuild');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async()=>{
  const bundle = await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AIChatPage}from'./apps/web/src/features/ai-jobs/AIChatPage';import{AIJobsPanel}from'./apps/web/src/features/ai-jobs/AIJobsPanel';import'./apps/web/src/app.css';import'./apps/web/src/features/ai-jobs/ai-jobs.css';import'./apps/web/src/styles/workspace.css';createRoot(document.getElementById('root')).render(location.pathname==="/chat"?<AIChatPage/>:<AIJobsPanel campaignId="campaign" onOpenSession={()=>{}} onOpenProposal={()=>{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'tmp/chat-test',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'},loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'}});
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    let turns=[], job=null, posted, postRoute,applyCount=0;
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async r=>{
      const u = new URL(r.request().url());
      if (u.pathname==='/uploads/test.png') return r.fulfill({contentType:'image/png',path:'apps/web/public/session-token.png'});
      if (u.pathname==='/api/ai/jobs') return r.fulfill({json:{data:job?[job]:[]}});
      if(u.pathname==='/api/campaigns')return r.fulfill({json:{data:[{id:'campaign',title:'Тестовая кампания'}]}});
      if(u.pathname.endsWith('/drafts/apply')){assert.deepEqual(r.request().postDataJSON(),{turnId:turns[0].id,draftId:'draft1'});applyCount++;turns[0].drafts[0].createdId='created-npc';return r.fulfill({json:{data:{campaign:{id:'campaign'}}}});}
      if (u.pathname.endsWith('/ai/chat')) {
        if (r.request().method()==='POST') {posted=r.request().postDataJSON();postRoute=r;return;}
        return r.fulfill({json:{data:{turns:u.searchParams.has('sessionIds')?[]:turns,sessions:[{id:'s1',title:'Первая сессия'},{id:'s2',title:'Вторая сессия'}]}}});
      }
      if (u.pathname==='/' || u.pathname==='/chat') return r.fulfill({contentType:'text/html',body:'<style>body:has(.ai-chat-page)>#background{display:none}</style><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><button id="background" onclick="this.textContent=\'Приложение доступно\'">Фоновая кнопка</button><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>'});
      return r.fulfill({contentType:u.pathname.endsWith('css')?'text/css':'application/javascript',body:bundle.outputFiles.find(f=>f.path.endsWith(u.pathname.endsWith('css')?'.css':'.js')).text});
    });
    await page.goto('https://chat-test.local');
    await page.getByRole('button',{name:'AI-помощник',exact:true}).click();
    await page.getByText('Обсудим вашу кампанию').waitFor();
    await page.getByRole('button',{name:'Фоновая кнопка'}).click();
    await page.getByText('Приложение доступно').waitFor();
    assert.equal(await page.getByRole('dialog').evaluate(e=>e.matches(':modal')),false);
    const before=await page.getByRole('dialog').boundingBox();
    const handle=await page.getByLabel('Переместить окно помощника').boundingBox();
    await page.mouse.move(handle.x+30,handle.y+15);await page.mouse.down();await page.mouse.move(handle.x-100,handle.y+45);await page.mouse.up();
    const moved=await page.getByRole('dialog').boundingBox();assert.ok(moved.x<before.x-100,'window did not move');
    const grip=await page.getByLabel('Изменить размер окна se',{exact:true}).boundingBox();
    await page.mouse.move(grip.x+10,grip.y+10);await page.mouse.down();await page.mouse.move(grip.x-70,grip.y-60);await page.mouse.up();
    const resized=await page.getByRole('dialog').boundingBox();assert.ok(resized.width<moved.width-50,'window did not resize');
    for(const edge of ['n','s','e','w','ne','nw','sw']){
      const a=await page.getByRole('dialog').boundingBox(),h=await page.getByLabel(`Изменить размер окна ${edge}`,{exact:true}).boundingBox();
      const dx=edge.includes('w')?15:edge.includes('e')?-15:0,dy=edge.includes('n')?15:edge.includes('s')?-15:0;
      await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2+dy);await page.mouse.up();
      const b=await page.getByRole('dialog').boundingBox();assert.ok((dx&&b.width<a.width)||(dy&&b.height<a.height),`resize ${edge} failed`);
    }
    await page.getByLabel('Вопрос AI').fill('Кто забрал ключ?');
    await page.getByRole('button',{name:'Отправить вопрос'}).click();
    await page.getByText('Кто забрал ключ?',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Вопрос AI').inputValue(),'');
    await page.getByText('Изучаю материалы',{exact:false}).waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.ai-chat-dots i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.screenshot({path:'tmp/ai-chat-pending.png'});
    const id=posted.id;
    assert.deepEqual(posted.context,{includeCampaign:true,sessionIds:[]});
    await postRoute.fulfill({status:503,json:{error:{message:'Тестовая ошибка'}}});
    await page.getByText('Тестовая ошибка',{exact:true}).waitFor();
    postRoute=null;
    await page.getByRole('button',{name:'Повторить',exact:true}).click();
    while(!postRoute) await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(posted.id,id);
    job={id:'job',kind:'chat',campaignId:'campaign',state:'queued',stage:'Ожидание',title:'Ответ AI',createdAt:new Date().toISOString()};
    await postRoute.fulfill({status:202,json:{data:job}});
    turns=[{id,question:posted.question,answer:'**Ключ у Аделины.**\n\n| Улика | Источник |\n| --- | --- |\n| Ключ | Сессия |',suggestions:['Уточнить мотив Аделины.'],sources:[{id:'npcs:n1:0',targetId:'n1',kind:'npcs',title:'Аделина',text:'Аделина забрала ключ.',entity:{title:'Аделина',summary:'Хранительница ключа от обсерватории.',imageUrl:'/uploads/test.png'}}],createdAt:new Date().toISOString()}];
    job.state='succeeded';
    turns[0].drafts=[{id:'draft1',kind:'npc',title:'Элиан, хранитель прилива',subtitle:'Новый НПС',summary:'Смотритель маяка с тайной, связанной с исчезновением кораблей.',content:'## Характер\nСпокоен и наблюдателен.\n\n## Тайна\nХранит карту затонувшего святилища.'}];
    await page.getByRole('button',{name:'Обновить диалог'}).click();
    await page.getByText('Ключ у Аделины.',{exact:true}).waitFor();
    assert.equal(await page.getByText('Кто забрал ключ?',{exact:true}).count(),1);
    await page.getByAltText('Аделина').waitFor();
    await page.waitForFunction(()=>document.querySelector('.ai-chat-entity img')?.naturalWidth>0);
    await page.getByRole('button',{name:'Добавить этого НПС в кампанию'}).click();
    await page.getByRole('button',{name:'Добавлено в кампанию',exact:true}).waitFor();
    assert.equal(applyCount,1);
    for(const[name,width,height]of[['desktop',1440,1000],['mobile',390,844]]) {
      await page.setViewportSize({width,height});
      await page.screenshot({path:`tmp/ai-chat-${name}.png`});
      assert.ok(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'dialog overflow');
    }
    await page.getByRole('button',{name:'На весь экран'}).click();
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:'tmp/ai-chat-expanded.png'});
    await page.getByAltText('Аделина').dispatchEvent('error');
    await page.locator('.ai-chat-entity-icon').waitFor();
    assert.equal(await page.getByAltText('Аделина').count(),0);
    await page.getByRole('button',{name:'Закрыть AI-помощник'}).click();
    await page.getByRole('button',{name:'AI-помощник',exact:true}).click();
    await page.getByText('Ключ у Аделины.',{exact:true}).waitFor();
    await page.locator('.ai-chat-context > summary').click();
    await page.getByLabel('Материалы кампании',{exact:true}).uncheck();
    await page.getByLabel('Первая сессия',{exact:true}).check();
    await page.getByLabel('Вторая сессия',{exact:true}).check();
    await page.getByText('Обсудим вашу кампанию').waitFor();
    assert.equal(await page.getByText('Ключ у Аделины.',{exact:true}).count(),0);
    await page.screenshot({path:'tmp/ai-chat-context.png'});
    await page.locator('.ai-chat-context > summary').click();
    await page.getByLabel('Вопрос AI').fill('Сравни две сессии');
    postRoute=null;
    await page.getByRole('button',{name:'Отправить вопрос'}).click();
    while(!postRoute) await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(posted.context,{includeCampaign:false,sessionIds:['s1','s2']});
    await postRoute.fulfill({status:503,json:{error:{message:'Тест завершён'}}});
    await page.goto('https://chat-test.local/chat?campaign=campaign');
    await page.getByRole('heading',{name:'AI-чат',exact:true}).waitFor();
    await page.getByText('Ключ у Аделины.',{exact:true}).waitFor();
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/ai-chat-page-desktop.png'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/ai-chat-page-mobile.png'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS: optimistic message, pending animation/reduced motion, failed retry, deduplication, entity image, responsive/fullscreen, scope isolation.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
