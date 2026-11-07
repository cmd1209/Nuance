import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Layers } from "lucide-react";
import { DESIGN_CATEGORIES, type DesignCategoryId } from "../domain/categories";

const categoryIcons: Record<string, IconName> = { colors: "color", types: "type", spaces: "space", details: "detail" };

export function Navigation({ activeSection = "colors", onSelect }: {
  activeSection?: DesignCategoryId; onSelect?: (section: DesignCategoryId) => void;
}) {
  return <nav className="nuance-navigation" aria-label="Design exploration">
    {DESIGN_CATEGORIES.map(({ id, label, enabled }) => <Button key={id} size="LG" variant="navigation"
      className={!enabled ? "is-future" : id === activeSection ? "is-active" : undefined} aria-current={enabled && id === activeSection ? "page" : undefined}
      disabled={!enabled} title={enabled ? `${label} exploration` : `${label} — coming soon`} onClick={() => onSelect?.(id)}
      leadingIcon={id === "designs" ? <Layers size={20} aria-hidden="true" /> : <Icon name={categoryIcons[id]} size={20} />}>
      {label}
    </Button>)}
  </nav>;
}
