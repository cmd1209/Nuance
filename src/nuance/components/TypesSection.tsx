import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { HeartPlus } from "lucide-react";
import { TYPEFACES, typefaceById } from "../domain/typefaces";
import { FOUNDATION_SECTIONS, type CreativeView } from "../domain/sections";
import { createTypesState, typesReducer } from "../state/types";
import { Button } from "./Button";
import { accountError, type Account } from "../account/useAccount";
import { useTypefaceFavorites } from "../account/useTypefaceFavorites";
import { canSaveTypeface, MAX_SAVED_TYPEFACES } from "../account/typefaceRepository";
import { SavedTypefaces } from "./types/SavedTypefaces";
import { DiscoverySlider } from "./DiscoverySlider";
import { SectionLayout } from "./SectionLayout";
import { SectionNavigation } from "./SectionNavigation";
import { TypefaceCard, TypefaceDetail } from "./types/TypefaceSpecimen";
import type { TypeLineSizes } from "./types/ResizableTypeLine";
import "./types/types.css";

export function TypesSection({hidden,onViewChange,account,onSignIn}:{hidden:boolean;onViewChange:()=>void;account:Pick<Account,"user"|"authLoading"|"dataLoading">;onSignIn:()=>void}) {
  const [state,dispatch]=useReducer(typesReducer,undefined,createTypesState);
  const [specimenSizes,setSpecimenSizes]=useState<Record<string,TypeLineSizes>>({});
  const focusPreview=useRef(false);
  const explorePosition=useRef(0);
  const rememberPosition=useCallback((_id:string,index:number)=>{explorePosition.current=index;},[]);
  const favorites=useTypefaceFavorites(account.user?.id);
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  const saveInProgress=useRef(false),owner=useRef(account.user?.id),previousOwner=useRef(account.user?.id);
  owner.current=account.user?.id;
  useEffect(()=>{
    if(previousOwner.current && previousOwner.current!==account.user?.id){dispatch({type:"clear-account"});setNotice("");}
    previousOwner.current=account.user?.id;
  },[account.user?.id]);
  const selected=state.selection ? typefaceById(state.selection.fontId) : null;
  useLayoutEffect(()=>{
    if(focusPreview.current && !hidden && state.view === "edit"){
      document.getElementById("types-detail-heading")?.focus({preventScroll:true});
      focusPreview.current=false;
    }
  },[state.view,state.selection,hidden]);
  function changeView(view:CreativeView){dispatch({type:"view",view});setNotice("");onViewChange();}
  function openTypeface(fontId:string,index?:number){if(index!==undefined)explorePosition.current=index;focusPreview.current=true;dispatch({type:"select",fontId});setNotice("");onViewChange();}
  async function save(){
    if(!state.selection || saveInProgress.current)return;
    if(!account.user){onSignIn();return;}
    const operationOwner=account.user.id;
    saveInProgress.current=true;setSaving(true);setNotice("");
    try{await favorites.save(state.selection);if(owner.current===operationOwner)setNotice("Typeface saved to your account.");}
    catch(error){if(owner.current===operationOwner)setNotice(accountError(error));}
    finally{saveInProgress.current=false;setSaving(false);}
  }
  const full=!!selected && !canSaveTypeface(favorites.saved,selected.id);
  const definition=FOUNDATION_SECTIONS.types;
  return <SectionLayout hidden={hidden} title={definition.title} headingId="types-heading" notice={notice} description={definition.descriptions[state.view]}
    navigation={<SectionNavigation prefix="types" label="Types views" value={state.view} hasDraft={!!selected} onChange={changeView} />}>
    <section id="types-explore-panel" role="tabpanel" aria-labelledby="types-explore-tab" hidden={state.view !== "explore"}>
      <DiscoverySlider items={TYPEFACES} activeId={selected?.id??null} activeIndex={explorePosition.current} onPositionChange={rememberPosition}
        label="Typefaces" itemLabel="Typefaces" navigationLabel="Typeface navigation" scrollLabel="Scroll typefaces with left and right arrow keys" previousLabel="Previous typefaces" nextLabel="Next typefaces"
        renderItem={(font,index)=><TypefaceCard font={font} active={!hidden && state.view === "explore"} onSelect={()=>openTypeface(font.id,index)} />} />
    </section>
    <section id="types-saved-panel" role="tabpanel" aria-labelledby="types-saved-tab" hidden={state.view !== "saved"}>
      <SavedTypefaces key={account.user?.id??"guest"} account={account} favorites={favorites} active={!hidden && state.view === "saved"}
        onOpen={openTypeface} onSignIn={onSignIn} onExplore={()=>{changeView("explore");document.getElementById("types-explore-tab")?.focus({preventScroll:true});}} />
    </section>
    {selected && <section id="types-edit-panel" className="nuance-stage" role="tabpanel" aria-labelledby="types-edit-tab" hidden={state.view !== "edit"}>
      <TypefaceDetail key={selected.id} font={selected} active={!hidden && state.view === "edit"} sizes={specimenSizes[selected.id]??{}}
        onResize={(line,size)=>setSpecimenSizes(previous=>({...previous,[selected.id]:{...previous[selected.id],[line]:size}}))} />
      <div className="composition-actions" role="group" aria-label="Typeface actions">
        <Button className="composition-action" onClick={()=>{void save();}} disabled={saving||account.authLoading||favorites.loading||!!account.user&&account.dataLoading||full}
          aria-busy={saving} aria-label={saving?"Saving typeface…":full?`Save typeface — limit reached (${MAX_SAVED_TYPEFACES}/${MAX_SAVED_TYPEFACES})`:"Save typeface"}
          title={full?"Delete a typeface in Saved to make room.":saving?"Saving typeface…":"Save typeface"} leadingIcon={<HeartPlus size={20} aria-hidden="true" />} />
      </div>
    </section>}
  </SectionLayout>;
}
