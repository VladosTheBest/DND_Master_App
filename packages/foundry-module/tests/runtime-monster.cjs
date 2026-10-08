// Disposable native dnd5e runtime; public statblock mechanics, no campaign data.
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable Foundry URL required');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready);
 const result=await page.evaluate(async()=>{
  const {basicAbility}=await import('/modules/shadow-edge-gm/scripts/adapter.mjs'),{animationProfile}=await import('/modules/shadow-edge-gm/scripts/animations.mjs');
  const actor=await Actor.create({name:'Disposable Fiend mechanics',type:'npc',system:{attributes:{hp:{value:78,max:78}}}});
  try{const entries=[{name:'Скимитар',toHit:'+6 к попаданию',damage:'6 (1к6 + 3) рубящего урона плюс 14 (4к6) урона огнём.'},{name:'Адский огонь',damage:'16 (3к10) урона',description:'Колдун создаёт сферу радиусом 10 футов в пределах 120 футов. Существо совершает спасбросок Ловкости Сл 15, получая 16 (3к10) урона огнём и 11 (2к10) урона некротической энергией при провале, или половину этого урона при успешном спасброске.'},{name:'Возмездие исчадия (3/день)',damage:'22 (4к10) урона некротической энергией',description:'Существо совершает спасбросок Телосложения Сл 15.'}];
   const items=await actor.createEmbeddedDocuments('Item',entries.map(basicAbility)),sword=items[0].system.activities.contents[0],hellfire=items[1].system.activities.contents[0],reaction=items[2].system.activities.contents[0];
   const attackRolls=await sword.rollDamage({},{configure:false},{create:false}),saveRolls=await hellfire.rollDamage({},{configure:false},{create:false});
   const out={attackBonus:sword.attack.bonus,attackFormulas:attackRolls.map(r=>r.formula),attackTypes:attackRolls.map(r=>r.options.type),dc:hellfire.save.dc.value,template:hellfire.target.template.size,half:hellfire.damage.onSave,saveFormulas:saveRolls.map(r=>r.formula),saveTypes:saveRolls.map(r=>r.options.type),animation:animationProfile(items[1],hellfire).key,uses:items[2].system.uses.max,consumes:reaction.consumption.targets[0].type};
   await reaction.use({subsequentActions:false},{configure:false});out.spent=items[2].system.uses.spent;return out;
  }finally{await actor.delete()}
 });assert.equal(result.attackBonus,'6');assert.equal(result.attackFormulas.length,2);assert.deepEqual(result.attackTypes,['slashing','fire']);assert.equal(result.dc,15);assert.equal(result.template,10);assert.equal(result.half,'half');assert.deepEqual(result.saveTypes,['fire','necrotic']);assert.equal(result.animation,'fireball');assert.equal(result.uses,3);assert.equal(result.spent,1);assert.equal(result.consumes,'itemUses');console.log('Native Fiend attacks, two typed damage rolls, DEX DC15 sphere/half, fire animation and daily resource consumption: PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
