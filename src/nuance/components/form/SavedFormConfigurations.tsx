import { FORM_GROUPS, FORM_SETTING_LABELS, MAX_SAVED_FORM_CONFIGURATIONS, type SavedFormConfiguration } from "../../domain/form";
import { CollectionGrid } from "../CollectionGrid";
import { FormSettingIcon } from "./FormSettingIcon";

export function SavedFormConfigurations({ items, onOpen }: {
  items: readonly SavedFormConfiguration[];
  onOpen: (item: SavedFormConfiguration) => void;
}) {
  return <div className="form-groups">
    {FORM_GROUPS.map(group => <section key={group.id} className="form-group" aria-labelledby={`form-saved-${group.id}`}>
      <header className="form-group__heading">
        <h2 id={`form-saved-${group.id}`}>{group.title}</h2>
      </header>
      {group.settings.filter(setting => items.some(item => item.setting === setting)).map(setting => {
        const configurations = items.filter(item => item.setting === setting);
        return <div key={setting} className="form-saved-component">
          <div className="form-saved-component__heading">
            <h3 className="form-setting__identity"><FormSettingIcon setting={setting} />{FORM_SETTING_LABELS[setting]}</h3>
            <span>{configurations.length}/{MAX_SAVED_FORM_CONFIGURATIONS}</span>
          </div>
          <CollectionGrid items={configurations} className="form-grid" label={`Saved ${FORM_SETTING_LABELS[setting]}`}
            renderItem={item => <button type="button" className="form-setting" onClick={() => onOpen(item)}>
              <span className="form-setting__identity"><FormSettingIcon setting={setting} /><span className="form-setting__name">{item.name}</span></span>
            </button>} />
        </div>;
      })}
      {!items.some(item => (group.settings as readonly string[]).includes(item.setting)) &&
        <p className="form-group__empty">No saved components yet.</p>}
    </section>)}
  </div>;
}
