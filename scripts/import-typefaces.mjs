import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Explicit imports only: preserve existing families and never silently update pinned assets.
const version='5.3.0';
const registryUrl=new URL('../src/nuance/data/typefaces/v1/registry.json',import.meta.url);
const registry=JSON.parse(await readFile(registryUrl,'utf8'));
const ids=process.argv.slice(2);
if(!ids.length || ids.some(id=>!/^[-a-z0-9]+$/.test(id)))throw new Error('Pass Fontsource family IDs, for example: node scripts/import-typefaces.mjs lato pt-serif');
const files=[],additions=[];
async function download(url){
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Download failed (${response.status}): ${url}`);
 return response;
}
for(const id of new Set(ids)){
 if(registry.some(font=>font.id===`google-fonts:${id}`)){console.log(`${id}: already pinned; skipped`);continue;}
 const staticBase=`https://cdn.jsdelivr.net/npm/@fontsource/${id}@${version}`;
 const metadata=await (await download(`${staticBase}/metadata.json`)).json();
 const packageName=`@fontsource${metadata.variable?'-variable':''}/${id}`;
 const base=`https://cdn.jsdelivr.net/npm/${packageName}@${version}`;
 const metadataUrl=`${base}/metadata.json`;
 const pinnedMetadata=metadata.variable?await (await download(metadataUrl)).json():metadata;
 if(!pinnedMetadata.weights.includes(400) || !pinnedMetadata.subsets.includes('latin') || !pinnedMetadata.styles.includes('normal'))throw new Error(`Unsupported specimen: ${id}`);
 const license=await (await download(`${base}/LICENSE`)).text();
 if(pinnedMetadata.license.type!=='OFL-1.1' || !/SIL OPEN FONT LICENSE/i.test(license))throw new Error(`Unexpected license: ${id}`);
 const weights=pinnedMetadata.variable?[400]:pinnedMetadata.weights;
 const assets=await Promise.all(weights.map(async weight=>{
  const filename=pinnedMetadata.variable?`${id}-latin-wght-normal.woff2`:`${id}-latin-${weight}-normal.woff2`;
  const assetUrl=`${base}/files/${filename}`;
  const bytes=Buffer.from(await (await download(assetUrl)).arrayBuffer());
  if(bytes.subarray(0,4).toString()!=='wOF2')throw new Error(`Invalid WOFF2: ${assetUrl}`);
  const url=`/nuance/fonts/specimens/${id}-${version}-latin-${weight===400?'':`${weight}-`}normal.woff2`;
  files.push([new URL('../public'+url,import.meta.url),bytes]);
  return {weight,url,assetUrl,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
 }));
 const primary=assets.find(asset=>asset.weight===400);
 const additionalFaces=assets.filter(asset=>asset!==primary);
 const noticeUrl=`/nuance/fonts/specimens/${id}-LICENSE.txt`;
 additions.push({id:`google-fonts:${id}`,family:pinnedMetadata.family,classification:pinnedMetadata.category,source:'google-fonts',sourceLabel:'Google Fonts',
  availableWeights:pinnedMetadata.weights,availableStyles:pinnedMetadata.styles,variable:!!pinnedMetadata.variable,supportedSubsets:pinnedMetadata.subsets,
  license:{spdx:pinnedMetadata.license.type,url:pinnedMetadata.license.url,attribution:pinnedMetadata.license.attribution,noticeUrl},
  loading:{family:`Nuance Specimen ${pinnedMetadata.family}`,url:primary.url,format:'woff2',subset:'latin',style:'normal',
   weight:pinnedMetadata.variable?`${pinnedMetadata.variable.wght.min} ${pinnedMetadata.variable.wght.max}`:'400',display:'swap',specimenWeight:400,
   ...(additionalFaces.length?{additionalFaces}:{})},
  upstream:{package:packageName,packageVersion:version,fontVersion:pinnedMetadata.version,assetUrl:primary.assetUrl,metadataUrl,licenseUrl:`${base}/LICENSE`,sha256:primary.sha256,bytes:primary.bytes}});
 files.push([new URL('../public'+noticeUrl,import.meta.url),license]);
 files.push([new URL(`../src/nuance/data/typefaces/v1/${id}-metadata.json`,import.meta.url),JSON.stringify(pinnedMetadata,null,2)+'\n']);
 console.log(`${pinnedMetadata.family}: prepared ${assets.length} face(s), ${assets.reduce((total,asset)=>total+asset.bytes,0)} bytes`);
}
for(const [url,content] of files)await writeFile(url,content);
await writeFile(registryUrl,JSON.stringify([...registry,...additions],null,2)+'\n');
console.log(`Registry: ${registry.length+additions.length} families`);
