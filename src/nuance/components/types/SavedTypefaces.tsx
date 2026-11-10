import { useLayoutEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Account } from "../../account/useAccount";
import { accountError } from "../../account/useAccount";
import { MAX_SAVED_TYPEFACES, type SavedTypeface } from "../../account/typefaceRepository";
import type { TypefaceFavorites } from "../../account/useTypefaceFavorites";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import { SavedGallery } from "../SavedGallery";
import { TypefaceCard } from "./TypefaceSpecimen";

export function SavedTypefaces({account,favorites,active,onOpen,onExplore,onSignIn}:{
  account:Pick<Account,"user"|"authLoading">;favorites:TypefaceFavorites;active:boolean;
  onOpen:(item:SavedTypeface)=>void;onExplore:()=>void;onSignIn:()=>void;
}) {
  const root=useRef<HTMLDivElement>(null),removing=useRef(false),owner=useRef(account.user?.id);owner.current=account.user?.id;
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const focusAfterDelete=useRef<{owner:string|undefined;index:number}|null>(null);
  useLayoutEffect(()=>{
    const pending=focusAfterDelete.current;
    if(!pending || busy || favorites.loading)return;
    focusAfterDelete.current=null;
    if(pending.owner!==owner.current)return;
    const buttons=root.current?.querySelectorAll<HTMLButtonElement>("[data-delete-typeface]");
    (buttons?.[Math.min(pending.index,buttons.length-1)]??root.current)?.focus({preventScroll:true});
  },[favorites.saved,favorites.loading,busy]);
  async function remove(item:SavedTypeface){
    if(removing.current || !window.confirm(`Delete ${item.typeface.family} from your saved typefaces?`))return;
    const operationOwner=account.user?.id,index=favorites.saved.findIndex(font=>font.id===item.id);
    removing.current=true;setBusy(true);setError("");setNotice("");
    try{
      await favorites.remove(item.id);
      if(owner.current!==operationOwner)return;
      setNotice("Typeface deleted.");
      focusAfterDelete.current={owner:operationOwner,index};
    }catch(error){if(owner.current===operationOwner)setError(accountError(error));}
    finally{removing.current=false;setBusy(false);}
  }
  return <div ref={root} className="saved-compositions" tabIndex={-1} aria-label="Saved typefaces" aria-busy={favorites.loading||busy}>
    {account.authLoading ? <p role="status">Loading your account…</p> : !account.user ?
      <EmptyState message="Sign in to see your saved typefaces." action={<Button onClick={onSignIn}>Sign in</Button>} /> : <>
        {favorites.loading && <p role="status">Loading typefaces…</p>}
        {favorites.error && <div><p role="alert">{favorites.error}</p><Button disabled={favorites.loading||busy} onClick={()=>{void favorites.refresh();}}>Try again</Button></div>}
        {(!favorites.loading && !favorites.error || favorites.saved.length>0) && <SavedGallery items={favorites.saved} maximum={MAX_SAVED_TYPEFACES}
          empty={<EmptyState message="No saved typefaces yet. Explore a font and save it to see it here." action={<Button onClick={onExplore}>Explore typefaces</Button>} />}
          renderItem={item=><TypefaceCard font={item.typeface} active={active} disabled={busy} weight={item.selection.fontWeight} alphabet={item.selection.alphabet} onSelect={()=>onOpen(item)}
            headerAction={<Button size="XS" disabled={busy||favorites.loading} className="saved-compositions__delete" data-delete-typeface={item.id}
              aria-label={`Delete ${item.typeface.family}`} title="Delete typeface" onClick={()=>{void remove(item);}} leadingIcon={<Trash2 size={16} aria-hidden="true" />} />} />}
        />}
      </>}
    {error && <p role="alert">{error}</p>}<p role="status">{notice}</p>
  </div>;
}
