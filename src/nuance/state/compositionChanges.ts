import type { Composition, LayoutNode } from "../domain/composition";

/** Compare editable content, ignoring timestamps, generated node IDs, and derived flags. */
export function compositionContent(composition: Composition): string {
  function layout(node: LayoutNode): unknown {
    return node.kind === "region" ? { color: composition.colors.findIndex(color => color.id === node.colorId) }
      : { axis: node.axis, ratio: node.ratio, first: layout(node.first), second: layout(node.second) };
  }
  return JSON.stringify({
    name: composition.name, artwork: composition.artwork,
    colors: composition.colors.map(color => ({ hex: color.hex.toUpperCase(), name: color.name, sourceColorId: color.sourceColorId })),
    layout: layout(composition.layout), source: composition.source, historical: composition.historical,
  });
}
