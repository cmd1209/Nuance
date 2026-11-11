import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { TYPEFACE_CLASSIFICATION_LABELS, typefaceFamily, type Typeface } from "../../domain/typefaces";
import { useSpecimenFont } from "./useSpecimenFont";
import { Button } from "../Button";
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
  "google-fonts:lato": "spiekermann",
  "google-fonts:noto-sans": "bringhurst",
  "google-fonts:roboto": "spiekermann",
  "google-fonts:nunito-sans": "vignelli",
  "google-fonts:pt-serif": "bringhurst",
  "google-fonts:work-sans": "vignelli",
  "google-fonts:fira-sans": "spiekermann",
  "google-fonts:noto-serif": "bringhurst",
  "google-fonts:inconsolata": "carter",
  "google-fonts:dm-sans": "spiekermann",
  "google-fonts:josefin-sans": "carter",
  "google-fonts:barlow": "vignelli",
  "google-fonts:bitter": "bringhurst",
  "google-fonts:source-code-pro": "spiekermann",
  "google-fonts:arvo": "carter",
  "google-fonts:exo-2": "vignelli",
  "google-fonts:comfortaa": "carter",
  "google-fonts:vollkorn": "bringhurst",
  "google-fonts:signika-negative": "spiekermann",
  "google-fonts:figtree": "vignelli",
  "google-fonts:questrial": "spiekermann",
  "google-fonts:archivo-black": "vignelli",
};

function SpecimenQuote({font,size,editor,alphabet=false,custom=false,customText,editing=false,onTextChange,onFinishEditing,onEdit}:{font:Typeface;size?:number;alphabet?:boolean;custom?:boolean;customText?:string;editing?:boolean;onTextChange?:(text:string)=>void;onFinishEditing?:()=>void;onEdit?:()=>void;editor?:{active:boolean;status:string;size?:number;weight:number;onResize:(size:number)=>void}}) {
  const quote=SPECIMEN_QUOTES[TYPEFACE_QUOTES[font.id] ?? "bringhurst"];
  const text=custom?(customText??quote.text):alphabet?SPECIMEN_ALPHABET:quote.text;
  const input=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{
    if(!editing || !editor?.active || !input.current)return;
    const textarea=input.current;
    const fitContent=()=>{
      textarea.style.height="auto";
      textarea.style.height=`${textarea.scrollHeight}px`;
    };
    fitContent();
    let width=textarea.getBoundingClientRect().width;
    const observer=new ResizeObserver(()=>{
      const nextWidth=textarea.getBoundingClientRect().width;
      if(nextWidth!==width){width=nextWidth;fitContent();}
    });
    observer.observe(textarea);
    return ()=>observer.disconnect();
  },[editing,text,editor?.active,editor?.size,editor?.status,editor?.weight]);
  function finishEditing(){input.current?.blur();onFinishEditing?.();}
  const Container=editor?"div":"span";
  return <Container className="type-specimen__quote" data-mobile-editor>
    {editing ? <><textarea ref={input} rows={1} data-mobile-edit-field="text" autoFocus aria-label="Specimen text" title="Press Ctrl+Enter or Command+Enter to finish editing" className="type-specimen__quote-text type-specimen__text-input" maxLength={2000} value={text}
      style={editor?.size===undefined?undefined:{fontSize:`${editor.size}px`}} onChange={event=>onTextChange?.(event.target.value)}
      onKeyDown={event=>{if(event.key==="Escape" || event.key==="Enter" && (event.metaKey || event.ctrlKey)){event.preventDefault();finishEditing();}}} />
      <Button className="type-specimen__finish-editing" data-mobile-editor-controls onPointerDown={event=>event.preventDefault()} onClick={finishEditing}>Done</Button></>
      : editor ? <ResizableTypeLine onEdit={custom?onEdit:undefined} label={custom?"Custom text":alphabet?"Alphabet":"Quote"} className="type-specimen__quote-text" size={editor.size} min={14} max={192}
      active={editor.active} fontStatus={editor.status} fontWeight={editor.weight} onResize={editor.onResize}>{text}</ResizableTypeLine>
      : <span className="type-specimen__quote-text" style={size===undefined?undefined:{fontSize:`${size}px`}}>{text}</span>}
    {!alphabet && !custom && <span className="type-specimen__quote-caption">— {quote.author}</span>}
  </Container>;
}

function LoadNotice({status,classification}:{status:string;classification:Typeface["classification"]}) {
  return <span className="type-specimen__load-status" role="status">
    {status === "unavailable" ? `Font unavailable. Showing a ${classification==="display"?"sans-serif":classification} fallback.` : status === "loading" ? "Loading typeface…" : ""}
  </span>;
}

function SpecimenHeader({font,action,heading=false,classificationId}:{font:Typeface;action?:ReactNode;heading?:boolean;classificationId?:string}) {
  return <header className="palette-card__header">
    <div className="type-specimen__identity">
      {heading ? <h2 className="palette-card__label composition-source__name" id="types-detail-heading" tabIndex={-1}>{font.family}</h2>
        : <span className="palette-card__label composition-source__name">{font.family}</span>}
      <span className="type-specimen__metadata"><span aria-hidden="true">|</span><span id={classificationId} title={font.sourceLabel}>{TYPEFACE_CLASSIFICATION_LABELS[font.classification]}</span></span>
    </div>
    {action}
  </header>;
}

export function TypefaceCard({font,active,onSelect,headerAction,disabled=false,size,weight=font.loading.specimenWeight,alphabet=false,custom=false,customText}:{font:Typeface;custom?:boolean;customText?:string;active:boolean;onSelect:()=>void;headerAction?:ReactNode;disabled?:boolean;size?:number;weight?:number;alphabet?:boolean}) {
  const {element,status}=useSpecimenFont(font,active,weight);
  const classificationId=useId();
  return <div ref={element} className="type-specimen" data-font-id={font.id} data-font-status={status}>
    <SpecimenHeader font={font} action={headerAction} classificationId={classificationId} />
    <button type="button" className="type-specimen__button" disabled={disabled} aria-label={`Preview ${font.family}`} aria-describedby={classificationId} onClick={onSelect}>
      <span className="type-specimen__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:weight}}>
        <SpecimenQuote font={font} size={size} alphabet={alphabet} custom={custom} customText={customText} />
      </span>
      <LoadNotice status={status} classification={font.classification} />
    </button>
  </div>;
}
export function TypefaceDetail({font,active,size,onResize,alphabet=false,weight=font.loading.specimenWeight,custom=false,customText,editing=false,onTextChange,onFinishEditing,onEdit}:{font:Typeface;custom?:boolean;customText?:string;editing?:boolean;onTextChange:(text:string)=>void;onFinishEditing:()=>void;onEdit:()=>void;active:boolean;size?:number;alphabet?:boolean;weight?:number;onResize:(size:number)=>void}) {
  const {element,status}=useSpecimenFont(font,active,weight);
  return <article className="type-specimen type-detail" aria-labelledby="types-detail-heading" data-font-id={font.id} data-font-status={status}>
    <SpecimenHeader font={font} heading />
    <div ref={element} className="type-detail__artwork" style={{fontFamily:typefaceFamily(font),fontWeight:weight}}>
      <SpecimenQuote font={font} alphabet={alphabet} custom={custom} customText={customText} editing={editing} onTextChange={onTextChange} onFinishEditing={onFinishEditing} onEdit={onEdit} editor={{active,status,size,weight,onResize}} />
    </div>
    <LoadNotice status={status} classification={font.classification} />
  </article>;
}
