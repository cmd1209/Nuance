import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { TYPEFACES, TYPEFACE_REGISTRY_VERSION, selectTypeface, typefaceById, typefaceFamily, typefaceFallback } from "../src/nuance/domain/typefaces";
import { createTypesState, typesReducer } from "../src/nuance/state/types";
import { TypesSection } from "../src/nuance/components/TypesSection";
import { loadSpecimenFont } from "../src/nuance/typography/fontLoading";

const families=['DM Serif Display','Fraunces','Libre Baskerville','Cormorant Garamond','Inter','Manrope','IBM Plex Sans','Space Grotesk'];
test("typeface registry contains the eight requested immutable Google Fonts and accurate source metadata",async()=>{
 assert.equal(TYPEFACES.length,8);assert.equal(new Set(TYPEFACES.map(font=>font.id)).size,8);
 assert.deepEqual(TYPEFACES.map(font=>font.family).sort(),families.sort());assert.equal(TYPEFACES.filter(font=>font.classification==='serif').length,4);
 assert.ok(TYPEFACES.slice(0,4).some(font=>font.classification==='serif')&&TYPEFACES.slice(0,4).some(font=>font.classification==='sans-serif'));
 for(const font of TYPEFACES){
  assert.equal(font.source,'google-fonts');assert.equal(font.sourceLabel,'Google Fonts');assert.ok(Object.isFrozen(font)&&Object.isFrozen(font.loading)&&Object.isFrozen(font.license));
  assert.ok(font.availableWeights.includes(400));assert.ok(font.availableStyles.includes('normal'));assert.ok(font.supportedSubsets.includes('latin'));
  assert.equal(font.loading.style,'normal');assert.equal(font.loading.subset,'latin');assert.equal(font.loading.specimenWeight,400);assert.equal(font.loading.display,'swap');
  assert.match(font.loading.url,/^\/nuance\/fonts\/specimens\/.*\.woff2$/);assert.equal(font.license.spdx,'OFL-1.1');
  const id=font.id.split(':')[1],metadata=JSON.parse(await readFile(`src/nuance/data/typefaces/v1/${id}-metadata.json`,'utf8'));
  assert.equal(font.family,metadata.family);assert.equal(font.classification,metadata.category);assert.equal(font.variable,!!metadata.variable);
  assert.deepEqual(font.availableWeights,metadata.weights);assert.deepEqual(font.availableStyles,metadata.styles);assert.deepEqual(font.supportedSubsets,metadata.subsets);
  assert.ok(typefaceFamily(font).includes(font.loading.family));assert.ok(typefaceFallback(font).endsWith(font.classification==='serif'?'serif':'sans-serif'));
 }
 assert.throws(()=>typefaceById('invented'));assert.ok(Object.isFrozen(TYPEFACES));
});
test("each self-hosted WOFF2 and OFL notice matches its pinned source; only eight needed font files ship",async()=>{
 let total=0;
 for(const font of TYPEFACES){
  const bytes=await readFile('public'+font.loading.url);total+=bytes.length;
  assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(bytes.length,font.upstream.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),font.upstream.sha256);
  const license=await readFile('public'+font.license.noticeUrl,'utf8');assert.match(license,/SIL OPEN FONT LICENSE/i);assert.ok(font.license.attribution.length>0);
  assert.match(font.upstream.assetUrl,new RegExp('@'+font.upstream.packageVersion.replace(/\./g,'\\.')+'/files/'));
 }
 assert.equal((await readdir('public/nuance/fonts/specimens')).filter(file=>file.endsWith('.woff2')).length,8);assert.ok(total<300000);
});
test("Types starts in Explore, enables contextual Edit after selection and preserves it across local navigation",()=>{
 let state=createTypesState();assert.equal(state.view,'explore');assert.equal(state.selection,null);
 assert.equal(typesReducer(state,{type:'view',view:'edit'}),state);
 state=typesReducer(state,{type:'select',fontId:TYPEFACES[0].id});const selected=state.selection;
 assert.equal(state.view,'edit');assert.deepEqual(selected,{fontId:TYPEFACES[0].id,source:'google-fonts',registryVersion:TYPEFACE_REGISTRY_VERSION});
 for(const view of ['saved','explore','edit'] as const){state=typesReducer(state,{type:'view',view});assert.equal(state.selection,selected);}
 state=typesReducer(state,{type:'select',fontId:TYPEFACES[1].id});assert.equal(state.selection?.fontId,TYPEFACES[1].id);assert.equal(state.view,'edit');
 assert.deepEqual(selectTypeface(TYPEFACES[0].id),selected);assert.throws(()=>selectTypeface('missing'));
});
test("Types Explore renders eight named specimen buttons with their own family stacks, no fake saves or initial Edit",()=>{
 const markup=renderToStaticMarkup(createElement(TypesSection,{hidden:false,onViewChange:()=>{},account:{user:null,authLoading:false,dataLoading:false},onSignIn:()=>{}}));
 for(const font of TYPEFACES){assert.ok(markup.includes(`Preview ${font.family}`));assert.ok(markup.includes(font.loading.family));assert.ok(markup.includes(font.family));}
 assert.equal((markup.match(/class="type-specimen__quote-text"/g)||[]).length,8);assert.ok(!markup.includes('id="types-edit-tab"'));assert.ok(!markup.includes('Typography exploration is coming soon'));
 assert.ok(markup.includes('types-explore-panel'));assert.ok(markup.includes('types-saved-panel'));assert.ok(!markup.includes('Save typeface'));
});
test("specimen font loader caches concurrent requests and degrades safely after failures",async()=>{
 const oldFont=Object.getOwnPropertyDescriptor(globalThis,'FontFace'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 let loads=0;const added:unknown[]=[];
 class FakeFontFace {
  constructor(public family:string,public source:string,public descriptors:unknown){}
  async load(){loads++;return this;}
 }
 try{
  Object.defineProperty(globalThis,'FontFace',{value:FakeFontFace,configurable:true});Object.defineProperty(globalThis,'document',{value:{fonts:{add:face=>added.push(face)}},configurable:true});
  const font={...TYPEFACES[0],id:'loader-cache-test'};const first=loadSpecimenFont(font),second=loadSpecimenFont(font);
  assert.equal(first,second);assert.equal(await first,'loaded');assert.equal(loads,1);assert.equal(added.length,1);assert.equal((added[0] as FakeFontFace).family,font.loading.family);
  assert.deepEqual((added[0] as FakeFontFace).descriptors,{weight:font.loading.weight,style:'normal',display:'swap'});
  class FailedFontFace extends FakeFontFace {async load():Promise<this>{throw new Error('Network unavailable');}}
  Object.defineProperty(globalThis,'FontFace',{value:FailedFontFace,configurable:true});assert.equal(await loadSpecimenFont({...font,id:'loader-failure-test'}),'unavailable');assert.equal(added.length,1);
 }finally{
  if(oldFont)Object.defineProperty(globalThis,'FontFace',oldFont);else delete (globalThis as Record<string,unknown>).FontFace;
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete (globalThis as Record<string,unknown>).document;
 }
});

import { canSaveTypeface, MAX_SAVED_TYPEFACES, readSavedTypeface } from "../src/nuance/account/typefaceRepository";
test("saved typefaces resolve canonical family metadata and enforce an independent eight-font allowance",()=>{
 const row={font_id:TYPEFACES[0].id,source:TYPEFACES[0].source,registry_version:1,updated_at:new Date().toISOString()};
 const saved=readSavedTypeface(row);assert.equal(saved.id,TYPEFACES[0].id);assert.equal(saved.typeface,TYPEFACES[0]);assert.deepEqual(saved.selection,{...selectTypeface(TYPEFACES[0].id),fontWeight:400,alphabet:false});
 for(const change of [{font_id:'google-fonts:invented'},{source:'other-library'},{registry_version:2},{updated_at:'invalid'}])assert.throws(()=>readSavedTypeface({...row,...change}));
 assert.equal(MAX_SAVED_TYPEFACES,8);const full=TYPEFACES.map(font=>({id:font.id}));
 assert.equal(canSaveTypeface(full,TYPEFACES[0].id),true);assert.equal(canSaveTypeface(full,'future:font'),false);assert.equal(canSaveTypeface(full.slice(1),'future:font'),true);
 const cleared=typesReducer(typesReducer(createTypesState(),{type:'select',fontId:TYPEFACES[0].id}),{type:'clear-account'});assert.deepEqual(cleared,createTypesState());
});

test("saved specimen settings restore supported weights and alphabet mode, with legacy defaults",()=>{
 const row={font_id:'google-fonts:inter',source:'google-fonts',registry_version:1,updated_at:new Date().toISOString(),font_weight:600,alphabet:true};
 assert.deepEqual(readSavedTypeface(row).selection,{...selectTypeface(row.font_id),fontWeight:600,alphabet:true});
 for(const change of [{font_weight:450},{font_weight:'600'},{font_weight:null},{alphabet:'true'},{alphabet:null},{font_id:TYPEFACES[0].id}])assert.throws(()=>readSavedTypeface({...row,...change}));
 assert.equal(readSavedTypeface({...row,font_weight:100,alphabet:false}).selection.fontWeight,100);
});
