import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.argv.includes('--check')){
 const root='apps/web/public/map-assets/painted-v1',manifest=JSON.parse(await readFile(`${root}/PROVENANCE.json`,'utf8'));
 assert.equal(manifest.assets.length,25);assert.equal(new Set(manifest.assets.map(a=>a.id)).size,25);
 for(const a of manifest.assets){const bytes=await readFile(`${root}/${a.file}`),m=await sharp(bytes).metadata();assert.equal(createHash('sha256').update(bytes).digest('hex'),a.outputSha256);assert.ok(m.hasAlpha&&m.width<=1024&&m.height<=1024);const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});for(const index of [0,info.width-1,(info.height-1)*info.width,info.width*info.height-1])assert.equal(data[index*4+3],0,`${a.id}: corner must be transparent`);const thumb=await sharp(`${root}/thumbs/${a.file}`).metadata();assert.ok(thumb.hasAlpha&&thumb.width<=160&&thumb.height<=160);}
 console.log('25 painted sprites: hashes, alpha, dimensions and thumbnails verified');process.exit(0);
}
const inputs=JSON.parse(await readFile(process.argv[2]||'tmp/painted-inputs.json','utf8'));
const root='apps/web/public/map-assets/painted-v1';await mkdir(root,{recursive:true});await mkdir(`${root}/thumbs`,{recursive:true});
const records=[];
for(const input of inputs){
 if(!input.path)throw new Error(`Missing generated source: ${input.id}`);
 const source=await readFile(input.path),meta=await sharp(source).metadata();
 if(!meta.hasAlpha)throw new Error(`${input.id}: requires genuine transparency`);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=0,y1=0,transparent=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha<8)transparent++;else{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 if(transparent<info.width*info.height*.03)throw new Error(`${input.id}: insufficient transparent margin; inspect/regenerate`);
 let pipeline=sharp(await sharp(source).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer());
 if(['table','altar'].includes(input.id))pipeline=pipeline.rotate(90);
 const file=`${input.id}.webp`;
 const out=await pipeline.resize({width:1008,height:1008,fit:'inside',withoutEnlargement:true}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'}).webp({quality:90,alphaQuality:100,effort:5}).toBuffer();
 await writeFile(`${root}/${file}`,out);
 await sharp(out).resize({width:160,height:160,fit:'inside'}).webp({quality:82,alphaQuality:100}).toFile(`${root}/thumbs/${file}`);
 records.push({id:input.id,file,sourceSha256:createHash('sha256').update(source).digest('hex'),outputSha256:createHash('sha256').update(out).digest('hex'),prompt:input.prompt,...await sharp(out).metadata(),bytes:out.length});
}
await writeFile(`${root}/PROVENANCE.json`,JSON.stringify({created:'2026-10-20',method:'OpenAI built-in image_gen; individually generated original raster sprites. No third-party pack artwork included.',processing:'Alpha-bounds crop, transparent padding, resize to maximum 1024px, WebP quality 90/alpha 100; table and altar rotated 90 degrees to match existing footprints.',assets:records},null,2)+'\n');
console.log(`Prepared ${records.length} sprites, ${(records.reduce((sum,r)=>sum+r.bytes,0)/1048576).toFixed(2)} MiB`);
