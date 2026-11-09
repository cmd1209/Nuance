import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { WERNER_COLORS, WERNER_PROVENANCE, wernerColor } from "../src/nuance/domain/werner";
import { candidateSignature, generateWernerBatch, paletteDistance, WERNER_METHODS, type WernerCandidate, type WernerBatch } from "../src/nuance/domain/werner-generation";
import { hexToOklab, perceptualDistance } from "../src/nuance/domain/extension";
import { appendAlternatives, exportCuration, importCuration, initialCuration, mergeProgress, reviewCandidate, validateCuration } from "../src/nuance/dev/werner/curation";
import { candidatePreview } from "../src/nuance/dev/werner/preview";
import { computeLayout } from "../src/nuance/domain/layout";
import initial from "../src/nuance/dev/werner/initial-batch.json";
const batch = initial as {batch:WernerBatch; candidates:WernerCandidate[]};
const fixture = () => initialCuration(structuredClone(batch));

test("Werner source contains exactly 110 immutable numbered historical colors with pinned provenance", () => {
  assert.equal(WERNER_COLORS.length,110);
  assert.equal(new Set(WERNER_COLORS.map(color=>color.id)).size,110);
  WERNER_COLORS.forEach((color,index)=>{
    assert.equal(color.number,index+1); assert.equal(color.id,`werner-${String(index+1).padStart(3,'0')}`);
    assert.match(color.hex,/^#[0-9A-F]{6}$/); assert.equal(color.source,"werner-1821");
    assert.ok(color.name && color.family); assert.ok(Object.isFrozen(color) && Object.isFrozen(color.references));
  });
  assert.ok(Object.isFrozen(WERNER_COLORS));
  assert.equal(wernerColor('werner-001').name,'Snow White'); assert.equal(wernerColor('werner-001').hex,'#F1E9CD');
  assert.equal(wernerColor('werner-110').name,'Blackish Brown');
  assert.equal(WERNER_PROVENANCE.hexTableLicense,'CC0-1.0'); assert.equal(WERNER_PROVENANCE.edition,1821);
  assert.equal(createHash('sha256').update(JSON.stringify(WERNER_COLORS)).digest('hex'),WERNER_PROVENANCE.normalizedSha256);
  assert.throws(()=>wernerColor('fictional'));
});
test("fixed seed reproduces the complete checked-in 200-candidate batch and stable identities", () => {
  assert.deepEqual(generateWernerBatch(batch.batch.seed),batch);
  assert.equal(batch.candidates.length,200);
  assert.deepEqual([2,3,4].map(n=>batch.candidates.filter(c=>c.colorIds.length===n).length),[50,100,50]);
  assert.deepEqual(WERNER_METHODS.map(m=>batch.candidates.filter(c=>c.method===m).length),[50,50,50,50]);
  assert.equal(new Set(batch.candidates.map(c=>c.id)).size,200);
  assert.equal(new Set(batch.candidates.map(candidateSignature)).size,200);
  assert.equal(new Set(batch.candidates.flatMap(c=>c.colorIds)).size,110);
  for(const candidate of batch.candidates) {
    assert.equal(candidate.status,'pending'); assert.equal(candidate.curation,'nuance-generated');
    const labs=candidate.colorIds.map(id=>hexToOklab(wernerColor(id).hex));
    labs.forEach((lab,index)=>labs.slice(index+1).forEach(other=>assert.ok(perceptualDistance(lab,other)>=0.065)));
  }
  for(let i=0;i<batch.candidates.length;i++)for(let j=i+1;j<batch.candidates.length;j++)assert.ok(paletteDistance(batch.candidates[i].colorIds,batch.candidates[j].colorIds)>=0.04);
});
test("generator supports custom distributions, distinct seeds, and input validation", () => {
  const counts={2:2,3:3,4:1};
  const first=generateWernerBatch('custom-a',counts), second=generateWernerBatch('custom-b',counts);
  assert.deepEqual(first,generateWernerBatch('custom-a',counts));
  assert.notDeepEqual(first,second); assert.deepEqual([2,3,4].map(n=>first.candidates.filter(c=>c.colorIds.length===n).length),[2,3,1]);
  assert.throws(()=>generateWernerBatch(''));assert.throws(()=>generateWernerBatch('x',{2:-1,3:0,4:0}));
  assert.throws(()=>generateWernerBatch('x',{2:501,3:0,4:0}));
});
test("alternatives append fresh candidates and preserve original reviews and ordering", () => {
  const original=reviewCandidate(reviewCandidate(fixture(),batch.candidates[0].id,'approved'),batch.candidates[1].id,'rejected');
  const result=generateWernerBatch('test-alternatives',{2:10,3:20,4:10},original.candidates);
  const combined=appendAlternatives(original,result);
  assert.equal(combined.candidates.length,240);assert.deepEqual(combined.candidates.slice(0,200),original.candidates);
  assert.equal(new Set(combined.candidates.map(candidateSignature)).size,240);
  assert.deepEqual(result,generateWernerBatch('test-alternatives',{2:10,3:20,4:10},original.candidates));
  assert.throws(()=>appendAlternatives(combined,result));
});
test("progress exports round-trip reviews and generation metadata; approved exports contain only real approved source references", () => {
  let state=reviewCandidate(fixture(),batch.candidates[0].id,'approved');state=reviewCandidate(state,batch.candidates[1].id,'rejected');
  const progress=exportCuration(state);assert.deepEqual(importCuration(progress),state);
  const approved=JSON.parse(exportCuration(state,true));assert.equal(approved.candidates.length,1);assert.equal(approved.candidates[0].status,'approved');
  assert.deepEqual(approved.reviewGroups.approved,[batch.candidates[0].id]);assert.equal(approved.reviewGroups.rejected.length,0);
  assert.deepEqual(new Set(approved.source.colors.map(c=>c.id)),new Set(batch.candidates[0].colorIds));
  assert.throws(()=>importCuration(JSON.stringify(approved)));
  state=reviewCandidate(state,batch.candidates[0].id,'pending');assert.equal(state.candidates[0].status,'pending');
});
test("invalid storage documents fail closed instead of silently dropping review progress", () => {
  const state=fixture();assert.throws(()=>importCuration('{broken'));
  for(const mutate of [
    data=>{data.schemaVersion=2;}, data=>{data.candidates[0].colorIds[0]='invented';},
    data=>{data.candidates[0].status='maybe';},data=>{data.candidates.push(data.candidates[0]);},
    data=>{data.candidates[0].seed='changed';},data=>{data.batches[0].counts[2]=0;},
    data=>{data.candidates[0].id='changed';},data=>{data.source.normalizedSha256='changed';},
  ]) { const data=JSON.parse(exportCuration(state));mutate(data);assert.throws(()=>importCuration(JSON.stringify(data))); }
  assert.deepEqual(validateCuration(state),state);
});
test("import merge preserves explicit local decisions while restoring imported pending reviews", () => {
  const local=reviewCandidate(fixture(),batch.candidates[0].id,'approved');
  const incoming=reviewCandidate(reviewCandidate(fixture(),batch.candidates[0].id,'rejected'),batch.candidates[1].id,'approved');
  const merged=mergeProgress(local,incoming);assert.equal(merged.candidates[0].status,'approved');assert.equal(merged.candidates[1].status,'approved');
});
test("Werner previews reuse standard geometry without Wada metadata or generated colors", () => {
  for(const count of [2,3,4]) {
    const candidate=batch.candidates.find(c=>c.colorIds.length===count)!;
    const preview=candidatePreview(candidate);
    assert.equal(preview.colors.length,count);assert.equal(preview.historical,undefined);assert.equal(preview.source,undefined);
    assert.deepEqual(preview.colors.map(c=>c.hex),candidate.colorIds.map(id=>wernerColor(id).hex));
    assert.deepEqual(computeLayout(preview.layout).regions.map(r=>r.width*r.height),count===2?[.5,.5]:count===3?[.5,.25,.25]:[.5,.25,.125,.125]);
  }
});
