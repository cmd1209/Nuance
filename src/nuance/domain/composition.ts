/** The persistence boundary: plain JSON, independent of React, DOM and accounts. */
export type ColorOrigin = "original" | "generated" | "user";
export type ColorValue = { id: string; hex: string; name?: string; origin?: ColorOrigin; originalHex?: string; sourceColorId?: string };
export interface HistoricalReference {
  paletteId: string;
  combinationNumber: number;
  datasetVersion: 1;
  originalColorCount: number;
  colors: ReadonlyArray<Readonly<{ sourceColorId: string; name: string; hex: string }>>;
}
export type LayoutNode =
  | { id: string; kind: "region"; colorId: string }
  | { id: string; kind: "split"; axis: "x" | "y"; ratio: number; first: LayoutNode; second: LayoutNode };

export interface Composition {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  artwork: { width: number; height: number; gap: number };
  colors: ColorValue[];
  layout: LayoutNode;
  source?: "sanzo-wada";
  historical?: HistoricalReference;
  currentColorCount?: number;
  extensionIndex?: number;
  layoutModified?: boolean;
}

export const MIN_COLORS = 3;
export const MAX_COLORS = 6;
export const newId = () => crypto.randomUUID();

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) return "#" + hex.split("").map(c => c + c).join("").toUpperCase();
  return /^[\da-f]{6}$/i.test(hex) ? "#" + hex.toUpperCase() : null;
}

export function createComposition(hexes: string[], name: string, id: string = newId()): Composition {
  if (hexes.length < 2 || hexes.length > 4 || hexes.some(h => !normalizeHex(h))) throw new Error("A starting palette requires two to four valid colors.");
  const colors = hexes.map(hex => ({ id: newId(), hex: normalizeHex(hex)! }));
  const region = (index: number): LayoutNode => ({ id: newId(), kind: "region", colorId: colors[index].id });
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, id, name, createdAt: now, updatedAt: now,
    artwork: { width: 500, height: 300, gap: 8 }, colors, currentColorCount: colors.length,
    layout: { id: newId(), kind: "split", axis: "x", ratio: 0.5, first: region(0),
      second: colors.length === 2 ? region(1) : { id: newId(), kind: "split", axis: "y", ratio: 0.5, first: region(1),
        second: colors.length === 3 ? region(2) : { id: newId(), kind: "split", axis: "x", ratio: 0.5, first: region(2), second: region(3) } } },
  };
}

export function cloneComposition(source: Composition): Composition {
  const now = new Date().toISOString();
  // Stable region/color IDs survive editing and serialization. A draft gets its own document ID.
  return { ...JSON.parse(JSON.stringify(source)) as Composition, id: newId(), createdAt: now, updatedAt: now };
}

export function updateColor(composition: Composition, colorId: string, input: string): Composition {
  const hex = normalizeHex(input);
  if (!hex || !composition.colors.some(c => c.id === colorId && c.hex !== hex)) return composition;
  return { ...composition, updatedAt: new Date().toISOString(), colors: composition.colors.map(c => c.id === colorId ? { ...c, hex, origin: "user" } : c) };
}

export function isAdaptation(composition: Composition): boolean {
  const original = composition.historical;
  return !!original && (!!composition.layoutModified || composition.colors.length !== original.originalColorCount ||
    composition.colors.some((c, i) => c.origin !== "original" || c.sourceColorId !== original.colors[i]?.sourceColorId || c.hex !== normalizeHex(original.colors[i]?.hex || "")));
}

export function paletteAttribution(composition: Composition): string {
  return composition.historical ? `${isAdaptation(composition) ? "Based on " : ""}Sanzo Wada · No. ${composition.historical.combinationNumber}` : composition.name;
}
