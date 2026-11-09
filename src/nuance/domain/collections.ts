import type { Composition } from "./composition";
import { editorComposition, historicalComposition, WADA_PALETTES } from "./wada";
import { curatedWernerComposition, WERNER_PALETTES } from "./werner-palettes";
export interface PaletteEntry { readonly id:string; create:()=>Composition }
export interface PaletteCollection { readonly id:string; readonly palettes:readonly PaletteEntry[] }
/** Register another collection here; discovery and Explore do not depend on source count. */
export const COLOR_COLLECTIONS: readonly PaletteCollection[] = [
  {id:"sanzo-wada",palettes:WADA_PALETTES.map(reference=>({id:reference.paletteId,create:()=>historicalComposition(reference)}))},
  {id:"werner-nuance",palettes:WERNER_PALETTES.map(reference=>({id:reference.paletteId,create:()=>curatedWernerComposition(reference)}))},
];
export function resetSourceComposition(composition:Composition):Composition {
  const id=composition.historical?.paletteId ?? composition.curated?.paletteId;
  const original=COLOR_COLLECTIONS.find(collection=>collection.id===composition.source)?.palettes.find(palette=>palette.id===id);
  if(!original)return composition;
  return {...editorComposition(original.create()),id:composition.id,createdAt:composition.createdAt};
}
