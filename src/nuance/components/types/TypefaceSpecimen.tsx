import { useId, type ReactNode } from "react";
import { typefaceFamily, type Typeface } from "../../domain/typefaces";
import { useSpecimenFont } from "./useSpecimenFont";

function LoadNotice({status,classification}:{status:string;classification:Typeface["classification"]}) {
  return <span className="type-specimen__load-status" role="status">
    {status === "unavailable" ? `Font unavailable. Showing a ${classification} fallback.` : status === "loading" ? "Loading typeface…" : ""}
  </span>;
}
export function TypefaceCard({font,active,onSelect,headerAction,disabled=false}:{font:Typeface;active:boolean;onSelect:()=>void;headerAction?:ReactNode;disabled?:boolean}) {
  const {element,status}=useSpecimenFont(font,active);
  const classificationId=useId();
  return <div ref={element} className="type-specimen" data-font-id={font.id} data-font-status={status}>
    {headerAction && <header className="palette-card__header"><span className="type-specimen__name">{font.family}</span>{headerAction}</header>}
    <button type="button" className="type-specimen__button" disabled={disabled} aria-label={`Preview ${font.family}`} aria-describedby={classificationId} onClick={onSelect}>
      <span className="type-specimen__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:font.loading.specimenWeight}}>
        <span className="type-specimen__sample">Aa Bb Cc Dd</span>
        <span className="type-specimen__sentence">The quick brown fox jumps over the lazy dog.</span>
      </span>
      <span className="type-specimen__metadata">{!headerAction && <span className="type-specimen__name">{font.family}</span>}<span id={classificationId}>{font.classification === "serif" ? "Serif" : "Sans-serif"}</span></span>
    </button>
    <LoadNotice status={status} classification={font.classification} />
  </div>;
}
export function TypefaceDetail({font,active}:{font:Typeface;active:boolean}) {
  const {element,status}=useSpecimenFont(font,active);
  return <article className="type-detail" aria-labelledby="types-detail-heading" data-font-id={font.id} data-font-status={status}>
    <div ref={element} className="type-detail__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:font.loading.specimenWeight}}>
      <p className="type-detail__sample">Aa Bb Cc Dd</p>
      <p className="type-detail__phrase">Form, rhythm, character.</p>
      <p className="type-detail__reading">The quick brown fox jumps over the lazy dog. Typography gives words a voice, shaping how we read and how we feel.</p>
    </div>
    <div className="type-detail__footer">
      <h2 id="types-detail-heading" tabIndex={-1}>{font.family}</h2>
      <p>{font.classification === "serif" ? "Serif" : "Sans-serif"} · {font.sourceLabel}</p>
    </div>
    <LoadNotice status={status} classification={font.classification} />
  </article>;
}
