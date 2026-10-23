import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
async function compress(dir){for(const file of await readdir(dir)){const path=join(dir,file);if((await stat(path)).isDirectory())await compress(path);else if(/\.(js|css|html|svg|json)$/.test(file)){const data=await readFile(path);if(data.length>512)await writeFile(path+'.gz',gzipSync(data,{level:9}));}}}
await compress('dist');
