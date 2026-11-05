import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
const archive=await readFile(path.join(root,'robinson-source.json.gz'));
if(createHash('sha256').update(archive).digest('hex')!=='17a151bbe7db39c7b5039ae1b1b02bc18f41518de9fd5c4b53706161f580898a')
    throw new Error('Källpaketet matchar inte build.mjs. Ladda upp alla fyra filer från samma ZIP-paket.');
const source=JSON.parse(gunzipSync(archive,{maxOutputLength:32*1024*1024}).toString('utf8'));
if(source.format!==1||!source.files||Object.keys(source.files).length>1000)
    throw new Error('Ogiltigt källpaket.');
const entries=Object.entries(source.files);
for(const [name,data] of entries){
    if(!name||path.isAbsolute(name)||name.includes('\\')||name.includes('\0')||name.split('/').some(p=>!p||p==='.'||p==='..')||typeof data!=='string')
        throw new Error('Ogiltig filsökväg i källpaketet.');
}
// app/ is generated from this upload; clearing it avoids stale cached source or assets.
const destination=path.join(root,'app');await rm(destination,{recursive:true,force:true});
for(const [name,data] of entries){
    const target=path.join(destination,name);await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,Buffer.from(data,'base64'));
}
console.log(`Packade upp ${entries.length} projektfiler i molnbygget.`);
if(!process.argv.includes('--unpack-only')){
    const result=spawnSync(process.execPath,[path.join(destination,'cloudflare/scripts/build.mjs')],{cwd:root,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status??1);
}
