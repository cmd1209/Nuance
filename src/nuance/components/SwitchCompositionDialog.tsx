import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

export function SwitchCompositionDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} className="account-dialog" aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-description`}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={`${prefix}-title`}>Switch palettes?</h2>
    <p id={`${prefix}-description`}>Your current composition has unsaved changes. Switch palettes and discard these changes?</p>
    <div className="account-dialog__actions">
      <Button autoFocus onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onDiscard}>Discard &amp; Switch</Button>
    </div>
  </dialog>;
}
