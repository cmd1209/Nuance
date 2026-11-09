import approved from "../data/werner/v1/approved.json";
import { createComposition, type Composition, type CuratedReference } from "./composition";
import provenance from "../data/werner/v1/provenance.json";

// Publish only the source colors referenced by the approved collection.
const sourceColors = new Map(approved.colors.map(color => [color.id, color]));
function freeze<T>(value:T):T {
  if(value && typeof value === "object") { Object.values(value).forEach(freeze);Object.freeze(value); }
  return value;
}
export const WERNER_PALETTES: readonly Readonly<CuratedReference>[] = freeze(approved.palettes.map(candidate => ({
  paletteId:candidate.paletteId, collection:"werner-nuance", combinationNumber:candidate.combinationNumber,
  datasetVersion:approved.version, originalColorCount:candidate.colorIds.length, curation:"nuance-generated" as const,
  candidateId:candidate.id, generationVersion:candidate.generationVersion, seed:candidate.seed, batchId:candidate.batchId, method:candidate.method,
  provenance,
  colors:candidate.colorIds.map(id => { const color=sourceColors.get(id);if(!color)throw new Error(`Unknown published Werner color: ${id}`);return {sourceColorId:color.id,name:color.name,hex:color.hex}; }),
})));
export function curatedWernerComposition(reference:CuratedReference):Composition {
  const composition=createComposition(reference.colors.map(color=>color.hex),`Werner · Nuance No. ${reference.combinationNumber}`,reference.paletteId);
  return {...composition,source:"werner-nuance",curated:reference,extensionIndex:0,
    colors:composition.colors.map((color,index)=>({...color,origin:"original",name:reference.colors[index].name,originalHex:reference.colors[index].hex,sourceColorId:reference.colors[index].sourceColorId}))};
}
