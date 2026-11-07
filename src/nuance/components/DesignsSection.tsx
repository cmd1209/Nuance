import type { Account } from "../account/useAccount";
import type { FoundationSectionId } from "../domain/categories";
import { paletteAttribution } from "../domain/composition";
import { FOUNDATION_SECTIONS } from "../domain/sections";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { SectionLayout } from "./SectionLayout";

const ingredients: Array<{ section: FoundationSectionId; message: string }> = [
  { section: "types", message: "Saved typography selections will be available here when Types exploration is ready." },
  { section: "spaces", message: "Saved spacing systems will be available here when Spaces exploration is ready." },
  { section: "details", message: "Saved detail configurations will be available here when Details exploration is ready." },
];

/** Assembly foundation: real saved-color availability, with no fabricated design selections. */
export function DesignsSection({ account, hidden, onSavedColors, onExploreColors, onVisit, onSignIn }: {
  account: Account; hidden: boolean; onSavedColors: () => void; onExploreColors: () => void;
  onVisit: (section: FoundationSectionId) => void; onSignIn: () => void;
}) {
  return <SectionLayout hidden={hidden} title="Designs" headingId="designs-heading"
    description="Bring your favorite colors, typography, spacing, and details together. Combine your selections to create a design system that's uniquely yours.">
    <div className="designs-assembly">
      <h2>Your Design</h2>
      <ol className="designs-ingredients" aria-label="Design ingredients">
        <li className="designs-ingredient">
          <h3>Colors</h3>
          {account.authLoading || account.user && account.dataLoading && !account.saved.length ? <p role="status">Loading saved colors…</p>
            : !account.user ? <EmptyState message="Sign in to access your saved palettes." action={<Button onClick={onSignIn}>Sign in</Button>} />
            : <>
              {account.error && <div><p role="alert">{account.error}</p><Button disabled={account.dataLoading} onClick={() => { void account.refresh(); }}>Try again</Button></div>}
              {account.saved.length > 0 ? <>
                <p>{account.saved.length} {account.saved.length === 1 ? "saved palette available" : "saved palettes available"}</p>
                <ul className="designs-saved-colors" aria-label="Available saved palettes">
                  {account.saved.map(item => <li key={item.id}>{paletteAttribution(item.composition)}</li>)}
                </ul>
                <Button onClick={onSavedColors}>View saved colors</Button>
              </> : !account.error && <EmptyState message="No saved palettes yet. Save a color composition to use it here."
                action={<Button onClick={onExploreColors}>Explore colors</Button>} />}
            </>}
        </li>
        {ingredients.map(({ section, message }) => <li key={section} className="designs-ingredient">
          <h3>{FOUNDATION_SECTIONS[section].title}</h3>
          <EmptyState message={message} action={<Button onClick={() => onVisit(section)}>Go to {FOUNDATION_SECTIONS[section].title}</Button>} />
        </li>)}
      </ol>
    </div>
  </SectionLayout>;
}
