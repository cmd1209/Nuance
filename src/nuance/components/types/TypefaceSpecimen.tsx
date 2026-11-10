import { useId, type ReactNode } from "react";
import { typefaceFamily, type Typeface } from "../../domain/typefaces";
import { useSpecimenFont } from "./useSpecimenFont";
import { ResizableTypeLine } from "./ResizableTypeLine";

const SPECIMEN_ALPHABET = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";

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

function SpecimenQuote({font,size,editor,alphabet=false}:{font:Typeface;size?:number;alphabet?:boolean;editor?:{active:boolean;status:string;size?:number;weight:number;onResize:(size:number)=>void}}) {
  const quote=SPECIMEN_QUOTES[TYPEFACE_QUOTES[font.id] ?? "bringhurst"];
  const text=alphabet?SPECIMEN_ALPHABET:quote.text;
  const Container=editor?"div":"span";
  return <Container className="type-specimen__quote">
    {editor ? <ResizableTypeLine label={alphabet?"Alphabet":"Quote"} className="type-specimen__quote-text" size={editor.size} min={14} max={192}
      active={editor.active} fontStatus={editor.status} fontWeight={editor.weight} onResize={editor.onResize}>{text}</ResizableTypeLine>
      : <span className="type-specimen__quote-text" style={size===undefined?undefined:{fontSize:`${size}px`}}>{text}</span>}
    {!alphabet && <span className="type-specimen__quote-caption">— {quote.author}</span>}
  </Container>;
}

function LoadNotice({status,classification}:{status:string;classification:Typeface["classification"]}) {
  return <span className="type-specimen__load-status" role="status">
    {status === "unavailable" ? `Font unavailable. Showing a ${classification} fallback.` : status === "loading" ? "Loading typeface…" : ""}
  </span>;
}

function SpecimenHeader({font,action,heading=false,classificationId}:{font:Typeface;action?:ReactNode;heading?:boolean;classificationId?:string}) {
  return <header className="palette-card__header">
    <div className="type-specimen__identity">
      {heading ? <h2 className="palette-card__label composition-source__name" id="types-detail-heading" tabIndex={-1}>{font.family}</h2>
        : <span className="palette-card__label composition-source__name">{font.family}</span>}
      <span className="type-specimen__metadata"><span aria-hidden="true">|</span><span id={classificationId} title={font.sourceLabel}>{font.classification === "serif" ? "Serif" : "Sans-serif"}</span></span>
    </div>
    {action}
  </header>;
}

export function TypefaceCard({font,active,onSelect,headerAction,disabled=false,size,weight=font.loading.specimenWeight,alphabet=false}:{font:Typeface;active:boolean;onSelect:()=>void;headerAction?:ReactNode;disabled?:boolean;size?:number;weight?:number;alphabet?:boolean}) {
  const {element,status}=useSpecimenFont(font,active);
  const classificationId=useId();
  return <div ref={element} className="type-specimen" data-font-id={font.id} data-font-status={status}>
    <SpecimenHeader font={font} action={headerAction} classificationId={classificationId} />
    <button type="button" className="type-specimen__button" disabled={disabled} aria-label={`Preview ${font.family}`} aria-describedby={classificationId} onClick={onSelect}>
      <span className="type-specimen__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:weight}}>
        <SpecimenQuote font={font} size={size} alphabet={alphabet} />
      </span>
      <LoadNotice status={status} classification={font.classification} />
    </button>
  </div>;
}
export function TypefaceDetail({font,active,size,onResize,alphabet=false,weight=font.loading.specimenWeight}:{font:Typeface;active:boolean;size?:number;alphabet?:boolean;weight?:number;onResize:(size:number)=>void}) {
  const {element,status}=useSpecimenFont(font,active);
  return <article className="type-specimen type-detail" aria-labelledby="types-detail-heading" data-font-id={font.id} data-font-status={status}>
    <SpecimenHeader font={font} heading />
    <div ref={element} className="type-detail__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:weight}}>
      <SpecimenQuote font={font} alphabet={alphabet} editor={{active,status,size,weight,onResize}} />
    </div>
    <LoadNotice status={status} classification={font.classification} />
  </article>;
}
