import { test } from "node:test";
import assert from "node:assert/strict";
import { createComposition, normalizeHex, updateColor } from "../src/nuance/domain/composition";
import { addColor, computeLayout, MIN_EXTENT, paintedRect, removeColor, resizeSplit } from "../src/nuance/domain/layout";
import { generatePalettes, initialPalettes, nextColor, PRESET_HEXES } from "../src/nuance/domain/palettes";
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
  assert.deepEqual(initialPalettes().map(p => p.colors.map(c => c.hex)), PRESET_HEXES);
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
