import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { MOBILE_EDITOR_QUERY } from "./mobile/useMobileEditing";
import { normalizeHex, type ColorValue } from "../domain/composition";
import { Button } from "./Button";

export function ColorEditor({ color, onChange, onClose }: { color: ColorValue; onChange: (hex: string) => void; onClose: () => void }) {
  const [input, setInput] = useState(color.hex), [invalid, setInvalid] = useState(false);
  const dialog = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const [mobile,setMobile]=useState(()=>typeof window!=="undefined" && window.matchMedia(MOBILE_EDITOR_QUERY).matches);
  useEffect(()=>{
    const media=window.matchMedia(MOBILE_EDITOR_QUERY);
    const update=()=>setMobile(media.matches);
    media.addEventListener("change",update);
    return ()=>media.removeEventListener("change",update);
  },[]);
  useEffect(() => { setInput(color.hex); setInvalid(false); }, [color.id, color.hex]);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if(mobile)dialog.current?.focus({preventScroll:true});
    else {field.current?.focus();field.current?.select();}
    const outside = (e: PointerEvent) => { if (!dialog.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("pointerdown", outside); if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, [onClose,mobile]);
  function submit(event: FormEvent) { event.preventDefault(); const hex = normalizeHex(input); if (hex) { onChange(hex); onClose(); } else setInvalid(true); }
  const editor=<div ref={dialog} tabIndex={-1} data-mobile-editor className="color-editor" role="dialog" aria-label="Adjust selected color" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
    <form onSubmit={submit}>
      <div className="color-editor__top"><label htmlFor="color-picker">Color</label><button type="button" className="color-editor__close" aria-label="Close color editor" onPointerDown={event=>event.preventDefault()} onClick={onClose}>×</button></div>
      <p>{color.origin === "generated" ? "Nuance-generated extension" : color.origin === "user" ? `Custom color${color.originalHex ? ` · originally ${color.name} (${color.originalHex})` : ""}` : color.name}</p>
      <input id="color-picker" aria-label="Choose color" type="color" value={color.hex} onChange={e => onChange(e.target.value)} />
      <label htmlFor="hex-input">HEX</label>
      <div className="color-editor__hex-row"><input ref={field} id="hex-input" aria-invalid={invalid} aria-describedby={invalid ? "hex-error" : undefined} value={input} maxLength={7} spellCheck={false} autoComplete="off" autoCapitalize="none" enterKeyHint="done" data-mobile-edit-field="color"
        onChange={e => { setInput(e.target.value); const hex = normalizeHex(e.target.value); setInvalid(false); if (hex && e.target.value.replace(/^#/, "").length === 6) onChange(hex); }}
        onBlur={() => { const hex = normalizeHex(input); if (hex) onChange(hex); else setInvalid(true); }} />
        <Button type="submit" data-mobile-editor-controls onPointerDown={event=>event.preventDefault()}>Done</Button></div>
      {invalid && <p id="hex-error" role="alert">Enter a 3 or 6 digit HEX color.</p>}
    </form>
  </div>;
  const portal=mobile && typeof document!=="undefined" ? document.querySelector(".nuance-app") : null;
  return portal?createPortal(editor,portal):editor;
}
