// Requires npm run build and go build -o tmp/ready-campaign-server.exe ./apps/server/cmd/server.
// Starts a server on a fresh temporary store, never on the user's data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = process.cwd(), dir = await fs.mkdtemp(path.join(os.tmpdir(),'ready-campaign-ui-'));
  const port = await new Promise(resolve=>{const probe=net.createServer();probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});});
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
  Object.assign(env,{PORT:String(port),SHADOW_EDGE_STORAGE_MODE:'json',SHADOW_EDGE_DATA_FILE:path.join(dir,'store.json'),SHADOW_EDGE_UPLOAD_DIR:path.join(dir,'uploads'),SHADOW_EDGE_WEB_DIR:path.join(root,'apps/web/dist'),SHADOW_EDGE_BESTIARY_CACHE_FILE:path.join(dir,'bestiary.json'),SHADOW_EDGE_ITEM_CATALOG_CACHE_FILE:path.join(dir,'items.json')});
  const server = spawn(path.join(root,'tmp/ready-campaign-server.exe'),[],{cwd:dir,env,windowsHide:true,stdio:'ignore'});
  let browser;
  try {
    const base='http://127.0.0.1:'+port;
    for(let n=0;n<100;n++){try{const r=await fetch(base+'/api/auth/session');if(r.ok)break;}catch{} if(server.exitCode!==null)throw new Error('Isolated test server exited');await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const registration=await context.request.post(base+'/api/auth/register',{data:{username:'template-ui-gm',password:'isolated-test-password'}});
    assert.equal(registration.status(),200);
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button',{name:'Готовые Кампании',exact:true}).click();
    await page.getByRole('heading',{name:'Долина Ледяного Ветра: Иней Морозной Девы',exact:true}).waitFor();
    await page.getByRole('button',{name:'Начать прохождение',exact:true}).click();
    await page.locator('.ready-campaign-notice').waitFor({timeout:30000});
    await page.locator('.ready-campaign-library').waitFor({state:'hidden'});
    const campaignId=await page.getByLabel('Кампания',{exact:true}).inputValue();
    await page.getByRole('button',{name:'Локации',exact:true}).click();
    await page.locator('.ready-reader-detail h2').waitFor();
    assert.equal(await page.getByRole('button',{name:'Создать',exact:true}).count(),0);
    await page.locator('.ready-reader-directory input').fill('Бремен');
    await page.locator('.ready-reader-list button').filter({has:page.getByText('Бремен',{exact:true})}).click();
    await page.locator('.ready-reader-detail h2').filter({hasText:/^Бремен$/}).waitFor();
    await fs.mkdir(path.join(root,'tmp/ready-campaign-ui'),{recursive:true});
    await page.screenshot({path:path.join(root,'tmp/ready-campaign-ui/desktop.png'),fullPage:false});
    await page.getByRole('button',{name:'Открыть исходную книгу',exact:true}).click();
    await page.getByLabel('Страница PDF',{exact:true}).fill('323');
    await page.waitForFunction(()=>{const i=document.querySelector('.ready-book-image img');return i?.complete&&i.naturalWidth>0&&i.src.includes('323.webp')});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(root,'tmp/ready-campaign-ui/mobile.png'),fullPage:false});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'horizontal overflow on mobile');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/maps?campaign='+campaignId);
    await page.getByLabel('Карта готовой кампании').waitFor();
    assert.equal(await page.getByRole('button',{name:'Новая карта',exact:true}).count(),0);
    assert.equal(await page.getByLabel('Текст подписи').count(),0);
    await page.waitForFunction(()=>{const i=document.querySelector('.world-map-viewport img');return i?.complete&&i.naturalWidth>0});
    await page.getByRole('button',{name:'Вписать карту',exact:true}).click();
    await page.screenshot({path:path.join(root,'tmp/ready-campaign-ui/map.png'),fullPage:false});
    assert.deepEqual(errors,[]);
    console.log('Ready campaigns UI: creation, immutable reader, source page 323, mobile layout, read-only map passed');
  } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
