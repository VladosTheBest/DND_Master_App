import {readFile,writeFile,mkdir,readdir,copyFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const repo=path.resolve(root,"../..");
const output=path.join(repo,"tmp/foundry"),publicDir=path.join(repo,"apps/web/public/foundry");
await mkdir(output,{recursive:true});await mkdir(publicDir,{recursive:true});
const files=["module.json"];
for(const dir of ["scripts","styles"]){for(const f of await readdir(path.join(root,dir)))if(f!=="build.mjs"&&/\.(mjs|css)$/.test(f))files.push(`${dir}/${f}`)}
const crc32=data=>{let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return (crc^0xffffffff)>>>0};
const entries=[],central=[];let offset=0;
for(const file of files){const body=await readFile(path.join(root,file)),name=Buffer.from(file),crc=crc32(body);
 const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(body.length,22);h.writeUInt16LE(name.length,26);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(body.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
 entries.push(h,name,body);central.push(c,name);offset+=h.length+name.length+body.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const artifact=path.join(output,"shadow-edge-gm.zip");await writeFile(artifact,Buffer.concat([...entries,directory,end]));
await copyFile(artifact,path.join(publicDir,"shadow-edge-gm.zip"));await copyFile(path.join(root,"module.json"),path.join(publicDir,"module.json"));
console.log(`Foundry module: ${artifact}`);
