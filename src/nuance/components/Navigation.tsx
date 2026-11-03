import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Layers } from "lucide-react";
import { DESIGN_CATEGORIES } from "../domain/categories";

const categoryIcons: Record<string, IconName> = { colors: "color", types: "type", spaces: "space", details: "detail" };

export function Navigation() {
  return <nav className="nuance-navigation" aria-label="Design exploration">
    {DESIGN_CATEGORIES.map(({ id, label, enabled }) => <Button key={id} size="LG" variant="primary"
      className={enabled ? "is-active" : "is-future"} aria-current={enabled ? "page" : undefined}
      disabled={!enabled} title={enabled ? "Color exploration" : `${label} — coming soon`}
      leadingIcon={id === "designs" ? <Layers size={20} aria-hidden="true" /> : <Icon name={categoryIcons[id]} size={20} />}>
      {label}
    </Button>)}
  </nav>;
}
