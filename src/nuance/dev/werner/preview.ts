import { createComposition, type Composition } from "../../domain/composition";
import type { WernerCandidate } from "../../domain/werner-generation";
import { wernerColor } from "../../domain/werner";

/** Ephemeral preview only: no historical Wada attribution and no saved document. */
export function candidatePreview(candidate: WernerCandidate): Composition {
  const colors = candidate.colorIds.map(wernerColor);
  const composition = createComposition(colors.map(color => color.hex), `Werner · Nuance · ${candidate.id}`, candidate.id);
  return { ...composition, colors:composition.colors.map((color, index) => ({...color, name:colors[index].name, sourceColorId:colors[index].id})) };
}
