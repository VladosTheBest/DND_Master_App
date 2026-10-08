// Run only against a disposable, already launched Foundry world with dnd5e.
// The API is mocked; backend persistence/access rules have separate Go tests.
const assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
  if(!process.env.FOUNDRY_TEST_URL)throw Error("Set FOUNDRY_TEST_URL to a disposable test world.");
  const browser=await chromium.launch({headless:true,channel:"chrome"});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto(process.env.FOUNDRY_TEST_URL);
    if(await page.locator('select[name="userid"]').count())await page.selectOption('select[name="userid"]',{label:"Gamemaster"});else await page.locator('input[name="username"]').fill("Gamemaster");
    await page.locator('button[name="join"]').click();
    await page.waitForFunction(()=>typeof game!=="undefined"&&game.ready,null,{timeout:45000});
    const result=await page.evaluate(async()=>{
      const {MODULE}=await import("/modules/shadow-edge-gm/scripts/core.mjs");
      const {saveState}=await import("/modules/shadow-edge-gm/scripts/storage.mjs");
      const {refresh,exportSite}=await import("/modules/shadow-edge-gm/scripts/main.mjs");
      let record={key:"npc:smoke",id:"smoke",kind:"npc",title:"Smoke NPC",hash:"initial",data:{id:"smoke",kind:"npc",title:"Smoke NPC",content:"Private GM note",playerContent:"Public biography",statBlock:{armorClass:"15",hitPoints:"30",speed:"30",abilityScores:{str:16,dex:12,con:14,int:10,wis:10,cha:10},actions:[{name:"Sword",toHit:"+5",damage:"1d8+3 slashing",description:"Melee attack"}]}}};
      const base="https://integration-test.invalid",campaignId="runtime-smoke";
      let requests=0,commits=0,body;
      const originalFetch=window.fetch,Dialog=foundry.applications.api.DialogV2,originalWait=Dialog.wait,originalConfirm=Dialog.confirm;
      window.fetch=async(url,options)=>{
        if(!String(url).startsWith(base))return originalFetch(url,options);
        requests++;const path=String(url).split("/api/integrations/foundry/")[1];let data;
        if(path==="v1/snapshot")data={schemaVersion:1,campaignId,title:"Smoke",records:[record],spells:[]};
        else if(path==="v1/export/preview"){body=JSON.parse(options.body);data={items:body.changes.map(c=>({key:c.key,title:c.data.title,status:"update"})),canCommit:true}}
        else if(path==="v1/export/commit"){commits++;body=JSON.parse(options.body);record={...record,data:body.changes[0].data,title:body.changes[0].data.title,hash:"exported"};data={mappings:{[body.changes[0].key]:"smoke"}}}
        else throw Error(`Unexpected API request ${path}`);
        return new Response(JSON.stringify({data}),{status:200,headers:{"Content-Type":"application/json"}});
      };
      Dialog.wait=async options=>{const element=document.createElement("div");element.innerHTML=options.content;return options.buttons.find(b=>b.action==="preview").callback(null,null,{element})};
      Dialog.confirm=async()=>true;
      await saveState({base,campaignId,token:"test-only-token",records:{}});
      let actor;
      try{
        await refresh();actor=game.actors.find(a=>a.flags[MODULE]?.campaignId===campaignId);
        const hp=actor.system.attributes.hp.max,ac=actor.system.attributes.ac.value,activity=actor.items.contents[0].system.activities.contents[0];
        await refresh();const count=game.actors.filter(a=>a.flags[MODULE]?.campaignId===campaignId).length;
        await actor.update({"system.attributes.hp.value":2});await exportSite();const runtimeCommits=commits;
        const gmNotes=game.journal.find(j=>j.flags[MODULE]?.gmFor===actor.id);await gmNotes.pages.contents[0].update({"text.content":"<p>Local revised GM note</p>"});
        await actor.update({name:"Renamed NPC"});record={...record,hash:"site-revised",data:{...record.data,content:"Revised site GM note"}};
        await refresh();await exportSite();
        return {hp,ac,activity:activity.type,bonus:activity.attack.bonus,count,runtimeCommits,commits,requests,exported:body.changes[0].data,publicBio:actor.system.details.biography.value};
      }finally{
        window.fetch=originalFetch;Dialog.wait=originalWait;Dialog.confirm=originalConfirm;
        for(const note of game.journal.filter(j=>j.flags[MODULE]?.campaignId===campaignId))await note.delete();
        if(actor)await actor.delete();await saveState({records:{}});
      }
    });
    assert.equal(result.hp,30);assert.equal(result.ac,15);assert.equal(result.activity,"attack");assert.equal(result.count,1);assert.equal(result.runtimeCommits,0);assert.equal(result.commits,1);assert.equal(result.exported.title,"Renamed NPC");assert.equal(result.exported.statBlock.hitPoints,"30");assert.equal(result.exported.content,"Local revised GM note");assert(!result.publicBio.includes("Private"));
    console.log("Foundry runtime exchange smoke passed",JSON.stringify({requests:result.requests,commits:result.commits}));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
