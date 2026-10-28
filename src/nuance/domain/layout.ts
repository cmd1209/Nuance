import { MAX_COLORS, MIN_COLORS, newId, normalizeHex, type Composition, type LayoutNode } from "./composition";

export interface Rect { x: number; y: number; width: number; height: number }
export interface Region extends Rect { id: string; colorId: string }
export interface Divider { id: string; axis: "x" | "y"; ratio: number; bounds: Rect; position: number; min: number; max: number }
export const MIN_EXTENT = 0.08;

/** Minimum extent in the whole artwork, including any parallel descendant splits. */
function minExtent(node: LayoutNode, axis: "x" | "y"): number {
  if (node.kind === "region") return MIN_EXTENT;
  const a = minExtent(node.first, axis), b = minExtent(node.second, axis);
  return node.axis === axis ? a + b : Math.max(a, b);
}

/** A normalized binary partition always covers exactly one unit square: no DOM measurements stored. */
export function computeLayout(root: LayoutNode): { regions: Region[]; dividers: Divider[] } {
  const regions: Region[] = [], dividers: Divider[] = [];
  function walk(node: LayoutNode, box: Rect) {
    if (node.kind === "region") { regions.push({ ...box, id: node.id, colorId: node.colorId }); return; }
    const horizontal = node.axis === "x", extent = horizontal ? box.width : box.height;
    const min = minExtent(node.first, node.axis) / extent;
    const max = 1 - minExtent(node.second, node.axis) / extent;
    const ratio = Math.min(max, Math.max(min, node.ratio));
    dividers.push({ id: node.id, axis: node.axis, ratio, bounds: box, min, max,
      position: (horizontal ? box.x : box.y) + extent * ratio });
    if (horizontal) {
      walk(node.first, { ...box, width: box.width * ratio });
      walk(node.second, { ...box, x: box.x + box.width * ratio, width: box.width * (1 - ratio) });
    } else {
      walk(node.first, { ...box, height: box.height * ratio });
      walk(node.second, { ...box, y: box.y + box.height * ratio, height: box.height * (1 - ratio) });
    }
  }
  walk(root, { x: 0, y: 0, width: 1, height: 1 });
  return { regions, dividers };
}

/** Gutters are artwork geometry, so previews and PNGs share exactly the same painted rectangles. */
export function paintedRect(rect: Rect, artwork: Composition["artwork"]): Rect {
  const gx = artwork.gap / artwork.width / 2, gy = artwork.gap / artwork.height / 2;
  const left = rect.x > 1e-9 ? gx : 0, top = rect.y > 1e-9 ? gy : 0;
  const right = rect.x + rect.width < 1 - 1e-9 ? gx : 0;
  const bottom = rect.y + rect.height < 1 - 1e-9 ? gy : 0;
  return { x: rect.x + left, y: rect.y + top, width: rect.width - left - right, height: rect.height - top - bottom };
}

function replace(root: LayoutNode, id: string, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === id) return fn(root);
  if (root.kind === "region") return root;
  return { ...root, first: replace(root.first, id, fn), second: replace(root.second, id, fn) };
}

export function resizeSplit(composition: Composition, id: string, ratio: number): Composition {
  if (!Number.isFinite(ratio)) return composition;
  const divider = computeLayout(composition.layout).dividers.find(d => d.id === id);
  if (!divider) return composition;
  const next = Math.min(divider.max, Math.max(divider.min, ratio));
  const layout = replace(composition.layout, id, node => node.kind === "split" ? { ...node, ratio: next } : node);
  // An ancestor becoming smaller can tighten descendant constraints. Persist those effective
  // ratios too, so a serialized document restores exactly the geometry currently on screen.
  const ratios = new Map(computeLayout(layout).dividers.map(d => [d.id, d.ratio]));
  function normalized(node: LayoutNode): LayoutNode {
    return node.kind === "region" ? node : { ...node, ratio: ratios.get(node.id)!, first: normalized(node.first), second: normalized(node.second) };
  }
  return { ...composition, updatedAt: new Date().toISOString(),
    layout: normalized(layout) };
}

export function addColor(composition: Composition, hex: string): Composition {
  const normalized = normalizeHex(hex);
  if (composition.colors.length >= MAX_COLORS || !normalized) return composition;
  const regions = computeLayout(composition.layout).regions;
  // Split the smallest available region in half; for ties prefer the last one (bottom right initially).
  const candidates = regions.map(r => ({ r, axis: (r.width * composition.artwork.width >= r.height * composition.artwork.height ? "x" : "y") as "x" | "y" }))
    .filter(({ r, axis }) => (axis === "x" ? r.width : r.height) >= MIN_EXTENT * 2)
    .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height || regions.indexOf(b.r) - regions.indexOf(a.r));
  const target = candidates[0];
  if (!target) return composition;
  const color = { id: newId(), hex: normalized };
  return { ...composition, updatedAt: new Date().toISOString(), colors: [...composition.colors, color],
    layout: replace(composition.layout, target.r.id, node => ({ id: newId(), kind: "split", axis: target.axis, ratio: 0.5,
      first: node, second: { id: newId(), kind: "region", colorId: color.id } })) };
}

export function removeColor(composition: Composition, colorId: string): Composition {
  if (composition.colors.length <= MIN_COLORS || !composition.colors.some(c => c.id === colorId)) return composition;
  function prune(node: LayoutNode): LayoutNode | null {
    if (node.kind === "region") return node.colorId === colorId ? null : node;
    const first = prune(node.first), second = prune(node.second);
    // Promote the sibling subtree into the removed region's parent. Nothing is left unallocated.
    return first && second ? { ...node, first, second } : first || second;
  }
  return { ...composition, updatedAt: new Date().toISOString(), colors: composition.colors.filter(c => c.id !== colorId), layout: prune(composition.layout)! };
}
