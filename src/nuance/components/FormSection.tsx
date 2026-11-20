import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { FORM_GROUPS, FORM_SETTING_LABELS, INITIAL_FORM_SETTINGS, type FormSettingId } from "../domain/form";
import { FOUNDATION_SECTIONS, type CreativeView } from "../domain/sections";
import { Button } from "./Button";
import { CollectionGrid } from "./CollectionGrid";
import { SectionLayout } from "./SectionLayout";
import { SectionNavigation } from "./SectionNavigation";
import { SavedFormConfigurations } from "./form/SavedFormConfigurations";
import { FormSettingIcon } from "./form/FormSettingIcon";
import "./form/form.css";

export function FormSection({ hidden, onViewChange }: { hidden: boolean; onViewChange: () => void }) {
  const [view, setView] = useState<CreativeView>("explore");
  const [selection, setSelection] = useState<FormSettingId | null>(null);
  const focusEditor = useRef(false);
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
  function changeView(next: CreativeView) { setView(next); onViewChange(); }
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
  return <SectionLayout hidden={hidden} title={definition.title} headingId="form-heading" description={definition.descriptions[view]}
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
    <section id="form-saved-panel" role="tabpanel" aria-labelledby="form-saved-tab" hidden={view !== "saved"}>
      <SavedFormConfigurations items={[]} onOpen={item => select(item.setting)} />
    </section>
    {selection && <section id="form-edit-panel" role="tabpanel" aria-labelledby="form-edit-tab" hidden={view !== "edit"}>
      <div className="nuance-stage form-editor-shell">
        <h2 id="form-editor-heading" className="form-setting__identity" tabIndex={-1}><FormSettingIcon setting={selection} />{FORM_SETTING_LABELS[selection]}</h2>
        <p>The {FORM_SETTING_LABELS[selection].toLowerCase()} editor is coming next.</p>
        <Button onClick={() => {
          changeView("explore");
          document.getElementById("form-explore-tab")?.focus({ preventScroll: true });
        }}>Back to Explore</Button>
      </div>
    </section>}
  </SectionLayout>;
}
