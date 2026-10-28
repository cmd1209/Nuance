import { MAX_COLORS, MIN_COLORS, normalizeHex, type Composition, type LayoutNode } from "./composition";
import { computeLayout, MIN_EXTENT } from "./layout";

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
    !Array.isArray(value.colors) || value.colors.length < MIN_COLORS || value.colors.length > MAX_COLORS) return fail();
  const colorIds = new Set<string>();
  const colors = value.colors.map(c => {
    if (!object(c) || !id(c.id) || colorIds.has(c.id) || typeof c.hex !== "string" || !normalizeHex(c.hex)) return fail();
    colorIds.add(c.id); return { id: c.id, hex: normalizeHex(c.hex)! };
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
    artwork: { width: value.artwork.width, height: value.artwork.height, gap: value.artwork.gap }, colors, layout };
}

function findRatio(node: LayoutNode, id: string): number {
  if (node.kind === "region") return NaN;
  if (node.id === id) return node.ratio;
  const first = findRatio(node.first, id);
  return Number.isNaN(first) ? findRatio(node.second, id) : first;
}
