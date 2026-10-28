import { test } from "node:test";
import assert from "node:assert/strict";
import { createComposition, normalizeHex, updateColor } from "../src/nuance/domain/composition";
import { addColor, computeLayout, MIN_EXTENT, paintedRect, removeColor, resizeSplit } from "../src/nuance/domain/layout";
import { discoverPalettes, generatePalettes, initialPalettes, legacyInitialPalettes, nextColor, PRESET_HEXES } from "../src/nuance/domain/palettes";
import { deserializeComposition, serializeComposition } from "../src/nuance/domain/serialization";
import { activeComposition, createEditorState, editorReducer } from "../src/nuance/state/editor";
import { drawComposition } from "../src/nuance/export/png";

const fixture = () => createComposition(PRESET_HEXES[0], "Test composition");
function valid(composition: ReturnType<typeof fixture>) {
  assert.deepEqual(deserializeComposition(serializeComposition(composition)), composition);
  const { regions } = computeLayout(composition.layout);
  assert.equal(regions.length, composition.colors.length);
  assert.ok(Math.abs(regions.reduce((s, r) => s + r.width * r.height, 0) - 1) < 1e-10);
  for (const a of regions) {
    assert.ok(a.width >= MIN_EXTENT - 1e-10 && a.height >= MIN_EXTENT - 1e-10);
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.width <= 1 + 1e-10 && a.y + a.height <= 1 + 1e-10);
    for (const b of regions) if (a !== b) assert.ok(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) < 1e-10 || Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) < 1e-10);
    const rect = paintedRect(a, composition.artwork); assert.ok(rect.width > 0 && rect.height > 0);
  }
}
test("initial presets preserve the exact Figma HEX values and 50/25/25 split", () => {
  assert.deepEqual(legacyInitialPalettes().map(p => p.colors.map(c => c.hex)), PRESET_HEXES);
  assert.deepEqual(computeLayout(fixture().layout).regions.map(r => r.width * r.height), [0.5, 0.25, 0.25]);
});
test("HEX validation accepts shorthand and rejects malformed or alpha colors", () => {
  assert.equal(normalizeHex(" abc "), "#AABBCC"); assert.equal(normalizeHex("#12abEF"), "#12ABEF");
  for (const value of ["", "#12345", "#abcdef00", "xyz", "red"]) assert.equal(normalizeHex(value), null);
});
test("adding colors yields 50/25/12.5/12.5, preserves IDs, and stops at six", () => {
  const start = fixture(); let c = addColor(start, "#123456");
  assert.deepEqual(computeLayout(c.layout).regions.map(r => r.width * r.height), [0.5, 0.25, 0.125, 0.125]);
  assert.deepEqual(c.colors.slice(0, 3).map(c => c.id), start.colors.map(c => c.id));
  c = addColor(addColor(c, "#567890"), "#ABCDEF"); valid(c);
  assert.equal(c.colors.length, 6); assert.equal(addColor(c, "#777777"), c);
});
test("every leaf can be removed without gaps, overlaps, or stale colors", () => {
  let c = fixture(); for (let i = 0; i < 3; i++) c = addColor(c, nextColor(c));
  for (const color of c.colors) { const next = removeColor(c, color.id); valid(next); assert.equal(next.colors.length, 5); assert.ok(!next.colors.some(v => v.id === color.id)); }
  assert.equal(removeColor(fixture(), "missing" ).colors.length, 3);
});
test("all dividers clamp extreme drags and preserve partition geometry after additions and removals", () => {
  let c = fixture();
  for (let i = 0; i < 3; i++) c = addColor(c, nextColor(c));
  for (let round = 0; round < 100; round++) {
    for (const divider of computeLayout(c.layout).dividers) { c = resizeSplit(c, divider.id, round % 2 ? -10 : 10); valid(c); }
  }
  for (let i = 0; i < 3; i++) { c = removeColor(c, c.colors[i % c.colors.length].id); valid(c); }
  assert.equal(resizeSplit(c, c.layout.id, NaN), c);
});
test("generated suggestions replace rather than append, remain distinct, and avoid the previous set", () => {
  let previous = initialPalettes();
  for (let n = 0; n < 100; n++) {
    const next = generatePalettes(previous); assert.equal(next.length, 3);
    assert.equal(new Set(next.map(p => p.colors.map(c => c.hex).join())).size, 3);
    for (const p of next) { valid(p); assert.ok(previous.every(old => old.colors.map(c => c.hex).join() !== p.colors.map(c => c.hex).join())); }
    previous = next;
  }
});
test("editor navigation retains drafts, protects original palettes, and keeps theme independent", () => {
  let state = createEditorState(); const original = JSON.stringify(state.suggestions[0]); const palette = state.suggestions[0];
  state = editorReducer(state, { type: "select-palette", palette }); const draftId = activeComposition(state)!.id;
  const colorId = activeComposition(state)!.colors[0].id;
  state = editorReducer(state, { type: "color", colorId, hex: "#0000FF" });
  const edited = serializeComposition(activeComposition(state)!);
  state = editorReducer(state, { type: "theme" }); assert.equal(serializeComposition(activeComposition(state)!), edited);
  state = editorReducer(state, { type: "back" }); state = editorReducer(state, { type: "select-palette", palette });
  assert.equal(activeComposition(state)!.id, draftId); assert.equal(activeComposition(state)!.colors[0].hex, "#0000FF");
  assert.equal(JSON.stringify(state.suggestions[0]), original); assert.equal(state.preferences.theme, "light");
  state = editorReducer(state, { type: "explore", suggestions: generatePalettes(state.suggestions) });
  assert.equal(state.suggestions.length, 3); assert.ok(Object.values(state.drafts).some(c => c.id === draftId));
});
test("documents round-trip with all IDs, geometry and exact colors intact", () => {
  let c = addColor(fixture(), "#112233"); c = resizeSplit(c, c.layout.id, 0.63); c = updateColor(c, c.colors[0].id, "#DEF");
  assert.deepEqual(deserializeComposition(serializeComposition(c)), c);
  const bad = JSON.parse(serializeComposition(c)); bad.schemaVersion = 2; assert.throws(() => deserializeComposition(JSON.stringify(bad)));
  bad.schemaVersion = 1; bad.layout.ratio = 0; assert.throws(() => deserializeComposition(JSON.stringify(bad)));
  bad.layout.ratio = 0.5; bad.colors[1].id = bad.colors[0].id; assert.throws(() => deserializeComposition(JSON.stringify(bad)));
});
test("PNG artwork uses the shared geometry and contains only palette fills", () => {
  const c = fixture(); const calls: { color: string; rect: number[] }[] = [];
  const context = { fillStyle: "", clearRect() {}, fillRect(...rect: number[]) { calls.push({ color: this.fillStyle, rect }); } };
  drawComposition(context as unknown as CanvasRenderingContext2D, c);
  assert.deepEqual(calls, [
    { color: "#196AAC", rect: [0, 0, 246, 300] },
    { color: "#CDC5B4", rect: [254, 0, 246, 146] },
    { color: "#B59DA4", rect: [254, 154, 246, 146] },
  ]);
});

import { WADA_COLORS, WADA_PALETTES, discoverWada, historicalComposition, editorComposition, resetHistoricalComposition } from "../src/nuance/domain/wada";
import { isAdaptation, paletteAttribution } from "../src/nuance/domain/composition";
import { hexToOklab, oklchToHex, perceptualDistance, suggestExtension } from "../src/nuance/domain/extension";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

test("vendored source preserves its pinned bytes, 159 colors, and all 348 ordered historical combinations", () => {
  const raw = readFileSync('src/nuance/data/sanzo-wada/v1/colors.json');
  assert.equal(createHash('sha256').update(raw).digest('hex'), '555f11c32eb8133078fd470dd7d5320533aaa8b636f12fa06a8dd3d0ee2703b4');
  assert.equal(WADA_COLORS.length,159); assert.equal(WADA_PALETTES.length,348);
  assert.deepEqual(WADA_PALETTES.map(p=>p.combinationNumber),Array.from({length:348},(_,i)=>i+1));
  for (const p of WADA_PALETTES) {
    assert.equal(p.paletteId,`sanzo-wada-${p.combinationNumber}`);
    const expected = WADA_COLORS.filter(c=>c.combinations.includes(p.combinationNumber));
    assert.deepEqual(p.colors.map(c=>[c.name,c.hex]),expected.map(c=>[c.name,c.hex]));
    assert.ok(p.originalColorCount>=2 && p.originalColorCount<=4);
    const c=historicalComposition(p); valid(c);
    assert.equal(c.currentColorCount,p.originalColorCount);
    assert.ok(c.colors.every(color=>color.origin==='original'));
    assert.ok(!isAdaptation(c));
  }
  assert.ok(Object.isFrozen(WADA_COLORS[0].rgb));
  assert.ok(Object.isFrozen(WADA_PALETTES[0].colors[0]));
  assert.throws(()=>{ (WADA_PALETTES[0].colors[0] as {hex:string}).hex='#000000'; });
});
test("Wada discovery shows three distinct historical palettes and excludes the entire previous set", () => {
  let previous = initialPalettes();
  for(let i=0;i<200;i++) {
    const next=discoverPalettes(previous,()=>i%2 ? 0 : 0.999999);
    assert.equal(new Set(next.map(p=>p.id)).size,3);
    for(const p of next) {
      assert.equal(p.source,'sanzo-wada'); assert.ok(!previous.some(old=>old.id===p.id));
      assert.equal(p.colors.length,p.historical!.originalColorCount);
      assert.ok(p.colors.every(c=>c.origin==='original'));
    }
    previous=next;
  }
  assert.ok(discoverPalettes([],()=>0.5,'procedural').every(p=>!p.historical));
});
test("all historical combinations extend deterministically to six distinct sRGB colors without mutating history", () => {
  const snapshot=JSON.stringify(WADA_PALETTES);
  const strategies=new Set<string>();
  for(const reference of WADA_PALETTES) {
    const historical=historicalComposition(reference);
    let c=editorComposition(historical);
    assert.ok(c.colors.length>=3); valid(c);
    if(reference.originalColorCount===2) {
      assert.equal(c.colors[2].origin,'generated');
      assert.equal(c.colors[2].name,'Nuance-generated extension');
      assert.ok(paletteAttribution(c).startsWith('Based on Sanzo Wada'));
      assert.deepEqual(computeLayout(c.layout).regions.map(r=>r.width*r.height),[0.5,0.25,0.25]);
      assert.ok(c.colors.slice(0,2).every(color=>perceptualDistance(hexToOklab(color.hex),hexToOklab(c.colors[2].hex))>=0.0649));
      assert.equal(c.colors[2].hex,editorComposition(historicalComposition(reference)).colors[2].hex);
    }
    while(c.colors.length<6) {
      const suggestion=suggestExtension(c); strategies.add(suggestion.strategy);
      assert.deepEqual(suggestion,suggestExtension(JSON.parse(JSON.stringify(c))));
      assert.match(suggestion.hex,/^#[0-9A-F]{6}$/);
      for(const color of c.colors) assert.ok(perceptualDistance(hexToOklab(suggestion.hex),hexToOklab(color.hex))>=0.0649,`${reference.paletteId}: ${suggestion.hex} vs ${color.hex}`);
      c=addColor(c,suggestion.hex); valid(c);
      assert.equal(c.colors.at(-1)!.origin,'generated');
      assert.equal(c.currentColorCount,c.colors.length);
    }
    assert.equal(addColor(c,'#ABCDEF'),c);
    assert.deepEqual(c.colors.slice(0,reference.originalColorCount).map(c=>c.hex),reference.colors.map(c=>c.hex.toUpperCase()));
    assert.equal(c.historical,reference);
    for(const color of c.colors) valid(removeColor(c,color.id));
    const originalSnapshot=JSON.stringify(reference);
    c=updateColor(c,c.colors[0].id,'#010203');
    assert.equal(c.colors[0].origin,'user');
    assert.equal(c.colors[0].originalHex,reference.colors[0].hex);
    assert.equal(JSON.stringify(reference),originalSnapshot);
    const reset=resetHistoricalComposition(c); valid(reset);
    assert.equal(reset.id,c.id); assert.equal(reset.createdAt,c.createdAt);
    assert.deepEqual(reset.colors.map(c=>c.hex),editorComposition(historical).colors.map(c=>c.hex));
    assert.equal(isAdaptation(reset),reference.originalColorCount===2);
  }
  assert.ok(strategies.size>=3,`Expected strategy variation, saw ${[...strategies]}`);
  assert.equal(JSON.stringify(WADA_PALETTES),snapshot);
});
test("extension uses current edited colors, respects muted palettes, and converts known OKLab values", () => {
  const red=hexToOklab('#FF0000');
  assert.ok(Math.abs(red.l-0.627955)<0.00001);
  assert.ok(Math.abs(red.a-0.224863)<0.00001);
  assert.ok(Math.abs(red.b-0.125846)<0.00001);
  assert.equal(oklchToHex(red.l,Math.hypot(red.a,red.b),Math.atan2(red.b,red.a)*180/Math.PI),'#FF0000');
  const c=fixture();
  const edited=c.colors.reduce((doc,color,i)=>updateColor(doc,color.id,['#685E58','#90988C','#D3C7B2'][i]),c);
  assert.notEqual(nextColor(c),nextColor(edited));
  const lab=hexToOklab(nextColor(edited)); assert.ok(Math.hypot(lab.a,lab.b)<0.08);
  for(const colors of [['#000000','#000000','#000000'],['#FFFFFF','#FFFFFF','#FFFFFF'],['#FF0000','#00FF00','#0000FF']]) {
    let c=createComposition(colors,'Edge case','edge');
    while(c.colors.length<6) {
      const hex=nextColor(c); assert.match(hex,/^#[0-9A-F]{6}$/);
      assert.ok(c.colors.every(color=>perceptualDistance(hexToOklab(hex),hexToOklab(color.hex))>=0.0649));
      c=addColor(c,hex);
    }
  }
});
test("historical editor reset restores original colors/proportions and retains reference across navigation", () => {
  const palette=historicalComposition(WADA_PALETTES.find(p=>p.originalColorCount===4)!);
  let state=createEditorState(); state=editorReducer(state,{type:'select-palette',palette});
  let c=activeComposition(state)!;
  const originalId=c.id;
  state=editorReducer(state,{type:'resize',splitId:c.layout.id,ratio:0.6});
  assert.ok(isAdaptation(activeComposition(state)!));
  state=editorReducer(state,{type:'select-color',colorId:c.colors[0].id});
  state=editorReducer(state,{type:'remove'});
  assert.ok(isAdaptation(activeComposition(state)!));
  state=editorReducer(state,{type:'reset'}); c=activeComposition(state)!;
  assert.equal(c.id,originalId); assert.equal(c.colors.length,4); assert.ok(!isAdaptation(c));
  assert.deepEqual(computeLayout(c.layout).regions.map(r=>r.width*r.height),[0.5,0.25,0.125,0.125]);
  assert.equal(state.selectedColorId,null); valid(c);
  for(let i=0;i<3;i++) {
    c=addColor(editorComposition(historicalComposition(WADA_PALETTES[i])), '#111111');
    const calls:string[]=[];
    drawComposition({fillStyle:'',clearRect(){},fillRect(){calls.push(this.fillStyle);}} as unknown as CanvasRenderingContext2D,c);
    assert.deepEqual(calls,c.colors.map(color=>color.hex));
  }
});
test("serialization preserves provenance, supports older documents, and rejects forged historical metadata", () => {
  const c=editorComposition(historicalComposition(WADA_PALETTES[0])); valid(c);
  const reordered=JSON.parse(serializeComposition(c));
  reordered.historical=Object.fromEntries(Object.entries(reordered.historical).reverse());
  reordered.historical.colors=reordered.historical.colors.map((color:Record<string,unknown>)=>Object.fromEntries(Object.entries(color).reverse()));
  assert.deepEqual(deserializeComposition(JSON.stringify(reordered)),c);
  const legacy=JSON.parse(serializeComposition(fixture())); delete legacy.currentColorCount;
  assert.deepEqual(deserializeComposition(JSON.stringify(legacy)),legacy);
  for(const mutate of [
    (v:any)=>{v.historical.colors[0].hex='#000000';},
    (v:any)=>{v.colors[0].origin='generated';},
    (v:any)=>{v.colors[0].hex='#000000';},
    (v:any)=>{v.currentColorCount=6;},
    (v:any)=>{v.extensionIndex=-1;},
    (v:any)=>{v.source='other';},
  ]) {
    const bad=JSON.parse(serializeComposition(c)); mutate(bad);
    assert.throws(()=>deserializeComposition(JSON.stringify(bad)));
  }
});
