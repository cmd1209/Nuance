import { useLayoutEffect, type RefObject } from "react";

export const MOBILE_EDITOR_QUERY = "(max-width: 700px), (pointer: coarse)";

/** Follow the visible viewport rather than assuming a particular keyboard height. */
export function useMobileEditing(root:RefObject<HTMLDivElement>) {
  useLayoutEffect(()=>{
    const app=root.current;
    if(!app)return;
    const viewport=window.visualViewport;
    const media=window.matchMedia(MOBILE_EDITOR_QUERY);
    let field:HTMLInputElement|HTMLTextAreaElement|null=null;
    let baseline=viewport?.height??window.innerHeight;
    let viewportWidth=window.innerWidth;
    let sawKeyboard=false;
    let frame=0;
    let needsReveal=false;

    function update() {
      frame=0;
      const focused=document.activeElement;
      const next=focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : null;
      // Keep the editor active when tabbing from its field to its Done control.
      const controls=focused instanceof HTMLElement ? focused.closest("[data-mobile-editor-controls]") : null;
      const candidate=next?.hasAttribute("data-mobile-edit-field") && app!.contains(next) ? next
        : field?.isConnected && controls?.closest("[data-mobile-editor]")?.contains(field) ? field : null;
      if(candidate!==field){field=candidate;sawKeyboard=false;}
      const height=viewport?.height??window.innerHeight;
      const top=viewport?.offsetTop??0;
      if(Math.abs(window.innerWidth-viewportWidth)>80){baseline=height;viewportWidth=window.innerWidth;sawKeyboard=false;}
      if(!field)baseline=height;
      const keyboardReduced=baseline-height>100;
      if(field && keyboardReduced)sawKeyboard=true;
      const editing=media.matches && field && (!sawKeyboard || keyboardReduced);
      const heading=field?.closest(".section-layout")?.querySelector(".section-layout__heading");
      const clearance=(heading?.getBoundingClientRect().height??0)+16;
      app!.style.setProperty("--mobile-viewport-height",`${height}px`);
      app!.style.setProperty("--mobile-viewport-bottom",`${top+height}px`);
      app!.style.setProperty("--mobile-editor-height",`${Math.max(44,height-clearance-72)}px`);
      app!.style.setProperty("--mobile-keyboard-inset",`${Math.max(0,window.innerHeight-height)}px`);
      if(editing)app!.dataset.mobileEditing=field!.dataset.mobileEditField;
      else delete app!.dataset.mobileEditing;

      if(needsReveal && editing && (viewport?.scale??1)<1.05){
        const bounds=field!.getBoundingClientRect();
        const safeTop=top+clearance;
        const safeBottom=top+height-(field!.dataset.mobileEditField==="text"?64:16);
        // The color panel is fixed to the visible area; only document text needs scrolling.
        if(field!.dataset.mobileEditField==="text"){
          const delta=bounds.top<safeTop ? bounds.top-safeTop : bounds.bottom>safeBottom ? bounds.bottom-safeBottom : 0;
          if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:"instant"});
        }
      }
      needsReveal=false;
    }
    function schedule(reveal=false) {
      needsReveal ||= reveal;
      if(!frame)frame=requestAnimationFrame(update);
    }
    const reveal=()=>schedule(true);
    const position=()=>schedule();
    app.addEventListener("focusin",reveal);
    app.addEventListener("focusout",position);
    app.addEventListener("input",reveal);
    viewport?.addEventListener("resize",reveal);
    viewport?.addEventListener("scroll",position);
    window.addEventListener("resize",reveal);
    media.addEventListener("change",reveal);
    // Removing a focused textarea does not consistently dispatch blur on mobile browsers.
    const observer=new MutationObserver(()=>{if(field && !field.isConnected)schedule();});
    observer.observe(app,{childList:true,subtree:true});
    update();
    return ()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      app.removeEventListener("focusin",reveal);
      app.removeEventListener("focusout",position);
      app.removeEventListener("input",reveal);
      viewport?.removeEventListener("resize",reveal);
      viewport?.removeEventListener("scroll",position);
      window.removeEventListener("resize",reveal);
      media.removeEventListener("change",reveal);
      delete app.dataset.mobileEditing;
      for(const property of ["--mobile-viewport-height","--mobile-viewport-bottom","--mobile-editor-height","--mobile-keyboard-inset"])app.style.removeProperty(property);
    };
  },[root]);
}
