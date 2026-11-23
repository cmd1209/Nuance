import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, HeartPlus, RotateCcw } from "lucide-react";
import { FORM_GROUPS, FORM_SETTING_LABELS, INITIAL_FORM_SETTINGS, type FormSettingId } from "../domain/form";
import { FOUNDATION_SECTIONS, type CreativeView } from "../domain/sections";
import { Button } from "./Button";
import { CollectionGrid } from "./CollectionGrid";
import { SectionLayout } from "./SectionLayout";
import { SectionNavigation } from "./SectionNavigation";
import { SavedFormConfigurations } from "./form/SavedFormConfigurations";
import { FormSettingIcon } from "./form/FormSettingIcon";
import { SizingEditor } from "./form/SizingEditor";
import { createSizingConfiguration } from "../domain/sizing";
import { newId } from "../domain/composition";
import { createSizingStudy, type SizingStudy } from "../domain/formStudies";
import { useFormStudies } from "../account/useFormStudies";
import { accountError, type Account } from "../account/useAccount";
import { FormStudyDialog } from "./form/FormStudyDialog";
import { SizingMiniature } from "./form/SizingMiniature";
import { EmptyState } from "./EmptyState";
import "./form/form.css";

const GUEST_ACCOUNT = { user: null, authLoading: false };

export function FormSection({ hidden, onViewChange, account = GUEST_ACCOUNT, onSignIn = () => {} }: {
  hidden: boolean; onViewChange: () => void;
  account?: Pick<Account, "user" | "authLoading">; onSignIn?: () => void;
}) {
  const [view, setView] = useState<CreativeView>("explore");
  const [selection, setSelection] = useState<FormSettingId | null>(null);
  const [sizing, setSizing] = useState(createSizingConfiguration);
  const studies = useFormStudies(account.user?.id);
  const [resetSizing, setResetSizing] = useState(createSizingConfiguration);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [valid, setValid] = useState(true);
  const [editorRevision, setEditorRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ mode: "save" | "rename"; study?: SizingStudy } | null>(null);
  const [busy, setBusy] = useState(false), [dialogError, setDialogError] = useState("");
  const owner = useRef(account.user?.id), previousOwner = useRef(account.user?.id), mutating = useRef(false);
  owner.current = account.user?.id;
  const documents = studies.saved.map(item => item.document);
  const activeStudy = documents.find(item => item.id === editingId);
  const focusSaved = useRef(false);
  const focusEditor = useRef(false);
  useEffect(() => {
    if (previousOwner.current && previousOwner.current !== account.user?.id) {
      setSizing(createSizingConfiguration()); setResetSizing(createSizingConfiguration());
      setEditingId(null); setSelection(null); setView("explore"); setDialog(null); setNotice(""); setValid(true);
    }
    previousOwner.current = account.user?.id;
  }, [account.user?.id]);
  useEffect(() => { if (hidden) setDialog(null); }, [hidden]);
  useLayoutEffect(() => {
    if (focusSaved.current && !busy && !hidden && view === "saved") {
      document.getElementById("form-saved-panel")?.focus({ preventScroll: true });
      focusSaved.current = false;
    }
  }, [studies.saved, busy, hidden, view]);

  function openStudy(item: SizingStudy) {
    const dirty = JSON.stringify(sizing) !== JSON.stringify(resetSizing);
    if (dirty && !window.confirm("Open this study and discard your unsaved sizing changes?")) return;
    setSizing(item.values); setResetSizing(item.values); setEditingId(item.id);
    setEditorRevision(previous => previous + 1); setValid(true); select("sizing");
  }
  function openSave() {
    if (!account.user) { onSignIn(); return; }
    setDialogError(""); setDialog({ mode: "save", study: activeStudy });
  }
  async function saveStudy(name: string, targetId?: string) {
    if (mutating.current) return;
    const operationOwner = owner.current;
    const mode = dialog?.mode;
    const source = mode === "rename" ? dialog!.study!.values : sizing;
    mutating.current = true; setBusy(true); setDialogError("");
    try {
      const document = createSizingStudy(targetId ?? newId(), name, source);
      const result = await studies.save(document);
      if (owner.current !== operationOwner) return;
      if (mode === "save") { setEditingId(result.document.id); setResetSizing(result.document.values); }
      setDialog(null); setNotice(mode === "rename" ? "Study renamed." : "Sizing study saved.");
    } catch (error) { if (owner.current === operationOwner) setDialogError(accountError(error)); }
    finally { mutating.current = false; setBusy(false); }
  }
  async function deleteStudy(item: SizingStudy) {
    if (mutating.current || !window.confirm(`Delete “${item.name}” from your saved studies?`)) return;
    const operationOwner = owner.current;
    mutating.current = true; setBusy(true); setNotice("");
    try {
      await studies.remove(item.id);
      if (owner.current !== operationOwner) return;
      if (editingId === item.id) setEditingId(null);
      setNotice("Study deleted."); focusSaved.current = true;
    } catch (error) { if (owner.current === operationOwner) setNotice(accountError(error)); }
    finally { mutating.current = false; setBusy(false); }
  }
  useLayoutEffect(() => {
    if (hidden) return;
    const heading = document.getElementById("form-heading")?.parentElement;
    const section = heading?.parentElement;
    if (!heading || !section) return;
    // The title and tabs can wrap or grow with text size and safe-area padding.
    const measure = () => section.style.setProperty("--form-sticky-offset", `${heading.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [hidden]);
  function changeView(next: CreativeView) { setView(next); setNotice(""); onViewChange(); }
  function select(setting: FormSettingId) {
    setSelection(setting);
    focusEditor.current = true;
    changeView("edit");
  }
  useLayoutEffect(() => {
    if (!hidden && view === "edit" && focusEditor.current) {
      document.getElementById("form-editor-heading")?.focus({ preventScroll: true });
      focusEditor.current = false;
    }
  }, [hidden, view, selection]);
  const definition = FOUNDATION_SECTIONS.form;
  return <SectionLayout hidden={hidden} title={definition.title} headingId="form-heading" notice={notice} description={definition.descriptions[view]}
    navigation={<SectionNavigation prefix="form" label="Form views" value={view} hasDraft={!!selection} onChange={changeView} />}>
    <section id="form-explore-panel" role="tabpanel" aria-labelledby="form-explore-tab" hidden={view !== "explore"}>
      <div className="form-groups">
        {FORM_GROUPS.map(group => <section key={group.id} className="form-group" aria-labelledby={`form-explore-${group.id}`}>
          <header className="form-group__heading">
            <h2 id={`form-explore-${group.id}`}>{group.title}</h2>
          </header>
          <CollectionGrid items={group.settings.map(id => ({ id }))} className="form-grid" label={`${group.title} settings`}
            renderItem={({ id }) => {
              const available = INITIAL_FORM_SETTINGS.includes(id);
              return <button type="button" className="form-setting" disabled={!available} onClick={() => select(id)}>
                <span className="form-setting__identity"><FormSettingIcon setting={id} /><span className="form-setting__name">{FORM_SETTING_LABELS[id]}</span></span>
                {available ? <ArrowUpRight size={20} aria-hidden="true" /> : <span className="form-setting__status">Coming soon</span>}
              </button>;
            }} />
        </section>)}
      </div>
    </section>
    <section id="form-saved-panel" role="tabpanel" tabIndex={-1} aria-labelledby="form-saved-tab" hidden={view !== "saved"} aria-busy={studies.loading || busy}>
      {account.authLoading ? <p role="status">Loading your account…</p> : !account.user
        ? <EmptyState message="Sign in to see your saved Form studies." action={<Button onClick={onSignIn}>Sign in</Button>} />
        : <>
          {studies.loading && <p role="status">Loading Form studies…</p>}
          {studies.error && <div><p role="alert">{studies.error}</p><Button disabled={busy || studies.loading} onClick={() => { void studies.refresh(); }}>Try again</Button></div>}
          {(!studies.loading && !studies.error || documents.length > 0) && <SavedFormConfigurations items={documents} busy={busy || studies.loading}
            onOpen={openStudy} onRename={item => { setDialogError(""); setDialog({ mode: "rename", study: item }); }}
            onDelete={item => { void deleteStudy(item); }} renderPreview={item => <SizingMiniature value={item.values} />} />}
        </>}
    </section>
    {selection && <section id="form-edit-panel" role="tabpanel" aria-labelledby="form-edit-tab" hidden={view !== "edit"}>
      <div className="nuance-stage form-editor-shell">
        <h2 id="form-editor-heading" className="form-setting__identity" tabIndex={-1}><FormSettingIcon setting={selection} />{FORM_SETTING_LABELS[selection]}</h2>
        {selection === "sizing" ? <>
          {activeStudy && <div className="palette-card__header"><span className="palette-card__label composition-source__name">{activeStudy.name}</span></div>}
          <SizingEditor key={`${editingId ?? "draft"}:${editorRevision}`} value={sizing} onChange={setSizing} onValidityChange={setValid} />
          <div className="composition-actions" role="group" aria-label="Sizing study actions">
            <Button className="composition-action" aria-label="Reset sizing study" title="Reset to the selected study or initial curve"
              disabled={busy} onClick={() => { setSizing({ ...resetSizing, points: [...resetSizing.points], positions: [...resetSizing.positions] }); setEditorRevision(previous => previous + 1); setValid(true); setNotice(""); }}
              leadingIcon={<RotateCcw size={20} aria-hidden="true" />} />
            <Button className="composition-action" aria-label="Save sizing study" title="Save sizing study"
              disabled={busy || !valid || account.authLoading || !!account.user && (studies.loading || !!studies.error)}
              onClick={openSave} leadingIcon={<HeartPlus size={20} aria-hidden="true" />} />
          </div>
        </> : <>
          <p>The {FORM_SETTING_LABELS[selection].toLowerCase()} editor is coming next.</p>
          <Button onClick={() => {
            changeView("explore");
            document.getElementById("form-explore-tab")?.focus({ preventScroll: true });
          }}>Back to Explore</Button>
        </>}
      </div>
    </section>}
    {dialog && !hidden && <FormStudyDialog key={`${dialog.mode}:${dialog.study?.id ?? "new"}`} mode={dialog.mode} study={dialog.study}
      saved={documents} busy={busy} error={dialogError} onCancel={() => { if (!busy) setDialog(null); }}
      onSave={(name, targetId) => { void saveStudy(name, targetId); }} />}
  </SectionLayout>;
}
