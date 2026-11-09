import { useCallback, useEffect, useRef, useState } from "react";
import type { TypefaceSelection } from "../domain/typefaces";
import { supabase } from "./client";
import { accountError } from "./useAccount";
import { canSaveTypeface, deleteTypefaceFavorite, loadTypefaceFavorites, saveTypefaceFavorite, type SavedTypeface } from "./typefaceRepository";

/** Font failures are isolated from the Color/profile loading path. */
export function useTypefaceFavorites(userId:string|undefined) {
  const owner=useRef(userId);owner.current=userId;
  const generation=useRef(0);
  const [data,setData]=useState<{owner:string;saved:SavedTypeface[]}|null>(null);
  const [loading,setLoading]=useState(false),[failure,setFailure]=useState<{owner:string|undefined;message:string}>({owner:undefined,message:""});
  const error=failure.owner===userId ? failure.message : "";
  const setError=(message:string)=>setFailure({owner:userId,message});
  const refresh=useCallback(async()=>{
    const current=++generation.current;
    if(!supabase || !userId){setData(null);setLoading(false);setError("");return;}
    setLoading(true);setError("");
    try {
      const saved=await loadTypefaceFavorites(supabase,userId);
      if(owner.current===userId && current===generation.current)setData({owner:userId,saved});
    }catch(error){if(owner.current===userId && current===generation.current)setError(accountError(error));}
    finally{if(current===generation.current)setLoading(false);}
  },[userId]);
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh]);
  const saved=data && data.owner===userId ? data.saved : [];
  async function save(selection:TypefaceSelection){
    if(!supabase || !userId || owner.current!==userId)throw new Error("Please sign in to save a typeface.");
    if(!canSaveTypeface(saved,selection.fontId))throw new Error("You can save up to eight typefaces. Delete one before saving another.");
    const result=await saveTypefaceFavorite(supabase,userId,selection);
    if(owner.current!==userId)throw new Error("Your account changed. Please sign in and save again.");
    generation.current++;setLoading(false);setError("");
    setData(previous=>({owner:userId,saved:[result,...(previous?.owner===userId ? previous.saved.filter(item=>item.id!==result.id) : [])]}));
    await refresh();
  }
  async function remove(id:string){
    if(!supabase || !userId || owner.current!==userId)throw new Error("Please sign in to delete a typeface.");
    await deleteTypefaceFavorite(supabase,userId,id);
    if(owner.current!==userId)throw new Error("Your account changed. Please sign in again.");
    generation.current++;setLoading(false);setError("");
    setData(previous=>previous?.owner===userId ? {...previous,saved:previous.saved.filter(item=>item.id!==id)} : previous);
    await refresh();
  }
  return {saved,loading:!!userId && (loading || (data?.owner!==userId && !error)),error,refresh,save,remove};
}
export type TypefaceFavorites=ReturnType<typeof useTypefaceFavorites>;
