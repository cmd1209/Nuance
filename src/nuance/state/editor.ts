import { cloneComposition, updateColor, type Composition } from "../domain/composition";
import { addColor, removeColor, resizeSplit } from "../domain/layout";
import { initialPalettes } from "../domain/palettes";

export interface EditorState {
  preferences: { theme: "light" | "dark" };
  view: "palettes" | "editor";
  suggestions: Composition[];
  /** Unsaved client-side drafts; original preset/suggestion documents are never mutated. */
  drafts: Record<string, Composition>;
  activeCompositionId: string | null;
  selectedColorId: string | null;
}
export type EditorAction =
  | { type: "select-palette"; palette: Composition }
  | { type: "explore"; suggestions: Composition[] }
  | { type: "back" }
  | { type: "select-color"; colorId: string | null }
  | { type: "color"; colorId: string; hex: string }
  | { type: "add"; hex: string }
  | { type: "remove" }
  | { type: "resize"; splitId: string; ratio: number }
  | { type: "theme" };

export function createEditorState(): EditorState {
  return { preferences: { theme: "dark" }, view: "palettes", suggestions: initialPalettes(), drafts: {}, activeCompositionId: null, selectedColorId: null };
}
export const activeComposition = (state: EditorState) => state.activeCompositionId ? state.drafts[state.activeCompositionId] : undefined;

/** UI-independent transitions. A future persistence adapter observes documents here, not DOM. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "theme") return { ...state, preferences: { ...state.preferences, theme: state.preferences.theme === "dark" ? "light" : "dark" } };
  if (action.type === "back") return { ...state, view: "palettes", selectedColorId: null };
  if (action.type === "select-color") return { ...state, selectedColorId: action.colorId };
  if (action.type === "explore") return { ...state, suggestions: action.suggestions };
  if (action.type === "select-palette") {
    const draft = state.drafts[action.palette.id] || cloneComposition(action.palette);
    return { ...state, view: "editor", drafts: { ...state.drafts, [action.palette.id]: draft }, activeCompositionId: action.palette.id, selectedColorId: null };
  }
  const composition = activeComposition(state);
  if (!composition || !state.activeCompositionId) return state;
  const updated = action.type === "color" ? updateColor(composition, action.colorId, action.hex)
    : action.type === "add" ? addColor(composition, action.hex)
    : action.type === "remove" && state.selectedColorId ? removeColor(composition, state.selectedColorId)
    : action.type === "resize" ? resizeSplit(composition, action.splitId, action.ratio) : composition;
  const selectedColorId = action.type === "add" && updated !== composition ? updated.colors[updated.colors.length - 1].id
    : state.selectedColorId && !updated.colors.some(c => c.id === state.selectedColorId) ? null : state.selectedColorId;
  return { ...state, selectedColorId, drafts: { ...state.drafts, [state.activeCompositionId]: updated } };
}
