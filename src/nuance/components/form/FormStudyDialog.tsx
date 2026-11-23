import { useEffect, useId, useRef, useState } from "react";
import { MAX_SAVED_FORM_CONFIGURATIONS } from "../../domain/form";
import { validStudyName, type SizingStudy } from "../../domain/formStudies";
import { Button } from "../Button";

export function FormStudyDialog({ mode, study, saved, busy, error, onCancel, onSave }: {
  mode: "save" | "rename";
  study?: SizingStudy;
  saved: readonly SizingStudy[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (name: string, targetId?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const [name, setName] = useState(study?.name ?? "Sizing study");
  const [asNew, setAsNew] = useState(false);
  const [replacement, setReplacement] = useState("");
  const updating = !!study && !asNew;
  const full = !updating && saved.length >= MAX_SAVED_FORM_CONFIGURATIONS;
  const target = updating ? study.id : full ? replacement : undefined;
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="account-dialog form-study-dialog" aria-labelledby={`${prefix}-title`}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <form onSubmit={event => { event.preventDefault(); if (!busy && validStudyName(name) && (!full || replacement)) onSave(name.trim(), target); }}>
      <h2 id={`${prefix}-title`}>{mode === "rename" ? "Rename study" : "Save sizing study"}</h2>
      <label className="form-study-dialog__field">Name
        <input autoFocus type="text" value={name} maxLength={80} required disabled={busy} onChange={event => setName(event.target.value)} />
      </label>
      {mode === "save" && study && <label className="form-study-dialog__new">
        <input type="checkbox" checked={asNew} disabled={busy} onChange={event => setAsNew(event.target.checked)} />Save as a new study
      </label>}
      {full && <label className="form-study-dialog__field">
        All three slots are in use. Choose a study to replace.
        <select aria-label="Study to replace" required value={replacement} disabled={busy} onChange={event => setReplacement(event.target.value)}>
          <option value="">Choose a study…</option>
          {saved.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      {error && <p role="alert">{error}</p>}
      <div className="account-dialog__actions">
        <Button disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy || !validStudyName(name) || full && !replacement} aria-busy={busy}>
          {busy ? "Saving…" : mode === "rename" ? "Rename study" : full ? "Replace study" : updating ? "Update study" : "Save study"}
        </Button>
      </div>
    </form>
  </dialog>;
}
