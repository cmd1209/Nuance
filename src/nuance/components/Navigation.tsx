import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export function Navigation() {
  return <nav className="nuance-navigation" aria-label="Design exploration">
    {(["Color", "Type", "Space", "Detail"] as const).map(label => <Button key={label} size="LG" variant="primary"
      className={label === "Color" ? "is-active" : "is-future"} aria-current={label === "Color" ? "page" : undefined}
      aria-disabled={label !== "Color"} title={label === "Color" ? "Color exploration" : `${label} exploration is coming in a later phase`}
      leadingIcon={<Icon name={label.toLowerCase() as IconName} size={20} />}>
      {label}
    </Button>)}
  </nav>;
}
