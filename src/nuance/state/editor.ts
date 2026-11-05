import { cloneComposition, updateColor, type Composition } from "../domain/composition";
import { addColor, removeColor, resizeSplit } from "../domain/layout";
import { editorComposition, resetHistoricalComposition } from "../domain/wada";
import { shuffledPalettes } from "../domain/palettes";

export type SectionView = "explore" | "saved";

export interface EditorState {
  preferences: { theme: "light" | "dark" };
  view: "palettes" | "editor";
  sectionView: SectionView;
  editorOrigin: SectionView;
  suggestions: Composition[];
  /** Unsaved client-side drafts; original preset/suggestion documents are never mutated. */
  drafts: Record<string, Composition>;
  activeCompositionId: string | null;
  selectedColorId: string | null;
}
export type EditorAction =
  | { type: "section"; view: SectionView }
  | { type: "resume-editor" }
  | { type: "select-palette"; palette: Composition }
  | { type: "open-saved"; composition: Composition }
  | { type: "clear-account" }
  | { type: "explore"; suggestions: Composition[] }
  | { type: "back" }
  | { type: "select-color"; colorId: string | null }
  | { type: "color"; colorId: string; hex: string }
  | { type: "add"; hex: string }
  | { type: "remove"; colorId?: string }
  | { type: "reset" }
  | { type: "resize"; splitId: string; ratio: number }
  | { type: "theme" };

export function createEditorState(): EditorState {
  return { preferences: { theme: "dark" }, view: "palettes", sectionView: "explore", editorOrigin: "explore", suggestions: shuffledPalettes(), drafts: {}, activeCompositionId: null, selectedColorId: null };
}
export const activeComposition = (state: EditorState) => state.activeCompositionId ? state.drafts[state.activeCompositionId] : undefined;

/** UI-independent transitions. A future persistence adapter observes documents here, not DOM. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "resume-editor") return activeComposition(state) ? { ...state, view: "editor", selectedColorId: null } : state;
  if (action.type === "section") return { ...state, view: "palettes", sectionView: action.view, selectedColorId: null };
  if (action.type === "clear-account") return { ...state, view: "palettes", sectionView: "explore", editorOrigin: "explore", drafts: {}, activeCompositionId: null, selectedColorId: null };
  if (action.type === "open-saved") {
    const key = `saved:${action.composition.id}`;
    return { ...state, view: "editor", sectionView: "saved", editorOrigin: "saved", activeCompositionId: key, selectedColorId: null,
      drafts: { ...state.drafts, [key]: action.composition } };
  }
  if (action.type === "theme") return { ...state, preferences: { ...state.preferences, theme: state.preferences.theme === "dark" ? "light" : "dark" } };
  if (action.type === "back") return { ...state, view: "palettes", sectionView: state.editorOrigin, selectedColorId: null };
  if (action.type === "select-color") return { ...state, selectedColorId: action.colorId };
  if (action.type === "explore") return { ...state, suggestions: action.suggestions };
  if (action.type === "select-palette") {
    const draft = state.drafts[action.palette.id] || editorComposition(cloneComposition(action.palette));
    return { ...state, view: "editor", sectionView: "explore", editorOrigin: "explore", drafts: { ...state.drafts, [action.palette.id]: draft }, activeCompositionId: action.palette.id, selectedColorId: null };
  }
  const composition = activeComposition(state);
  if (!composition || !state.activeCompositionId) return state;
  const updated = action.type === "reset" ? resetHistoricalComposition(composition)
    : action.type === "color" ? updateColor(composition, action.colorId, action.hex)
    : action.type === "add" ? addColor(composition, action.hex)
    : action.type === "remove" ? removeColor(composition, action.colorId ?? state.selectedColorId ?? "")
    : action.type === "resize" ? resizeSplit(composition, action.splitId, action.ratio) : composition;
  const selectedColorId = action.type === "add" && updated !== composition ? updated.colors[updated.colors.length - 1].id
    : state.selectedColorId && !updated.colors.some(c => c.id === state.selectedColorId) ? null : state.selectedColorId;
  return { ...state, selectedColorId, drafts: { ...state.drafts, [state.activeCompositionId]: updated } };
}
