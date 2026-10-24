const {build}=require('esbuild');
const assert=require('node:assert/strict');
(async()=>{
 const result=await build({entryPoints:['apps/web/src/app/action-menu-position.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports);
 const place=mod.exports.actionMenuPosition;
 for(const viewport of [{width:1440,height:1024},{width:390,height:844},{width:320,height:568},{width:640,height:240}]){
  for(const anchor of [{top:32,bottom:72,right:viewport.width-16},{top:viewport.height-70,bottom:viewport.height-30,right:80},{top:viewport.height/2,bottom:viewport.height/2+40,right:viewport.width/2}]){
   for(const contentHeight of [80,400,1400]){
    const p=place(anchor,contentHeight,viewport),height=Math.min(contentHeight,p.maxHeight);
    assert.ok(p.left>=0&&p.top>=0);
    assert.ok(p.left+p.width<=viewport.width);
    assert.ok(p.top+height<=viewport.height);
   }
  }
 }
 const up=place({top:500,bottom:540,right:300},200,{width:390,height:568});
 assert.ok(up.top+200<500,'A menu near the bottom must open above the trigger');
 const down=place({top:20,bottom:60,right:300},100,{width:390,height:568});
 assert.ok(down.top>=60,'A menu with space below must open below the trigger');
 console.log('Action menus: viewport bounds, long lists, short windows, top/bottom anchors passed');
})();
