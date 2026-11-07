import { useState } from "react";
import type { FoundationSectionId } from "../domain/categories";
import { FOUNDATION_SECTIONS, type SectionView } from "../domain/sections";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { SectionLayout } from "./SectionLayout";
import { SectionNavigation } from "./SectionNavigation";

/** Each mounted instance owns its local navigation independently of the app destination. */
export function FoundationSection({ section, hidden, onViewChange }: {
  section: FoundationSectionId; hidden: boolean; onViewChange: () => void;
}) {
  const [view, setView] = useState<SectionView>("explore");
  const definition = FOUNDATION_SECTIONS[section];
  function changeView(next: SectionView) {
    setView(next);
    onViewChange();
  }
  return <SectionLayout hidden={hidden} title={definition.title} headingId={`${section}-heading`}
    description={definition.descriptions[view]}
    navigation={<SectionNavigation prefix={section} label={`${definition.title} views`} value={view}
      onChange={next => { if (next !== "edit") changeView(next); }} />}>
    <section id={`${section}-${view}-panel`} role="tabpanel" aria-labelledby={`${section}-${view}-tab`}>
      <EmptyState message={definition.empty[view]} action={view === "saved" ? <Button onClick={() => {
        changeView("explore");
        document.getElementById(`${section}-explore-tab`)?.focus({ preventScroll: true });
      }}>Back to Explore</Button> : undefined} />
    </section>
  </SectionLayout>;
}
