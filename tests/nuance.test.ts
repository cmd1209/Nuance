import { applicationReducer, createApplicationState } from "../src/nuance/state/application";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createComposition, normalizeHex, updateColor } from "../src/nuance/domain/composition";
import { addColor, colorProportions, computeLayout, MIN_EXTENT, paintedRect, removeColor, resizeSplit } from "../src/nuance/domain/layout";
import { discoverPalettes, generatePalettes, initialPalettes, legacyInitialPalettes, nextColor, PRESET_HEXES, shuffledPalettes } from "../src/nuance/domain/palettes";
import { deserializeComposition, serializeComposition } from "../src/nuance/domain/serialization";
import { activeComposition, createEditorState, editorReducer, hasUnsavedChanges } from "../src/nuance/state/editor";
import { drawComposition } from "../src/nuance/export/png";
import { readSavedComposition } from "../src/nuance/account/repository";
import { authReturnUrl, readAuthReturn, validatePassword, MIN_PASSWORD_LENGTH } from "../src/nuance/account/emailAuth";
import { canSaveComposition, MAX_SAVED_COMPOSITIONS } from "../src/nuance/account/compositionLimit";
import { SOURCE_LIBRARY_LIMITS } from "../src/nuance/domain/categories";

const fixture = () => createComposition(PRESET_HEXES[0], "Test composition");

test("eight saved compositions blocks new documents while allowing edits and a replacement after deletion", () => {
  assert.equal(MAX_SAVED_COMPOSITIONS, 8);
  assert.deepEqual(SOURCE_LIBRARY_LIMITS, { colors:8, types:8, spaces:4, details:4 });
  const saved = Array.from({ length: MAX_SAVED_COMPOSITIONS }, (_, index) => ({ id: `saved-${index}` }));
  assert.equal(canSaveComposition(saved, "new"), false);
  assert.equal(canSaveComposition(saved, "saved-0"), true);
  assert.equal(canSaveComposition(saved.slice(1), "new"), true);
});

test("password creation enforces minimum length and matching confirmation without trimming passwords", () => {
  const password = "a".repeat(MIN_PASSWORD_LENGTH);
  assert.doesNotThrow(() => validatePassword(password, password));
  assert.throws(() => validatePassword(password.slice(1), password.slice(1)), /at least/);
  assert.throws(() => validatePassword(password, password + "x"), /do not match/);
  assert.throws(() => validatePassword(` ${password}`, password), /do not match/);
  assert.doesNotThrow(() => validatePassword(` ${password} `, ` ${password} `));
});

test("auth return URLs keep the app origin and path without propagating tokens or unrelated redirects", () => {
  assert.equal(authReturnUrl("recovery", "https://nuance.example/app/?next=https://other.example#access_token=private"), "https://nuance.example/app/?account=recovery");
  assert.equal(authReturnUrl("confirm", "http://localhost:5173/"), "http://localhost:5173/?account=confirm");
});

test("auth callback parsing distinguishes recovery, confirmation, and expired links", () => {
  assert.deepEqual(readAuthReturn("https://nuance.example/?account=recovery#access_token=test&type=recovery"), { kind: "recovery", hasError: false });
  assert.deepEqual(readAuthReturn("https://nuance.example/#type=recovery"), { kind: "recovery", hasError: false });
  assert.deepEqual(readAuthReturn("https://nuance.example/?account=recovery#error=access_denied&error_code=otp_expired"), { kind: "recovery", hasError: true });
  assert.deepEqual(readAuthReturn("https://nuance.example/?account=confirm"), { kind: "confirm", hasError: false });
  assert.deepEqual(readAuthReturn("https://nuance.example/"), { kind: null, hasError: false });
});

test("saved compositions validate cloud documents and reopen without cloning or losing edits", () => {
  const start = fixture();
  const original = updateColor(start, start.colors[0].id, "#654321");
  const saved = readSavedComposition({ id: original.id, document: original, updated_at: new Date().toISOString() });
  let state = editorReducer(createEditorState(), { type: "open-saved", composition: saved.composition });
  assert.deepEqual(activeComposition(state), original);
  const colorId = original.colors[0].id;
  state = editorReducer(state, { type: "color", colorId, hex: "#123456" });
  assert.equal(activeComposition(state)!.id, original.id);
  assert.equal(activeComposition(state)!.colors[0].hex, "#123456");
  state = editorReducer(state, { type: "clear-account" });
  assert.equal(state.view, "palettes");
  assert.deepEqual(state.drafts, {});
  assert.equal(activeComposition(state), undefined);
  assert.throws(() => readSavedComposition({ id: "wrong", document: original, updated_at: new Date().toISOString() }));
  assert.throws(() => readSavedComposition({ id: original.id, document: { ...original, layout: null }, updated_at: new Date().toISOString() }));
});

test("palette browser starts with a balanced batch and keeps its order while editing", () => {
  let state = createEditorState();
  const order = state.suggestions;
  assert.equal(state.suggestions.length, 60);
  assert.equal(state.suggestions.filter(palette => palette.source === "sanzo-wada").length, 30);
  assert.equal(state.suggestions.filter(palette => palette.source === "werner-nuance").length, 30);
  assert.equal(new Set(state.suggestions.map(palette => palette.id)).size, 60);
  const palette = state.suggestions[59];
  state = editorReducer(state, { type: "select-palette", palette });
  const draftId = activeComposition(state)!.id;
  state = editorReducer(state, { type: "back" });
  assert.equal(state.suggestions.length, 60);
  assert.equal(state.activeCompositionId, palette.id);
  state = editorReducer(state, { type: "select-palette", palette });
  assert.equal(activeComposition(state)!.id, draftId);
  const application = applicationReducer(createApplicationState(), { type: "theme" });
  assert.equal(state.suggestions, order);
});

test("palette shuffling changes order without duplicating or altering historical palettes", () => {
  const first = shuffledPalettes(() => 0);
  const second = shuffledPalettes(() => 0.5);
  assert.notDeepEqual(first.map(palette => palette.id), second.map(palette => palette.id));
  assert.notDeepEqual(first.map(palette => palette.id), WADA_PALETTES.map(reference => reference.paletteId));
  for (const palettes of [first, second]) {
    assert.equal(new Set(palettes.map(palette => palette.id)).size, 60);
    for (const palette of palettes.filter(palette => palette.source === "sanzo-wada")) {
      const reference = WADA_PALETTES.find(reference => reference.paletteId === palette.id)!;
      assert.equal(palette.historical, reference);
      assert.deepEqual(palette.colors.map(color => color.hex), reference.colors.map(color => normalizeHex(color.hex)));
    }
  }
});

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
test("color proportions follow resized geometry and survive saving without depending on gutters", () => {
  const initial = fixture();
  const edited = resizeSplit(initial, initial.layout.id, 0.6);
  const shares = colorProportions(edited);
  assert.deepEqual(shares.map(item => item.colorId), edited.colors.map(color => color.id));
  shares.forEach((item, index) => assert.ok(Math.abs(item.proportion - [0.6, 0.2, 0.2][index]) < 1e-10));
  assert.deepEqual(colorProportions(deserializeComposition(serializeComposition(edited))), shares);
  assert.deepEqual(colorProportions({ ...edited, artwork: { width: 1000, height: 800, gap: 20 } }), shares);
  const extended = addColor(edited, "#123456");
  assert.ok(Math.abs(colorProportions(extended).reduce((total, item) => total + item.proportion, 0) - 1) < 1e-10);
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
  const application = applicationReducer(createApplicationState(), { type: "theme" }); assert.equal(serializeComposition(activeComposition(state)!), edited);
  state = editorReducer(state, { type: "back" }); state = editorReducer(state, { type: "select-palette", palette });
  assert.equal(activeComposition(state)!.id, draftId); assert.equal(activeComposition(state)!.colors[0].hex, "#0000FF");
  assert.equal(JSON.stringify(state.suggestions[0]), original); assert.equal(application.theme, "light");
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

test("per-region removal targets its own color independently of selection and respects the minimum", () => {
  let state = createEditorState();
  state = editorReducer(state, { type: "select-palette", palette: state.suggestions.find(palette => palette.colors.length === 3)! });
  const original = activeComposition(state)!;
  const selectedId = original.colors[0].id;
  state = editorReducer(state, { type: "select-color", colorId: selectedId });
  state = editorReducer(state, { type: "add", hex: nextColor(original) });
  state = editorReducer(state, { type: "select-color", colorId: selectedId });
  const before = activeComposition(state)!;
  const removedId = before.colors[1].id;
  state = editorReducer(state, { type: "remove", colorId: removedId });
  const after = activeComposition(state)!;
  assert.equal(after.colors.length, 3);
  assert.equal(state.selectedColorId, selectedId);
  assert.deepEqual(after.colors, before.colors.filter(c => c.id !== removedId));
  assert.equal(after.historical, before.historical);
  valid(after);
  state = editorReducer(state, { type: "remove", colorId: selectedId });
  assert.equal(activeComposition(state), after);
  assert.equal(state.selectedColorId, selectedId);
});

test("Explore and Saved retain their editor origin, drafts, suggestions, and theme", () => {
  let state = createEditorState();
  assert.equal(state.sectionView, "explore");
  const suggestions = state.suggestions;
  const palette = suggestions[0];
  state = editorReducer(state, { type: "select-palette", palette });
  state = editorReducer(state, { type: "color", colorId: activeComposition(state)!.colors[0].id, hex: "#123456" });
  const draft = activeComposition(state)!;
  state = editorReducer(state, { type: "back" });
  assert.equal(state.sectionView, "explore");
  state = editorReducer(state, { type: "section", view: "saved" });
  const application = applicationReducer(createApplicationState(), { type: "theme" });
  state = editorReducer(state, { type: "open-saved", composition: deserializeComposition(serializeComposition(draft)) });
  assert.deepEqual(activeComposition(state), draft);
  const snapshot = serializeComposition(draft);
  state = editorReducer(state, { type: "resize", splitId: draft.layout.id, ratio: 0.64 });
  state = editorReducer(state, { type: "color", colorId: draft.colors[0].id, hex: "#ABCDEF" });
  const edited = activeComposition(state)!;
  assert.equal(edited.id, draft.id);
  assert.equal(serializeComposition(draft), snapshot);
  assert.deepEqual(edited.historical, draft.historical);
  state = editorReducer(state, { type: "back" });
  assert.equal(state.view, "palettes");
  assert.equal(state.sectionView, "saved");
  assert.equal(state.selectedColorId, null);
  assert.equal(state.suggestions, suggestions);
  assert.equal(application.theme, "light");
  state = editorReducer(state, { type: "section", view: "explore" });
  state = editorReducer(state, { type: "select-palette", palette });
  assert.deepEqual(activeComposition(state), edited);
  assert.equal(state.sectionView, "explore");
  state = editorReducer(state, { type: "clear-account" });
  assert.equal(state.sectionView, "explore");
  assert.deepEqual(state.drafts, {});
  assert.equal(application.theme, "light");
});


import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { SectionNavigation } from "../src/nuance/components/SectionNavigation";
import { SavedCompositions } from "../src/nuance/components/SavedCompositions";
import { AccountDialog } from "../src/nuance/components/AccountDialog";
import type { Account } from "../src/nuance/account/useAccount";

function accountFixture(overrides: Partial<Account> = {}): Account {
  return { configured: true, user: { id: "owner", email: "owner@example.com" }, authLoading: false, dataLoading: false,
    error: "", authError: "", recovery: "none", profile: { id: "owner", display_name: "Owner" }, saved: [], ...overrides } as Account;
}
const noop = () => {};
function savedMarkup(account: Account) {
  return renderToStaticMarkup(createElement(SavedCompositions, { account, onOpen: noop, onExplore: noop, onSignIn: noop }));
}

test("Saved renders actual records, accurate previews, accessible actions, and a derived count", () => {
  let composition = editorComposition(historicalComposition(WADA_PALETTES[0]));
  composition = resizeSplit(composition, composition.layout.id, 0.67);
  composition = updateColor(composition, composition.colors[0].id, "#123456");
  const second = fixture();
  const saved = [composition, second].map(item => ({ id: item.id, updatedAt: new Date().toISOString(), composition: item }));
  const markup = savedMarkup(accountFixture({ saved }));
  assert.equal((markup.match(/<article/g) ?? []).length, 2);
  assert.equal((markup.match(/data-delete-composition=/g) ?? []).length, 2);
  assert.match(markup, /2 \/ 8 saved/);
  assert.ok(markup.includes(paletteAttribution(composition)));
  assert.ok(markup.includes(`Delete ${paletteAttribution(composition)}`));
  assert.ok(markup.includes(`Edit ${composition.name}`));
  assert.ok(markup.includes('background:#123456'));
  const rect = paintedRect(computeLayout(composition.layout).regions[0], composition.artwork);
  assert.ok(markup.includes(`width:${rect.width * 100}%`));
  assert.ok(markup.includes(`aspect-ratio:${composition.artwork.width} / ${composition.artwork.height}`));
  const afterDeletion = savedMarkup(accountFixture({ saved: saved.slice(1) }));
  assert.match(afterDeletion, /1 \/ 8 saved/);
  assert.equal((afterDeletion.match(/<article/g) ?? []).length, 1);
});

test("Saved distinguishes empty, signed-out, loading, and error states without placeholder cards", () => {
  const empty = savedMarkup(accountFixture());
  assert.match(empty, /No saved colors yet/); assert.match(empty, /Explore palettes/); assert.match(empty, /0 \/ 8 saved/);
  assert.ok(!empty.includes('<article'));
  const guest = savedMarkup(accountFixture({ user: null }));
  assert.match(guest, /Sign in to see/); assert.ok(!guest.includes('No saved colors yet'));
  const loading = savedMarkup(accountFixture({ dataLoading: true }));
  assert.match(loading, /Loading compositions/); assert.ok(!loading.includes('No saved colors yet'));
  const failed = savedMarkup(accountFixture({ error: "Could not load compositions." }));
  assert.match(failed, /role="alert"/); assert.match(failed, /Try again/); assert.ok(!failed.includes('No saved colors yet'));
});

test("Profile renders account controls without saved compositions or category tabs", () => {
  const markup = renderToStaticMarkup(createElement(AccountDialog, { account: accountFixture(), onClose: noop }));
  for (const label of ["Display name", "owner@example.com", "Reset password", "Sign out", "Save changes"]) assert.ok(markup.includes(label));
  assert.ok(!markup.includes('role="tab'));
  assert.ok(!markup.includes('palette-card'));
  assert.ok(!markup.includes('Back to library'));
});

test("section navigation exposes selected state and supports arrows, Home, and End", () => {
  const markup = renderToStaticMarkup(createElement(SectionNavigation, { value: "saved", onChange: noop, prefix: "color", label: "Color views" }));
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /aria-selected="true" aria-controls="color-saved-panel" tabindex="0"/);
  assert.match(markup, /aria-selected="false" tabindex="-1"/);
  for (const [value, key, expected] of [["explore", "ArrowRight", "saved"], ["saved", "ArrowLeft", "explore"], ["saved", "Home", "explore"], ["explore", "End", "saved"]] as const) {
    let selected = "", focused = "", prevented = false;
    const navigation = SectionNavigation({ value, onChange: next => { selected = next; }, prefix: "color", label: "Color views" });
    navigation.props.onKeyDown({ key, preventDefault() { prevented = true; }, currentTarget: { querySelector(selector: string) { return { focus() { focused = selector; } }; } } });
    assert.equal(selected, expected); assert.equal(prevented, true); assert.equal(focused, `[data-view="${expected}"]`);
  }
});


test("Edit resumes the exact draft after browsing both libraries and Back retains its origin", () => {
  let state = createEditorState();
  assert.equal(editorReducer(state, { type: "resume-editor" }), state);
  const palette = state.suggestions[0];
  state = editorReducer(state, { type: "select-palette", palette });
  state = editorReducer(state, { type: "color", colorId: activeComposition(state)!.colors[0].id, hex: "#123456" });
  const draft = activeComposition(state)!;
  state = editorReducer(state, { type: "section", view: "saved" });
  state = editorReducer(state, { type: "resume-editor" });
  assert.equal(state.view, "editor"); assert.equal(activeComposition(state), draft);
  state = editorReducer(state, { type: "back" });
  assert.equal(state.sectionView, "explore");
  state = editorReducer(state, { type: "open-saved", composition: draft });
  state = editorReducer(state, { type: "resize", splitId: draft.layout.id, ratio: 0.65 });
  const editedSave = activeComposition(state)!;
  state = editorReducer(state, { type: "section", view: "explore" });
  state = editorReducer(state, { type: "resume-editor" });
  assert.equal(activeComposition(state), editedSave);
  state = editorReducer(state, { type: "back" });
  assert.equal(state.sectionView, "saved");
  state = editorReducer(state, { type: "clear-account" });
  assert.equal(editorReducer(state, { type: "resume-editor" }), state);
});

test("Edit appears only with an open draft and participates in keyboard navigation", () => {
  const base = { onChange: noop, prefix: "color", label: "Color views" };
  const initial = renderToStaticMarkup(createElement(SectionNavigation, { ...base, value: "explore" }));
  assert.ok(!initial.includes('data-view="edit"'));
  const editing = renderToStaticMarkup(createElement(SectionNavigation, { ...base, value: "edit", hasDraft: true }));
  assert.match(editing, /data-view="edit" aria-selected="true" aria-controls="color-edit-panel" tabindex="0"/);
  for (const [value, key, expected] of [["saved", "ArrowRight", "edit"], ["edit", "ArrowRight", "explore"], ["explore", "ArrowLeft", "edit"], ["edit", "ArrowLeft", "saved"], ["explore", "End", "edit"], ["edit", "Home", "explore"]] as const) {
    let selected = "", focused = "";
    const navigation = SectionNavigation({ ...base, value, hasDraft: true, onChange: next => { selected = next; } });
    navigation.props.onKeyDown({ key, preventDefault() {}, currentTarget: { querySelector(selector: string) { return { focus() { focused = selector; } }; } } });
    assert.equal(selected, expected); assert.equal(focused, `[data-view="${expected}"]`);
  }
});


import { compositionContent } from "../src/nuance/state/compositionChanges";
import { SwitchCompositionDialog } from "../src/nuance/components/SwitchCompositionDialog";

test("navigation preserves complete working content without ever selecting a default palette", () => {
  let state = createEditorState();
  assert.equal(activeComposition(state), undefined);
  state = editorReducer(state, { type: "resume-editor" });
  assert.equal(state.view, "palettes");
  state = editorReducer(state, { type: "select-palette", palette: state.suggestions[17] });
  assert.equal(hasUnsavedChanges(state), false);
  state = editorReducer(state, { type: "color", colorId: activeComposition(state)!.colors[0].id, hex: "#010203" });
  state = editorReducer(state, { type: "add", hex: "#112233" });
  state = editorReducer(state, { type: "resize", splitId: activeComposition(state)!.layout.id, ratio: 0.63 });
  const working = activeComposition(state)!;
  assert.equal(hasUnsavedChanges(state), true);
  for (const view of ["explore", "saved", "explore", "saved"] as const) {
    state = editorReducer(state, { type: "section", view });
    assert.equal(activeComposition(state), working);
    assert.equal(state.pendingSelection, null);
    state = editorReducer(state, { type: "resume-editor" });
    assert.equal(state.view, "editor");
    assert.equal(activeComposition(state), working);
    assert.equal(hasUnsavedChanges(state), true);
  }
});

test("replacing dirty work requires confirmation for selections from either library", () => {
  for (const kind of ["palette", "saved"] as const) {
    let state = createEditorState();
    const [first, second] = state.suggestions;
    state = editorReducer(state, { type: "select-palette", palette: first });
    const clean = activeComposition(state)!;
    state = editorReducer(state, { type: "color", colorId: clean.colors[0].id, hex: "#123456" });
    const modified = activeComposition(state)!;
    state = editorReducer(state, { type: "section", view: kind === "palette" ? "explore" : "saved" });
    const target = kind === "palette" ? second : fixture();
    const selection = kind === "palette" ? { type: "select-palette" as const, palette: target }
      : { type: "open-saved" as const, composition: target };
    state = editorReducer(state, selection);
    assert.equal(state.pendingSelection?.composition, target);
    assert.equal(activeComposition(state), modified);
    state = editorReducer(state, { type: "cancel-switch" });
    assert.equal(state.pendingSelection, null);
    assert.equal(state.view, "editor");
    assert.equal(activeComposition(state), modified);
    assert.equal(hasUnsavedChanges(state), true);
    state = editorReducer(state, selection);
    state = editorReducer(state, { type: "discard-and-switch" });
    assert.equal(state.pendingSelection, null);
    assert.equal(state.view, "editor");
    assert.equal(hasUnsavedChanges(state), false);
    assert.notEqual(activeComposition(state)!.id, modified.id);
    assert.equal(state.drafts[first.id], clean);
    if (kind === "saved") assert.equal(activeComposition(state), target);
    else assert.deepEqual(activeComposition(state)!.historical, target.historical);
  }
});

test("clean sessions switch immediately and successful saves establish a new baseline", () => {
  let state = createEditorState();
  const [first, second] = state.suggestions;
  state = editorReducer(state, { type: "select-palette", palette: first });
  state = editorReducer(state, { type: "select-palette", palette: second });
  assert.equal(state.pendingSelection, null);
  assert.deepEqual(activeComposition(state)!.historical, second.historical);
  state = editorReducer(state, { type: "color", colorId: activeComposition(state)!.colors[0].id, hex: "#123456" });
  const submitted = activeComposition(state)!;
  state = editorReducer(state, { type: "save-succeeded", composition: submitted });
  assert.equal(hasUnsavedChanges(state), false);
  state = editorReducer(state, { type: "section", view: "saved" });
  state = editorReducer(state, { type: "resume-editor" });
  assert.equal(activeComposition(state), submitted);
  assert.equal(hasUnsavedChanges(state), false);
  state = editorReducer(state, { type: "select-palette", palette: first });
  assert.equal(state.pendingSelection, null);
});

test("dirty detection ignores timestamps, navigation, selection, and restored geometry or colors", () => {
  let state = editorReducer(createEditorState(), { type: "open-saved", composition: fixture() });
  const original = activeComposition(state)!;
  const application = applicationReducer(createApplicationState(), { type: "theme" });
  state = editorReducer(state, { type: "select-color", colorId: original.colors[0].id });
  state = editorReducer(state, { type: "section", view: "explore" });
  state = editorReducer(state, { type: "resume-editor" });
  assert.equal(hasUnsavedChanges(state), false);
  assert.equal(compositionContent(original), compositionContent({ ...original, updatedAt: "2099-01-01T00:00:00.000Z" }));
  state = editorReducer(state, { type: "color", colorId: original.colors[0].id, hex: "#123456" });
  assert.equal(hasUnsavedChanges(state), true);
  state = editorReducer(state, { type: "color", colorId: original.colors[0].id, hex: original.colors[0].hex });
  assert.equal(hasUnsavedChanges(state), false);
  state = editorReducer(state, { type: "resize", splitId: original.layout.id, ratio: 0.67 });
  assert.equal(hasUnsavedChanges(state), true);
  state = editorReducer(state, { type: "resize", splitId: original.layout.id, ratio: 0.5 });
  assert.equal(hasUnsavedChanges(state), false);
  const historical = historicalComposition(WADA_PALETTES.find(p => p.originalColorCount === 3)!);
  state = editorReducer(createEditorState(), { type: "select-palette", palette: historical });
  state = editorReducer(state, { type: "resize", splitId: activeComposition(state)!.layout.id, ratio: 0.67 });
  state = editorReducer(state, { type: "reset" });
  assert.equal(hasUnsavedChanges(state), false);
});

test("saved composition edits retain identity and never mutate the saved snapshot", () => {
  const persisted = fixture();
  const snapshot = serializeComposition(persisted);
  let state = editorReducer(createEditorState(), { type: "open-saved", composition: persisted });
  state = editorReducer(state, { type: "color", colorId: persisted.colors[0].id, hex: "#123456" });
  const modified = activeComposition(state)!;
  assert.equal(modified.id, persisted.id);
  assert.equal(serializeComposition(persisted), snapshot);
  state = editorReducer(state, { type: "section", view: "saved" });
  state = editorReducer(state, { type: "open-saved", composition: persisted });
  assert.equal(state.pendingSelection, null);
  assert.equal(activeComposition(state), modified);
  assert.equal(hasUnsavedChanges(state), true);
  state = editorReducer(state, { type: "save-succeeded", composition: modified });
  assert.equal(activeComposition(state)!.id, persisted.id);
  assert.equal(hasUnsavedChanges(state), false);
  assert.equal(serializeComposition(persisted), snapshot);
});

test("save completion cleans only the submitted snapshot and preserves later edits", () => {
  let state = editorReducer(createEditorState(), { type: "open-saved", composition: fixture() });
  const original = activeComposition(state)!;
  state = editorReducer(state, { type: "color", colorId: original.colors[0].id, hex: "#123456" });
  const submitted = activeComposition(state)!;
  state = editorReducer(state, { type: "color", colorId: original.colors[0].id, hex: "#ABCDEF" });
  const later = activeComposition(state)!;
  state = editorReducer(state, { type: "section", view: "explore" });
  state = editorReducer(state, { type: "save-succeeded", composition: submitted });
  assert.equal(state.view, "palettes");
  assert.equal(activeComposition(state), later);
  assert.equal(hasUnsavedChanges(state), true);
  state = editorReducer(state, { type: "select-palette", palette: state.suggestions[0] });
  state = editorReducer(state, { type: "discard-and-switch" });
  assert.equal(state.drafts[`saved:${original.id}`], submitted);
});

test("switch confirmation uses the existing modal styling and explicit cancel/discard actions", () => {
  const markup = renderToStaticMarkup(createElement(SwitchCompositionDialog, { onCancel: noop, onDiscard: noop }));
  assert.match(markup, /class="account-dialog"/);
  assert.match(markup, /aria-labelledby=/);
  assert.match(markup, /aria-describedby=/);
  assert.match(markup, /Your current composition has unsaved changes. Switch palettes and discard these changes\?/);
  assert.match(markup, />Cancel</);
  assert.match(markup, />Discard &amp; Switch</);
});

import { SectionLayout } from "../src/nuance/components/SectionLayout";
import { Navigation } from "../src/nuance/components/Navigation";

test("shared section layout exposes generic content, labelled heading, and live feedback", () => {
  const markup = renderToStaticMarkup(createElement(SectionLayout, {
    title: "Example section", headingId: "example-heading", description: "Section description", notice: "Changes saved.",
    navigation: createElement("nav", { "aria-label": "Example views" }, "Browse"),
    children: createElement("form", { "aria-label": "Example form" }, "Section content"),
  }));
  assert.match(markup, /<section class="section-layout" aria-labelledby="example-heading">/);
  assert.match(markup, /<h1 id="example-heading" tabindex="-1">Example section<\/h1>/);
  assert.match(markup, /aria-label="Example form"/);
  assert.match(markup, /role="status">Changes saved\./);
  assert.ok(markup.indexOf('Example section') < markup.indexOf('Section description'));
  assert.ok(markup.indexOf('Section description') < markup.indexOf('Section content'));
});

test("global navigation exposes five destinations and identifies one active section", () => {
  const markup = renderToStaticMarkup(createElement(Navigation, { activeSection: "colors" }));
  assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
  assert.equal((markup.match(/disabled=""/g) ?? []).length, 0);
  assert.match(markup, /aria-label="Design exploration"/);
});

import { FoundationSection } from "../src/nuance/components/FoundationSection";
import { DesignsSection } from "../src/nuance/components/DesignsSection";
import { FOUNDATION_SECTIONS } from "../src/nuance/domain/sections";
import { DESIGN_CATEGORIES } from "../src/nuance/domain/categories";

test("application navigation and theme remain independent of a modified Color editing session", () => {
  let application = createApplicationState();
  let color = editorReducer(createEditorState(), { type: "select-palette", palette: historicalComposition(WADA_PALETTES[0]) });
  color = editorReducer(color, { type: "color", colorId: activeComposition(color)!.colors[0].id, hex: "#123456" });
  const snapshot = serializeComposition(activeComposition(color)!);
  for (const section of DESIGN_CATEGORIES) {
    application = applicationReducer(application, { type: "navigate", section: section.id });
    application = applicationReducer(application, { type: "theme" });
    assert.equal(application.activeSection, section.id);
    assert.equal(serializeComposition(activeComposition(color)!), snapshot);
    assert.equal(hasUnsavedChanges(color), true);
    assert.equal(color.view, "editor");
  }
  application = applicationReducer(application, { type: "navigate", section: "colors" });
  assert.equal(application.activeSection, "colors");
  assert.equal(application.theme, "light");
});

test("Spaces and Details retain foundational destinations with contextual Edit unavailable", () => {
  for (const section of ["spaces", "details"] as const) {
    const markup = renderToStaticMarkup(createElement(FoundationSection, { section, hidden: false, onViewChange: noop }));
    assert.ok(markup.includes(FOUNDATION_SECTIONS[section].title));
    assert.ok(markup.includes(FOUNDATION_SECTIONS[section].descriptions.explore));
    assert.ok(markup.includes(FOUNDATION_SECTIONS[section].empty.explore));
    assert.ok(markup.includes(`id="${section}-explore-tab"`));
    assert.ok(markup.includes(`id="${section}-saved-tab"`));
    assert.ok(!markup.includes(`id="${section}-edit-tab"`));
    assert.ok(!markup.includes("palette-card"));
    assert.match(markup, /role="tabpanel"/);
  }
});

function designsMarkup(account: Account) {
  return renderToStaticMarkup(createElement(DesignsSection, { account, hidden: false, onSavedColors: noop,
    onExploreColors: noop, onVisit: noop, onSignIn: noop }));
}

test("Designs presents four ingredients without creative tabs, fake selections, or export controls", () => {
  const markup = designsMarkup(accountFixture());
  assert.match(markup, /Your Design/);
  assert.equal((markup.match(/class="designs-ingredient"/g) ?? []).length, 4);
  assert.match(markup, /No saved palettes yet/);
  assert.match(markup, /Explore colors/);
  assert.ok(!markup.includes('role="tab'));
  assert.ok(!markup.includes('palette-card'));
  assert.ok(!markup.includes('<select'));
  assert.ok(!markup.includes('Export'));
  const guest = designsMarkup(accountFixture({ user: null }));
  assert.match(guest, /Sign in to access your saved palettes/);
  const failed = designsMarkup(accountFixture({ error: "Could not load saved colors." }));
  assert.match(failed, /role="alert"/); assert.match(failed, /Try again/);
});

test("Designs derives available palette names and counts from actual saved records", () => {
  const composition = fixture();
  const markup = designsMarkup(accountFixture({ saved: [{ id: composition.id, updatedAt: composition.updatedAt, composition }] }));
  assert.match(markup, /1 saved palette available/);
  assert.ok(markup.includes(paletteAttribution(composition)));
  assert.match(markup, /View saved colors/);
  assert.ok(!markup.includes('No saved palettes yet'));
});
