const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable world required');const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready);
 const result=await page.evaluate(async()=>{
  const {importItems}=await import('/modules/shadow-edge-gm/scripts/item-import.mjs'),{importProgress}=await import('/modules/shadow-edge-gm/scripts/import-progress.mjs');
  const actor=await Actor.create({name:'Import preservation test',type:'npc'}),source={name:'Passive trait',type:'feat',system:{description:{value:'Original trait'}},flags:{'shadow-edge-gm':{coverage:'manual'}}},state={};let warnings=0;const warn=ui.notifications.warn;ui.notifications.warn=()=>warnings++;
  try{await importItems(actor,[source],state);const item=actor.items.contents[0];await item.update({'system.description.value':'GM edit'});
   const quiet=await importItems(actor,[source],state);delete state.itemSources;const legacy=await importItems(actor,[source],state);
   const modified=structuredClone(source);modified.name='Site revision';const preserved=await importItems(actor,[modified],state);
   const progress=importProgress();progress.total(1);progress.done();progress.finish(null,[],preserved);
   return {quiet:quiet.length,legacy:legacy.length,preserved:preserved.length,warnings,description:item.system.description.value,report:document.querySelector('.shadow-edge-import-progress').textContent,items:actor.items.size};
  }finally{ui.notifications.warn=warn;await actor.delete()}
 });assert.equal(result.quiet,0);assert.equal(result.legacy,0);assert.equal(result.preserved,1);assert.equal(result.warnings,0);assert.equal(result.description,'GM edit');assert.equal(result.items,1);assert.match(result.report,/Сохранены существующие способности: 1/);assert.match(result.report,/не ошибки/);console.log('Native dnd5e normalization, legacy baseline, preserved GM changes, zero warning toasts and summary report: PASS');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
