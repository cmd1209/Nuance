import type { KeyboardEvent } from "react";
import type { CreativeView } from "../domain/sections";

type NavigationView = CreativeView;
const labels: Record<NavigationView, string> = { explore: "Explore", saved: "Saved", edit: "Edit" };

export function SectionNavigation({ value, onChange, prefix, label, hasDraft = false }: {
  value: NavigationView; onChange: (view: NavigationView) => void; prefix: string; label: string; hasDraft?: boolean;
}) {
  const views: NavigationView[] = hasDraft ? ["explore", "saved", "edit"] : ["explore", "saved"];
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = views.indexOf(value);
    const next = views[event.key === "Home" ? 0 : event.key === "End" ? views.length - 1
      : (index + (event.key === "ArrowLeft" ? -1 : 1) + views.length) % views.length];
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus();
  }
  return <div className="section-navigation" role="tablist" aria-label={label} onKeyDown={navigate}>
    {views.map(view => <button key={view} type="button" role="tab" id={`${prefix}-${view}-tab`} data-view={view}
      aria-selected={value === view} aria-controls={value === view ? `${prefix}-${view}-panel` : undefined} tabIndex={value === view ? 0 : -1}
      onClick={() => onChange(view)}>{labels[view]}</button>)}
  </div>;
}
