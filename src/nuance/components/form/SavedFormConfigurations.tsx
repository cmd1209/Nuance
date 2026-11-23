import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { FORM_GROUPS, FORM_SETTING_LABELS, MAX_SAVED_FORM_CONFIGURATIONS, type SavedFormConfiguration } from "../../domain/form";
import { CollectionGrid } from "../CollectionGrid";
import { Button } from "../Button";
import { FormSettingIcon } from "./FormSettingIcon";

export function SavedFormConfigurations<T extends SavedFormConfiguration>({ items, onOpen, onRename, onDelete, renderPreview, busy = false }: {
  items: readonly T[];
  onOpen: (item: T) => void;
  onRename?: (item: T) => void;
  onDelete?: (item: T) => void;
  renderPreview?: (item: T) => ReactNode;
  busy?: boolean;
}) {
  return <div className="form-groups">
    {FORM_GROUPS.map(group => <section key={group.id} className="form-group" aria-labelledby={`form-saved-${group.id}`}>
      <header className="form-group__heading"><h2 id={`form-saved-${group.id}`}>{group.title}</h2></header>
      {group.settings.filter(setting => items.some(item => item.setting === setting)).map(setting => {
        const configurations = items.filter(item => item.setting === setting);
        return <div key={setting} className="form-saved-component">
          <div className="form-saved-component__heading">
            <h3 className="form-setting__identity"><FormSettingIcon setting={setting} />{FORM_SETTING_LABELS[setting]}</h3>
            <span>{configurations.length}/{MAX_SAVED_FORM_CONFIGURATIONS}</span>
          </div>
          <CollectionGrid items={configurations} className="form-grid" label={`Saved ${FORM_SETTING_LABELS[setting]}`}
            renderItem={item => <div className="form-study-card">
              <header className="palette-card__header">
                <span className="palette-card__label composition-source__name">{item.name}</span>
                <div className="form-study-card__actions">
                  {onRename && <Button size="XS" disabled={busy} aria-label={`Rename ${item.name}`} title="Rename study"
                    onClick={() => onRename(item)} leadingIcon={<Pencil size={16} aria-hidden="true" />} />}
                  {onDelete && <Button size="XS" disabled={busy} aria-label={`Delete ${item.name}`} title="Delete study"
                    onClick={() => onDelete(item)} leadingIcon={<Trash2 size={16} aria-hidden="true" />} />}
                </div>
              </header>
              <button type="button" className="form-setting form-study-card__open" disabled={busy} aria-label={`Edit ${item.name}`} onClick={() => onOpen(item)}>
                {renderPreview ? renderPreview(item) : <span className="form-setting__identity"><FormSettingIcon setting={setting} /><span className="form-setting__name">{item.name}</span></span>}
              </button>
            </div>} />
        </div>;
      })}
      {!items.some(item => (group.settings as readonly string[]).includes(item.setting)) && <p className="form-group__empty">No saved components yet.</p>}
    </section>)}
  </div>;
}
