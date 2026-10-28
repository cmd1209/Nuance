import { MAX_COLORS, normalizeHex, type ColorValue, type Composition, type LayoutNode } from "./composition";
import { computeLayout, MIN_EXTENT } from "./layout";
import { WADA_PALETTES } from "./wada";

/** JSON is the only storage contract. No auth, storage SDK or persistence implementation is needed yet. */
export function serializeComposition(composition: Composition): string {
  return JSON.stringify(composition);
}

export function deserializeComposition(json: string): Composition {
  const value: unknown = JSON.parse(json);
  const fail = (): never => { throw new Error("Invalid or unsupported Nuance composition."); };
  const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!object(value) || value.schemaVersion !== 1 || !id(value.id) || typeof value.name !== "string" ||
    typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !object(value.artwork) || !finite(value.artwork.width) || !finite(value.artwork.height) || !finite(value.artwork.gap) ||
    value.artwork.width <= 0 || value.artwork.height <= 0 || value.artwork.width > 16384 || value.artwork.height > 16384 || value.artwork.gap < 0 ||
    value.artwork.gap >= Math.min(value.artwork.width, value.artwork.height) * MIN_EXTENT ||
    !Array.isArray(value.colors) || value.colors.length < 2 || value.colors.length > MAX_COLORS) return fail();
  const historical = value.historical === undefined ? undefined : WADA_PALETTES.find(p => object(value.historical) && p.paletteId === value.historical.paletteId);
  // JSON object key order can change in a persistence adapter. Validate content,
  // then restore the frozen canonical reference instead of trusting a saved copy.
  const reference = value.historical;
  if (historical && (!object(reference) || reference.combinationNumber !== historical.combinationNumber ||
    reference.datasetVersion !== historical.datasetVersion || reference.originalColorCount !== historical.originalColorCount ||
    !Array.isArray(reference.colors) || reference.colors.length !== historical.colors.length ||
    reference.colors.some((c, i) => !object(c) || c.sourceColorId !== historical.colors[i].sourceColorId ||
      c.name !== historical.colors[i].name || c.hex !== historical.colors[i].hex))) return fail();
  if ((value.source !== undefined && value.source !== "sanzo-wada") ||
    (value.historical !== undefined && !historical) ||
    (value.source === "sanzo-wada") !== !!historical ||
    (historical && value.currentColorCount !== value.colors.length) ||
    (value.currentColorCount !== undefined && value.currentColorCount !== value.colors.length) ||
    (value.extensionIndex !== undefined && (!Number.isSafeInteger(value.extensionIndex) || (value.extensionIndex as number) < 0)) ||
    (value.layoutModified !== undefined && typeof value.layoutModified !== "boolean")) return fail();
  const colorIds = new Set<string>();
  const colors: ColorValue[] = value.colors.map(c => {
    if (!object(c) || !id(c.id) || colorIds.has(c.id) || typeof c.hex !== "string" || !normalizeHex(c.hex)) return fail();
    if ((c.origin !== undefined && !["original", "generated", "user"].includes(c.origin as string)) ||
      (c.name !== undefined && (typeof c.name !== "string" || c.name.length > 200)) ||
      (c.originalHex !== undefined && (typeof c.originalHex !== "string" || !normalizeHex(c.originalHex))) ||
      (c.sourceColorId !== undefined && !id(c.sourceColorId))) return fail();
    const sourceColor = historical?.colors.find(original => original.sourceColorId === c.sourceColorId);
    if (historical && (!c.origin || (c.origin === "original" && (!sourceColor || normalizeHex(sourceColor.hex) !== normalizeHex(c.hex))) ||
      (c.sourceColorId !== undefined && (!sourceColor || c.name !== sourceColor.name || c.originalHex !== sourceColor.hex || c.origin === "generated")) ||
      (c.originalHex !== undefined && !sourceColor))) return fail();
    colorIds.add(c.id);
    return { id: c.id, hex: normalizeHex(c.hex)!, ...(c.origin === undefined ? {} : { origin: c.origin as ColorValue["origin"] }),
      ...(c.name === undefined ? {} : { name: c.name as string }), ...(c.originalHex === undefined ? {} : { originalHex: c.originalHex as string }),
      ...(c.sourceColorId === undefined ? {} : { sourceColorId: c.sourceColorId as string }) };
  });
  const nodeIds = new Set<string>(), usedColors = new Set<string>();
  function node(v: unknown, depth: number): LayoutNode {
    if (depth > MAX_COLORS || !object(v) || !id(v.id) || nodeIds.has(v.id)) return fail();
    nodeIds.add(v.id);
    if (v.kind === "region") {
      if (!id(v.colorId) || !colorIds.has(v.colorId) || usedColors.has(v.colorId)) return fail();
      usedColors.add(v.colorId); return { id: v.id, kind: "region", colorId: v.colorId };
    }
    if (v.kind !== "split" || (v.axis !== "x" && v.axis !== "y") || !finite(v.ratio) || v.ratio <= 0 || v.ratio >= 1) return fail();
    return { id: v.id, kind: "split", axis: v.axis, ratio: v.ratio, first: node(v.first, depth + 1), second: node(v.second, depth + 1) };
  }
  const layout = node(value.layout, 0);
  if (usedColors.size !== colorIds.size) return fail();
  const geometry = computeLayout(layout);
  if (geometry.dividers.some(d => d.min > d.max + 1e-8 || Math.abs(d.ratio - findRatio(layout, d.id)) > 1e-8)) return fail();
  // Reconstruct known fields rather than trusting foreign JSON properties on a future adapter boundary.
  return { schemaVersion: 1, id: value.id, name: value.name, createdAt: value.createdAt, updatedAt: value.updatedAt,
    artwork: { width: value.artwork.width, height: value.artwork.height, gap: value.artwork.gap }, colors, layout,
    ...(historical ? { source: "sanzo-wada", historical } : {}),
    ...(value.currentColorCount === undefined ? {} : { currentColorCount: value.currentColorCount as number }),
    ...(value.extensionIndex === undefined ? {} : { extensionIndex: value.extensionIndex as number }),
    ...(value.layoutModified === undefined ? {} : { layoutModified: value.layoutModified as boolean }) };
}

function findRatio(node: LayoutNode, id: string): number {
  if (node.kind === "region") return NaN;
  if (node.id === id) return node.ratio;
  const first = findRatio(node.first, id);
  return Number.isNaN(first) ? findRatio(node.second, id) : first;
}
