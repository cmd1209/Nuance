import type { CreativeView } from "../domain/sections";
import { selectTypeface, type TypefaceSelection } from "../domain/typefaces";
export interface TypesState { view:CreativeView; selection:TypefaceSelection|null }
export type TypesAction = {type:"view";view:CreativeView} | {type:"select";fontId:string} | {type:"clear-account"};
export const createTypesState = ():TypesState => ({view:"explore",selection:null});
export function typesReducer(state:TypesState,action:TypesAction):TypesState {
  if(action.type === "clear-account")return createTypesState();
  if(action.type === "select")return {view:"edit",selection:selectTypeface(action.fontId)};
  return action.view === "edit" && !state.selection ? state : {...state,view:action.view};
}
