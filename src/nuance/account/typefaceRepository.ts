import type { SupabaseClient } from "@supabase/supabase-js";
import { TYPEFACE_REGISTRY_VERSION, selectTypeface, typefaceById, type Typeface, type TypefaceSelection } from "../domain/typefaces";
import { SOURCE_LIBRARY_LIMITS } from "../domain/categories";
export const MAX_SAVED_TYPEFACES=SOURCE_LIBRARY_LIMITS.types;
export interface SavedTypeface { id:string; selection:TypefaceSelection; typeface:Typeface; updatedAt:string }
export function canSaveTypeface(saved:readonly Pick<SavedTypeface,"id">[],id:string):boolean {
  return saved.length<MAX_SAVED_TYPEFACES || saved.some(item=>item.id===id);
}
export function readSavedTypeface(row:{font_id:unknown;source:unknown;registry_version:unknown;updated_at:unknown;font_weight?:unknown;alphabet?:unknown;custom?:unknown;custom_text?:unknown}):SavedTypeface {
  if(typeof row.font_id!=="string" || row.registry_version!==TYPEFACE_REGISTRY_VERSION || typeof row.updated_at!=="string" || !Number.isFinite(Date.parse(row.updated_at)))throw new Error("This saved typeface could not be read.");
  const typeface=typefaceById(row.font_id);
  if(typeface.source!==row.source)throw new Error("This saved typeface has an unsupported source.");
  const fontWeight=row.font_weight===undefined ? typeface.loading.specimenWeight : row.font_weight;
  const alphabet=row.alphabet===undefined ? false : row.alphabet;
  if(typeof fontWeight!=="number" || !typeface.availableWeights.includes(fontWeight) || typeof alphabet!=="boolean")throw new Error("This saved typeface has unsupported specimen settings.");
  const custom=row.custom??false,customText=row.custom_text??undefined;
  if(typeof custom!=="boolean" || customText!==undefined && (typeof customText!=="string" || customText.length>2000))throw new Error("This saved typeface has unsupported custom text.");
  return {id:typeface.id,selection:{...selectTypeface(typeface.id),fontWeight,alphabet,...(custom || customText!==undefined?{custom,customText}:{})},typeface,updatedAt:row.updated_at};
}
export async function loadTypefaceFavorites(client:SupabaseClient,owner:string):Promise<SavedTypeface[]> {
  const {data,error}=await client.from("typeface_favorites").select("font_id,source,registry_version,font_weight,alphabet,custom,custom_text,updated_at").eq("owner_id",owner).order("updated_at",{ascending:false}).order("font_id");
  if(error)throw error;
  return data.map(readSavedTypeface);
}
export async function saveTypefaceFavorite(client:SupabaseClient,owner:string,selection:TypefaceSelection):Promise<SavedTypeface> {
  const canonical=selectTypeface(selection.fontId);
  if(selection.source!==canonical.source || selection.registryVersion!==canonical.registryVersion)throw new Error("This typeface selection has an unsupported version or source.");
  const font=typefaceById(canonical.fontId),fontWeight=selection.fontWeight===undefined ? font.loading.specimenWeight : selection.fontWeight;
  const alphabet=selection.alphabet===undefined ? false : selection.alphabet;
  if(!font.availableWeights.includes(fontWeight) || typeof alphabet!=="boolean")throw new Error("This typeface has unsupported specimen settings.");
  const custom=selection.custom??false,customText=selection.customText??null;
  if(typeof custom!=="boolean" || customText!==null && (typeof customText!=="string" || customText.length>2000))throw new Error("This typeface has unsupported custom text.");
  const {data,error}=await client.from("typeface_favorites").upsert({owner_id:owner,font_id:canonical.fontId,source:canonical.source,registry_version:canonical.registryVersion,font_weight:fontWeight,alphabet,custom,custom_text:customText},{onConflict:"owner_id,font_id"})
    .select("font_id,source,registry_version,font_weight,alphabet,custom,custom_text,updated_at").single();
  if(error)throw error;
  return readSavedTypeface(data);
}
export async function deleteTypefaceFavorite(client:SupabaseClient,owner:string,id:string):Promise<void> {
  const {error}=await client.from("typeface_favorites").delete().eq("owner_id",owner).eq("font_id",id);
  if(error)throw error;
}
