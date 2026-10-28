import rawColors from "../data/sanzo-wada/v1/colors.json";
import { createComposition, type Composition, type HistoricalReference } from "./composition";
import { addColor } from "./layout";
import { suggestExtension } from "./extension";

export const WADA_DATASET_VERSION = 1 as const;
// Freeze every level, including raw RGB/LAB/CMYK arrays, so accidental edits fail
// during development instead of silently contaminating future suggestions.
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export const WADA_COLORS = freeze(rawColors);
export const WADA_PALETTES: ReadonlyArray<Readonly<HistoricalReference>> = freeze(
  Array.from({ length: 348 }, (_, i) => {
    const combinationNumber = i + 1;
    const colors = WADA_COLORS.flatMap((color, index) => color.combinations.includes(combinationNumber)
      ? [{ sourceColorId: `wada-color-${index + 1}`, name: color.name, hex: color.hex }] : []);
    if (colors.length < 2 || colors.length > 4) throw new Error(`Invalid Wada combination ${combinationNumber}`);
    return { paletteId: `sanzo-wada-${combinationNumber}`, combinationNumber, datasetVersion: WADA_DATASET_VERSION, originalColorCount: colors.length, colors };
  })
);

export function historicalComposition(reference: HistoricalReference): Composition {
  const composition = createComposition(reference.colors.map(c => c.hex), `Sanzo Wada · No. ${reference.combinationNumber}`, reference.paletteId);
  return { ...composition, source: "sanzo-wada", historical: reference, extensionIndex: 0,
    colors: composition.colors.map((color, index) => ({ ...color, origin: "original", name: reference.colors[index].name,
      originalHex: reference.colors[index].hex, sourceColorId: reference.colors[index].sourceColorId })) };
}
export function editorComposition(composition: Composition): Composition {
  return composition.colors.length === 2 ? addColor(composition, suggestExtension(composition, "complementary").hex) : composition;
}
export function resetHistoricalComposition(composition: Composition): Composition {
  if (!composition.historical) return composition;
  // Resolve against the trusted library rather than treating a draft's snapshot as mutable truth.
  const original = WADA_PALETTES.find(p => p.paletteId === composition.historical!.paletteId);
  if (!original) return composition;
  return { ...editorComposition(historicalComposition(original)), id: composition.id, createdAt: composition.createdAt };
}
export function discoverWada(previous: Composition[] = [], random = Math.random): Composition[] {
  const excluded = new Set(previous.map(p => p.historical?.paletteId ?? p.id));
  const pool = WADA_PALETTES.filter(p => !excluded.has(p.paletteId));
  const selected: Composition[] = [];
  for (let i = 0; i < 3; i++) {
    // Remove each sampled combination: even a constant random source yields three distinct IDs.
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    selected.push(historicalComposition(pool.splice(index, 1)[0]));
  }
  return selected;
}
