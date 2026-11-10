import { useId, type ReactNode } from "react";
import { typefaceFamily, type Typeface } from "../../domain/typefaces";
import { useSpecimenFont } from "./useSpecimenFont";

const SPECIMEN_HEADLINE = "Aa Bb Cc Dd";
const SPECIMEN_SUBHEADLINE = "Form, rhythm, character.";

const SPECIMEN_QUOTES = {
  bringhurst: { text: "Typography exists to honor content.", author: "Robert Bringhurst" },
  spiekermann: { text: "Type is visible language.", author: "Erik Spiekermann" },
  carter: { text: "A typeface is a beautiful collection of letters, not a collection of beautiful letters.", author: "Matthew Carter" },
  vignelli: { text: "If you can design one thing then you can design everything.", author: "Massimo Vignelli" },
} as const;

// Assign by permanent font ID so gallery order and view changes never change the quote.
const TYPEFACE_QUOTES: Readonly<Record<string, keyof typeof SPECIMEN_QUOTES>> = {
  "google-fonts:dm-serif-display": "bringhurst",
  "google-fonts:inter": "spiekermann",
  "google-fonts:manrope": "vignelli",
  "google-fonts:fraunces": "carter",
  "google-fonts:libre-baskerville": "bringhurst",
  "google-fonts:ibm-plex-sans": "spiekermann",
  "google-fonts:space-grotesk": "vignelli",
  "google-fonts:cormorant-garamond": "carter",
};

function SpecimenQuote({font}:{font:Typeface}) {
  const quote=SPECIMEN_QUOTES[TYPEFACE_QUOTES[font.id] ?? "bringhurst"];
  return <span className="type-specimen__quote">
    <span className="type-specimen__quote-text">“{quote.text}”</span>
    <span className="type-specimen__quote-caption">— {quote.author}</span>
  </span>;
}

function LoadNotice({status,classification}:{status:string;classification:Typeface["classification"]}) {
  return <span className="type-specimen__load-status" role="status">
    {status === "unavailable" ? `Font unavailable. Showing a ${classification} fallback.` : status === "loading" ? "Loading typeface…" : ""}
  </span>;
}
export function TypefaceCard({font,active,onSelect,headerAction,disabled=false}:{font:Typeface;active:boolean;onSelect:()=>void;headerAction?:ReactNode;disabled?:boolean}) {
  const {element,status}=useSpecimenFont(font,active);
  const classificationId=useId();
  return <div ref={element} className="type-specimen" data-font-id={font.id} data-font-status={status}>
    {headerAction && <div className="type-specimen__action">{headerAction}</div>}
    <button type="button" className="type-specimen__button" disabled={disabled} aria-label={`Preview ${font.family}`} aria-describedby={classificationId} onClick={onSelect}>
      <span className="type-specimen__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:font.loading.specimenWeight}}>
        <span className="type-specimen__sample">{SPECIMEN_HEADLINE}</span>
        <span className="type-specimen__sentence">{SPECIMEN_SUBHEADLINE}</span>
        <SpecimenQuote font={font} />
      </span>
      <LoadNotice status={status} classification={font.classification} />
      <span className="type-specimen__metadata"><span className="type-specimen__name">{font.family}</span><span id={classificationId}>{font.classification === "serif" ? "Serif" : "Sans-serif"}</span></span>
    </button>
  </div>;
}
export function TypefaceDetail({font,active}:{font:Typeface;active:boolean}) {
  const {element,status}=useSpecimenFont(font,active);
  return <article className="type-specimen type-detail" aria-labelledby="types-detail-heading" data-font-id={font.id} data-font-status={status}>
    <div ref={element} className="type-detail__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:font.loading.specimenWeight}}>
      <p className="type-detail__sample">{SPECIMEN_HEADLINE}</p>
      <p className="type-detail__phrase">{SPECIMEN_SUBHEADLINE}</p>
      <SpecimenQuote font={font} />
    </div>
    <LoadNotice status={status} classification={font.classification} />
    <div className="type-specimen__metadata">
      <h2 className="type-specimen__name" id="types-detail-heading" tabIndex={-1}>{font.family}</h2>
      <span title={font.sourceLabel}>{font.classification === "serif" ? "Serif" : "Sans-serif"}</span>
    </div>
  </article>;
}
