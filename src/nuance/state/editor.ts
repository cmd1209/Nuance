import { cloneComposition, updateColor, type Composition } from "../domain/composition";
import { addColor, removeColor, resizeSplit } from "../domain/layout";
import { editorComposition, resetHistoricalComposition } from "../domain/wada";
import { compositionContent } from "./compositionChanges";
import { shuffledPalettes } from "../domain/palettes";

export type SectionView = "explore" | "saved";

type CompositionSelection = { kind: "palette" | "saved"; composition: Composition };

export interface EditorState {
  preferences: { theme: "light" | "dark" };
  view: "palettes" | "editor";
  sectionView: SectionView;
  editorOrigin: SectionView;
  suggestions: Composition[];
  /** Unsaved client-side drafts; original preset/suggestion documents are never mutated. */
  drafts: Record<string, Composition>;
  baselines: Record<string, Composition>;
  pendingSelection: CompositionSelection | null;
  activeCompositionId: string | null;
  selectedColorId: string | null;
}
export type EditorAction =
  | { type: "section"; view: SectionView }
  | { type: "resume-editor" }
  | { type: "cancel-switch" }
  | { type: "discard-and-switch" }
  | { type: "save-succeeded"; composition: Composition }
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
  return { preferences: { theme: "dark" }, view: "palettes", sectionView: "explore", editorOrigin: "explore", suggestions: shuffledPalettes(), drafts: {}, baselines: {}, pendingSelection: null, activeCompositionId: null, selectedColorId: null };
}
export const activeComposition = (state: EditorState) => state.activeCompositionId ? state.drafts[state.activeCompositionId] : undefined;

export function hasUnsavedChanges(state: EditorState): boolean {
  const composition = activeComposition(state);
  const baseline = state.activeCompositionId ? state.baselines[state.activeCompositionId] : undefined;
  return !!composition && !!baseline && compositionContent(composition) !== compositionContent(baseline);
}

function openSelection(state: EditorState, selection: CompositionSelection): EditorState {
  const origin = selection.kind === "palette" ? "explore" : "saved";
  const current = activeComposition(state);
  // Re-selecting the current palette or saved document resumes its existing work.
  if ((selection.kind === "palette" && state.activeCompositionId === selection.composition.id)
    || (selection.kind === "saved" && current?.id === selection.composition.id)) {
    return { ...state, view: "editor", sectionView: origin, editorOrigin: origin, selectedColorId: null, pendingSelection: null };
  }
  if (hasUnsavedChanges(state)) return { ...state, pendingSelection: selection };
  const key = selection.kind === "saved" ? `saved:${selection.composition.id}` : selection.composition.id;
  const composition = selection.kind === "saved" ? selection.composition
    : state.drafts[key] ?? editorComposition(cloneComposition(selection.composition));
  return { ...state, view: "editor", sectionView: origin, editorOrigin: origin, activeCompositionId: key, selectedColorId: null, pendingSelection: null,
    drafts: { ...state.drafts, [key]: composition }, baselines: { ...state.baselines, [key]: composition } };
}

/** UI-independent transitions. View navigation never creates or selects compositions. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "cancel-switch") return state.pendingSelection
    ? { ...state, pendingSelection: null, view: activeComposition(state) ? "editor" : state.view } : state;
  if (action.type === "discard-and-switch") {
    if (!state.pendingSelection || !state.activeCompositionId) return state;
    const baseline = state.baselines[state.activeCompositionId];
    return openSelection({ ...state, pendingSelection: null,
      drafts: { ...state.drafts, [state.activeCompositionId]: baseline } }, state.pendingSelection);
  }
  if (action.type === "save-succeeded") {
    // Use the submitted snapshot: edits made while the request was in flight stay dirty.
    const baselines = { ...state.baselines };
    for (const [key, draft] of Object.entries(state.drafts)) {
      if (draft.id === action.composition.id) baselines[key] = action.composition;
    }
    return { ...state, baselines };
  }
  if (action.type === "resume-editor") return activeComposition(state) ? { ...state, view: "editor", selectedColorId: null } : state;
  if (action.type === "section") return { ...state, view: "palettes", sectionView: action.view, selectedColorId: null };
  if (action.type === "clear-account") return { ...state, view: "palettes", sectionView: "explore", editorOrigin: "explore", drafts: {}, baselines: {}, pendingSelection: null, activeCompositionId: null, selectedColorId: null };
  if (action.type === "open-saved") return openSelection(state, { kind: "saved", composition: action.composition });
  if (action.type === "select-palette") return openSelection(state, { kind: "palette", composition: action.palette });
  if (action.type === "theme") return { ...state, preferences: { ...state.preferences, theme: state.preferences.theme === "dark" ? "light" : "dark" } };
  if (action.type === "back") return { ...state, view: "palettes", sectionView: state.editorOrigin, selectedColorId: null };
  if (action.type === "select-color") return { ...state, selectedColorId: action.colorId };
  if (action.type === "explore") return { ...state, suggestions: action.suggestions };
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
