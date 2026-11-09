import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/import-approved-werner.mjs /path/to/werner-nuance-approved.json');
const directory=new URL('../src/nuance/data/werner/v1/',import.meta.url);
const text=await readFile(input,'utf8'), data=JSON.parse(text);
const colors=JSON.parse(await readFile(new URL('colors.json',directory),'utf8'));
const provenance=JSON.parse(await readFile(new URL('provenance.json',directory),'utf8'));
const initial=JSON.parse(await readFile(new URL('../src/nuance/dev/werner/initial-batch.json',import.meta.url),'utf8'));
if(data.format!=='nuance-werner-curation'||data.kind!=='approved'||data.datasetVersion!==1||data.generationVersion!=='werner-oklab-v1'||data.source?.normalizedSha256!==provenance.normalizedSha256||data.candidates?.length!==30)throw new Error('Expected the 30 approved candidates from the verified source dataset.');
const seen=new Set();
for(const candidate of data.candidates){
 const trusted=initial.candidates.find(item=>item.id===candidate.id);
 if(candidate.status!=='approved'||seen.has(candidate.id)||!trusted||JSON.stringify({...candidate,status:'pending'})!==JSON.stringify(trusted))throw new Error(`Unverified or duplicate approved candidate ${candidate.id}`);
 seen.add(candidate.id);
 for(const id of candidate.colorIds){const supplied=data.source.colors.find(color=>color.id===id), original=colors.find(color=>color.id===id);if(JSON.stringify(supplied)!==JSON.stringify(original))throw new Error(`Mismatched historical color ${id}`);}
}
const usedIds=new Set(data.candidates.flatMap(candidate=>candidate.colorIds));
const publishedColors=colors.filter(color=>usedIds.has(color.id));
const palettes=data.candidates.map((candidate,index)=>({...candidate,paletteId:`werner-nuance-${String(index+1).padStart(3,'0')}`,combinationNumber:index+1}));
await writeFile(new URL('approved.json',directory),JSON.stringify({collection:'werner-nuance',version:1,exportedAt:data.exportedAt,exportSha256:createHash('sha256').update(text).digest('hex'),colors:publishedColors,palettes},null,2)+'\n',{flag:'wx'});
await writeFile(new URL('upstream/approved-export.json',directory),text,{flag:'wx'});
console.log(`Imported ${palettes.length} approved palettes, numbered permanently in export order.`);
