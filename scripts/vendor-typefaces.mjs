import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const registry=JSON.parse(await readFile(new URL('../src/nuance/data/typefaces/v1/registry.json',import.meta.url),'utf8'));
const restore=process.argv.includes('--restore');
async function download(url){
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Download failed (${response.status}): ${url}`);
 return response;
}
for(const font of registry){
 const assets=[{url:font.loading.url,...font.upstream},...(font.loading.additionalFaces??[])];
 let total=0;
 for(const asset of assets){
  const path=new URL('../public'+asset.url,import.meta.url);
  const bytes=restore?Buffer.from(await (await download(asset.assetUrl)).arrayBuffer()):await readFile(path);
  if(bytes.subarray(0,4).toString()!=='wOF2'||bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error(`Font integrity mismatch: ${font.family} (${asset.url})`);
  if(restore)await writeFile(path,bytes);
  total+=bytes.length;
 }
 const licensePath=new URL('../public'+font.license.noticeUrl,import.meta.url);
 const license=restore?await (await download(font.upstream.licenseUrl)).text():await readFile(licensePath,'utf8');
 if(!/SIL OPEN FONT LICENSE/i.test(license))throw new Error(`Unexpected license: ${font.family}`);
 if(restore)await writeFile(licensePath,license);
 console.log(`${font.family}: verified ${assets.length} face(s), ${total} bytes from ${font.upstream.package}@${font.upstream.packageVersion}`);
}
