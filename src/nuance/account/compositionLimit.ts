import { SOURCE_LIBRARY_LIMITS } from "../domain/categories";

export const MAX_SAVED_COMPOSITIONS = SOURCE_LIBRARY_LIMITS.colors;

export function canSaveComposition(saved: ReadonlyArray<{ id: string }>, id: string): boolean {
  return saved.length < MAX_SAVED_COMPOSITIONS || saved.some(composition => composition.id === id);
}
