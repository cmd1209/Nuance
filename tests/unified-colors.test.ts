import { test } from "node:test";
import assert from "node:assert/strict";
import { COLOR_COLLECTIONS, resetSourceComposition, type PaletteCollection } from "../src/nuance/domain/collections";
import { createDiscoveryCursor, discoverBatch } from "../src/nuance/domain/discovery";
import { curatedWernerComposition, WERNER_PALETTES } from "../src/nuance/domain/werner-palettes";
import { WADA_PALETTES, editorComposition, historicalComposition } from "../src/nuance/domain/wada";
import { cloneComposition, createComposition, isAdaptation, paletteAttribution, updateColor, normalizeHex } from "../src/nuance/domain/composition";
import { serializeComposition, deserializeComposition } from "../src/nuance/domain/serialization";
import { addColor, removeColor, resizeSplit } from "../src/nuance/domain/layout";
import { nextColor } from "../src/nuance/domain/extension";
import { activeComposition, createEditorState, editorReducer, hasUnsavedChanges } from "../src/nuance/state/editor";
import { readSavedComposition } from "../src/nuance/account/repository";
import { canSaveComposition } from "../src/nuance/account/compositionLimit";
import audit from "../src/nuance/data/werner/v1/upstream/approved-export.json";
import approved from "../src/nuance/data/werner/v1/approved.json";

const roundTrip = composition => deserializeComposition(serializeComposition(composition));
function seeded(seed:number){return ()=>{seed=Math.imul(seed,1664525)+1013904223;return (seed>>>0)/4294967296;};}

test("exactly 30 curator-approved Werner palettes retain permanent numbering, order and provenance",()=>{
 assert.equal(WERNER_PALETTES.length,30);assert.equal(audit.candidates.length,30);
 for(let i=0;i<30;i++){
  const reference=WERNER_PALETTES[i],candidate=audit.candidates[i],composition=curatedWernerComposition(reference);
  assert.equal(candidate.status,'approved');assert.equal(reference.candidateId,candidate.id);
  assert.equal(reference.combinationNumber,i+1);assert.equal(reference.paletteId,`werner-nuance-${String(i+1).padStart(3,'0')}`);
  assert.deepEqual(reference.colors.map(color=>color.sourceColorId),candidate.colorIds);
  assert.deepEqual(composition.colors.map(color=>color.hex),candidate.colorIds.map(id=>audit.source.colors.find(color=>color.id===id)!.hex));
  assert.equal(paletteAttribution(composition),`Werner · Nuance No. ${i+1}`);assert.equal(composition.historical,undefined);
  assert.equal(reference.curation,'nuance-generated');assert.equal(reference.seed,candidate.seed);assert.equal(reference.method,candidate.method);
  assert.equal(reference.provenance.normalizedSha256,audit.source.normalizedSha256);assert.ok(Object.isFrozen(reference.colors));
 }
 assert.equal(approved.exportedAt,audit.exportedAt);assert.ok(Object.isFrozen(WERNER_PALETTES));
});
test("balanced discovery exhausts independent cycles, keeps batches unique and never changes palette colors",()=>{
 let cursor=createDiscoveryCursor();const wada:string[]=[],werner:string[]=[];const random=seeded(42);
 for(let batch=0;batch<14;batch++){
  const before=JSON.stringify(cursor),result=discoverBatch(COLOR_COLLECTIONS,cursor,60,random);assert.equal(JSON.stringify(cursor),before);cursor=result.cursor;
  assert.equal(result.palettes.length,60);assert.equal(new Set(result.palettes.map(p=>p.id)).size,60);
  assert.equal(result.palettes.filter(p=>p.source==='sanzo-wada').length,30);assert.equal(result.palettes.filter(p=>p.source==='werner-nuance').length,30);
  for(const palette of result.palettes){
   const reference=palette.historical??palette.curated!;
   assert.deepEqual(palette.colors.map(c=>c.hex),reference.colors.map(c=>normalizeHex(c.hex)));
   (palette.source==='sanzo-wada'?wada:werner).push(palette.id);
  }
 }
 for(let i=0;i+348<=wada.length;i+=348)assert.equal(new Set(wada.slice(i,i+348)).size,348);
 for(let i=0;i<werner.length;i+=30)assert.equal(new Set(werner.slice(i,i+30)).size,30);
 assert.equal(new Set(wada).size,348);
 const sequence=(seed:number)=>{let cursor=createDiscoveryCursor();const random=seeded(seed),ids:string[]=[];for(let i=0;i<3;i++){const r=discoverBatch(COLOR_COLLECTIONS,cursor,60,random);cursor=r.cursor;ids.push(...r.palettes.map(p=>p.id));}return ids;};
 assert.deepEqual(sequence(7),sequence(7));assert.notDeepEqual(sequence(7),sequence(8));
});
test("the same scheduler balances a third collection and redistributes exhausted tiny collections",()=>{
 const collection=(id:string,count:number):PaletteCollection=>({id,palettes:Array.from({length:count},(_,index)=>({id:`${id}-${index}`,create:()=>createComposition(['#112233','#DDEEFF'],'Test',`${id}-${index}`)}))});
 const sources=[collection('one',100),collection('two',40),collection('three',20)];
 const result=discoverBatch(sources,createDiscoveryCursor(),18,()=>0.5);
 for(const source of sources)assert.equal(result.palettes.filter(p=>p.id.startsWith(source.id+'-')).length,6);
 const small=discoverBatch([collection('large',40),collection('tiny',2),collection('empty',0)],createDiscoveryCursor(),12,()=>0);
 assert.equal(small.palettes.length,12);assert.equal(new Set(small.palettes.map(p=>p.id)).size,12);assert.equal(small.palettes.filter(p=>p.id.startsWith('tiny-')).length,2);
 assert.equal(discoverBatch([],createDiscoveryCursor()).palettes.length,0);
});
test("all Werner sources support editing, deterministic pair extension, canonical saving and source reset",()=>{
 for(const reference of WERNER_PALETTES){
  const palette=curatedWernerComposition(reference),initial=editorComposition(cloneComposition(palette));
  assert.deepEqual(initial.colors.slice(0,reference.originalColorCount).map(c=>c.hex),reference.colors.map(c=>normalizeHex(c.hex)));
  assert.deepEqual(roundTrip(initial),initial);assert.deepEqual(initial.curated,reference);
  let edited=updateColor(initial,initial.colors[0].id,'#123456');edited=resizeSplit(edited,edited.layout.id,.62);
  edited=addColor(edited,nextColor(edited));edited=removeColor(edited,edited.colors[edited.colors.length-1].id);
  assert.deepEqual(roundTrip(edited),edited);assert.ok(isAdaptation(edited));assert.match(paletteAttribution(edited),/^Based on Werner · Nuance No\./);
  const saved=readSavedComposition({id:edited.id,document:JSON.parse(serializeComposition(edited)),updated_at:edited.updatedAt});assert.equal(saved.id,initial.id);assert.deepEqual(saved.composition.curated,reference);
  const reset=resetSourceComposition(edited);assert.equal(reset.id,edited.id);assert.equal(reset.createdAt,edited.createdAt);assert.equal(reset.curated,reference);
  assert.deepEqual(reset.colors.map(c=>c.hex),editorComposition(curatedWernerComposition(reference)).colors.map(c=>c.hex));
  assert.equal(nextColor(initial),nextColor({...initial,id:crypto.randomUUID()}));
 }
});
test("Werner persistence rejects forged provenance while retaining legacy Wada and custom documents",()=>{
 const composition=editorComposition(curatedWernerComposition(WERNER_PALETTES[0]));
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,child])=>[key,reorder(child)])):value;
 assert.deepEqual(deserializeComposition(JSON.stringify(reorder(composition))),composition);
 for(const change of [
  value=>{value.curated.colors[0].hex='#000000';},value=>{value.curated.candidateId='unapproved';},
  value=>{value.curated.combinationNumber=999;},value=>{value.curated.curation='historical';},value=>{value.curated.seed='changed';},
  value=>{value.source='sanzo-wada';},value=>{value.curated.provenance.normalizedSha256='changed';},
  value=>{value.colors[0].name='Invented historical name';},value=>{value.historical=WADA_PALETTES[0];},
 ]){const data=JSON.parse(serializeComposition(composition));change(data);assert.throws(()=>deserializeComposition(JSON.stringify(data)));}
 const legacy=historicalComposition(WADA_PALETTES[0]);assert.deepEqual(roundTrip(legacy),legacy);
 const custom=createComposition(['#123456','#ABCDEF'],'Custom');assert.deepEqual(roundTrip(custom),custom);
});
test("cross-source switching, dirty protection, saving baselines, universal quota and loading more retain the workspace",()=>{
 const first=historicalComposition(WADA_PALETTES[0]),second=curatedWernerComposition(WERNER_PALETTES[0]);
 let state=editorReducer(createEditorState(),{type:'select-palette',palette:second});assert.equal(hasUnsavedChanges(state),false);
 state=editorReducer(state,{type:'color',colorId:activeComposition(state)!.colors[0].id,hex:'#123456'});
 const edited=activeComposition(state)!;state=editorReducer(state,{type:'select-palette',palette:first});assert.ok(state.pendingSelection);
 state=editorReducer(state,{type:'cancel-switch'});assert.equal(activeComposition(state),edited);
 for(const view of ['explore','saved'] as const){state=editorReducer(state,{type:'section',view});state=editorReducer(state,{type:'resume-editor'});assert.equal(activeComposition(state),edited);}
 const previous=state.suggestions;state=editorReducer(state,{type:'more-palettes',random:()=>0.5});assert.equal(state.suggestions.length,120);assert.deepEqual(state.suggestions.slice(0,60),previous);assert.equal(activeComposition(state),edited);assert.ok(hasUnsavedChanges(state));
 state=editorReducer(state,{type:'save-succeeded',composition:roundTrip(edited)});assert.equal(hasUnsavedChanges(state),false);
 state=editorReducer(state,{type:'open-saved',composition:roundTrip(edited)});assert.equal(activeComposition(state)!.id,edited.id);
 const full=[{id:edited.id},{id:'wada-save'},...Array.from({length:6},(_,i)=>({id:`other-${i}`}))];assert.equal(canSaveComposition(full,edited.id),true);assert.equal(canSaveComposition(full,'new'),false);
 state=editorReducer(state,{type:'color',colorId:activeComposition(state)!.colors[0].id,hex:'#334455'});state=editorReducer(state,{type:'select-palette',palette:first});state=editorReducer(state,{type:'discard-and-switch'});assert.deepEqual(activeComposition(state)!.historical,first.historical);assert.equal(hasUnsavedChanges(state),false);
});
