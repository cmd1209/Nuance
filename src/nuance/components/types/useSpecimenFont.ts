import { useEffect, useRef, useState } from "react";
import type { Typeface } from "../../domain/typefaces";
import { loadSpecimenFont, type FontLoadStatus } from "../../typography/fontLoading";

export function useSpecimenFont(font:Typeface,active:boolean) {
  const element=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState<FontLoadStatus>("idle");
  useEffect(()=>{
    if(!active)return;
    let disposed=false;
    let observer:IntersectionObserver|undefined;
    const load=()=>{
      if(disposed)return;
      observer?.disconnect();
      setStatus("loading");
      void loadSpecimenFont(font).then(result=>{if(!disposed)setStatus(result);});
    };
    if(typeof IntersectionObserver === "undefined")load();
    else {
      observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))load();},{rootMargin:"160px 0px"});
      if(element.current)observer.observe(element.current);
    }
    return ()=>{disposed=true;observer?.disconnect();};
  },[font,active]);
  return {element,status};
}
