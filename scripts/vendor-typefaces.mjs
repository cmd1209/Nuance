import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const registry=JSON.parse(await readFile(new URL('../src/nuance/data/typefaces/v1/registry.json',import.meta.url),'utf8'));
const restore=process.argv.includes('--restore');
for(const font of registry){
 const path=new URL('../public'+font.loading.url,import.meta.url);
 const bytes=restore?Buffer.from(await (await fetch(font.upstream.assetUrl)).arrayBuffer()):await readFile(path);
 if(bytes.subarray(0,4).toString()!=='wOF2'||createHash('sha256').update(bytes).digest('hex')!==font.upstream.sha256)throw new Error(`Font integrity mismatch: ${font.family}`);
 if(restore){
  const response=await fetch(font.upstream.licenseUrl);if(!response.ok)throw new Error(`License download failed: ${font.family}`);
  const license=await response.text();if(!/SIL OPEN FONT LICENSE/i.test(license))throw new Error(`Unexpected license: ${font.family}`);
  await writeFile(path,bytes);await writeFile(new URL('../public'+font.license.noticeUrl,import.meta.url),license);
 }
 console.log(`${font.family}: verified ${bytes.length} bytes from ${font.upstream.package}@${font.upstream.packageVersion}`);
}
