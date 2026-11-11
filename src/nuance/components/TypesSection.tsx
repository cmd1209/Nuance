import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { CaseSensitive, HeartPlus, MessageSquareQuote, RotateCcw, TextCursorInput, TypeOutline } from "lucide-react";
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
import "./types/types.css";

const WEIGHT_LABELS:Readonly<Record<number,string>>={100:"Thin",200:"Extra Light",300:"Light",400:"Normal",500:"Medium",600:"Semibold",700:"Bold",800:"Extra Bold",900:"Black"};
const weightLabel=(weight:number)=>`${WEIGHT_LABELS[weight]??"Weight"} (${weight})`;

export function TypesSection({hidden,onViewChange,account,onSignIn}:{hidden:boolean;onViewChange:()=>void;account:Pick<Account,"user"|"authLoading"|"dataLoading">;onSignIn:()=>void}) {
  const [state,dispatch]=useReducer(typesReducer,undefined,createTypesState);
  const [specimenSizes,setSpecimenSizes]=useState<Record<string,number>>({});
  const [specimenModes,setSpecimenModes]=useState<Record<string,"quote"|"alphabet"|"edit">>({});
  const [customTexts,setCustomTexts]=useState<Record<string,string>>({});
  const [editingText,setEditingText]=useState(false);
  const [specimenWeights,setSpecimenWeights]=useState<Record<string,number>>({});
  const focusPreview=useRef(false);
  const explorePosition=useRef(0);
  const rememberPosition=useCallback((_id:string,index:number)=>{explorePosition.current=index;},[]);
  const favorites=useTypefaceFavorites(account.user?.id);
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  const saveInProgress=useRef(false),owner=useRef(account.user?.id),previousOwner=useRef(account.user?.id);
  owner.current=account.user?.id;
  useEffect(()=>{
    if(previousOwner.current && previousOwner.current!==account.user?.id){dispatch({type:"clear-account"});setCustomTexts({});setSpecimenModes({});setEditingText(false);setNotice("");}
    previousOwner.current=account.user?.id;
  },[account.user?.id]);
  const selected=state.selection ? typefaceById(state.selection.fontId) : null;
  const mode=selected ? specimenModes[selected.id]??"quote" : "quote";
  const alphabet=mode==="alphabet";
  const nextMode=mode==="quote"?"alphabet":mode==="alphabet"?"edit":"quote";
  const modeAction=nextMode==="edit"?"Edit text":nextMode==="quote"?"Show quote":"Show alphabet";
  const weight=selected ? specimenWeights[selected.id]??selected.loading.specimenWeight : 400;
  const weights=selected?.availableWeights??[];
  const nextWeight=weights[(weights.indexOf(weight)+1)%weights.length]??weight;
  const weightAction=weights.length>1 ? `Font weight: ${weightLabel(weight)}. Switch to ${weightLabel(nextWeight)}` : `Font weight: ${weightLabel(weight)}. Only available weight`;
  useLayoutEffect(()=>{
    if(focusPreview.current && !hidden && state.view === "edit"){
      document.getElementById("types-detail-heading")?.focus({preventScroll:true});
      focusPreview.current=false;
    }
  },[state.view,state.selection,hidden]);
  function changeView(view:CreativeView){setEditingText(false);dispatch({type:"view",view});setNotice("");onViewChange();}
  function openTypeface(fontId:string,index?:number){setEditingText(false);if(index!==undefined)explorePosition.current=index;focusPreview.current=true;dispatch({type:"select",fontId});setNotice("");onViewChange();}
  async function save(){
    if(!state.selection || saveInProgress.current)return;
    setEditingText(false);
    if(!account.user){onSignIn();return;}
    const operationOwner=account.user.id;
    saveInProgress.current=true;setSaving(true);setNotice("");
    try{await favorites.save({...state.selection,fontWeight:weight,alphabet,custom:mode==="edit",customText:customTexts[state.selection.fontId]});if(owner.current===operationOwner)setNotice("Typeface saved to your account.");}
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
        renderItem={(font,index)=><TypefaceCard font={font} active={!hidden && state.view === "explore"} size={specimenSizes[font.id]} weight={specimenWeights[font.id]} onSelect={()=>openTypeface(font.id,index)} />} />
    </section>
    <section id="types-saved-panel" role="tabpanel" aria-labelledby="types-saved-tab" hidden={state.view !== "saved"}>
      <SavedTypefaces key={account.user?.id??"guest"} account={account} favorites={favorites} active={!hidden && state.view === "saved"}
        onOpen={item=>{
          setSpecimenWeights(previous=>({...previous,[item.id]:item.selection.fontWeight??item.typeface.loading.specimenWeight}));
          setSpecimenModes(previous=>({...previous,[item.id]:item.selection.custom?"edit":item.selection.alphabet?"alphabet":"quote"}));
          setCustomTexts(previous=>{const next={...previous};if(item.selection.customText===undefined)delete next[item.id];else next[item.id]=item.selection.customText;return next;});
          openTypeface(item.id);
        }} onSignIn={onSignIn} onExplore={()=>{changeView("explore");document.getElementById("types-explore-tab")?.focus({preventScroll:true});}} />
    </section>
    {selected && <section id="types-edit-panel" className="nuance-stage" role="tabpanel" aria-labelledby="types-edit-tab" hidden={state.view !== "edit"}>
      <TypefaceDetail key={selected.id} font={selected} active={!hidden && state.view === "edit"} size={specimenSizes[selected.id]} alphabet={alphabet} weight={weight} custom={mode==="edit"} customText={customTexts[selected.id]} editing={editingText}
        onTextChange={text=>setCustomTexts(previous=>({...previous,[selected.id]:text}))} onFinishEditing={()=>setEditingText(false)} onEdit={()=>setEditingText(true)}
        onResize={size=>setSpecimenSizes(previous=>({...previous,[selected.id]:size}))} />
      <div className="composition-actions" role="group" aria-label="Typeface actions">
        <Button className="composition-action" onClick={()=>{setSpecimenModes(previous=>({...previous,[selected.id]:nextMode}));setEditingText(nextMode==="edit");}}
          aria-label={modeAction} title={`${modeAction} · Quote | Alphabet | Edit`}
          leadingIcon={nextMode==="edit"?<TextCursorInput size={20} aria-hidden="true" />:nextMode==="quote"?<MessageSquareQuote size={20} aria-hidden="true" />:<CaseSensitive size={20} aria-hidden="true" />} />
        <Button className="composition-action" aria-label="Reset typeface" title="Reset text, size and weight" onClick={()=>{
          setSpecimenModes(previous=>({...previous,[selected.id]:"quote"}));
          setCustomTexts(previous=>{const next={...previous};delete next[selected.id];return next;});
          setSpecimenSizes(previous=>{const next={...previous};delete next[selected.id];return next;});
          setSpecimenWeights(previous=>({...previous,[selected.id]:selected.loading.specimenWeight}));setEditingText(false);
        }} leadingIcon={<RotateCcw size={20} aria-hidden="true" />} />
        <Button className="composition-action" disabled={weights.length<2} aria-label={weightAction} title={weightAction}
          onClick={()=>setSpecimenWeights(previous=>({...previous,[selected.id]:nextWeight}))}
          leadingIcon={<TypeOutline size={20} aria-hidden="true" />} />
        <Button className="composition-action" onClick={()=>{void save();}} disabled={saving||account.authLoading||favorites.loading||!!account.user&&account.dataLoading||full}
          aria-busy={saving} aria-label={saving?"Saving typeface…":full?`Save typeface — limit reached (${MAX_SAVED_TYPEFACES}/${MAX_SAVED_TYPEFACES})`:"Save typeface"}
          title={full?"Delete a typeface in Saved to make room.":saving?"Saving typeface…":"Save typeface"} leadingIcon={<HeartPlus size={20} aria-hidden="true" />} />
      </div>
    </section>}
  </SectionLayout>;
}
