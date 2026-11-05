import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { accountError, type Account } from "../account/useAccount";
import { MAX_SAVED_COMPOSITIONS } from "../account/compositionLimit";
import { paletteAttribution, type Composition } from "../domain/composition";
import { Button } from "./Button";
import { PaletteCard } from "./PaletteCard";
import { SavedGallery } from "./SavedGallery";

export function SavedCompositions({ account, onOpen, onExplore, onSignIn }: {
  account: Account; onOpen: (composition: Composition) => void; onExplore: () => void; onSignIn: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const removing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function remove(composition: Composition) {
    if (removing.current || !window.confirm(`Delete ${paletteAttribution(composition)}? This cannot be undone.`)) return;
    const index = account.saved.findIndex(item => item.id === composition.id);
    removing.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await account.remove(composition.id);
      setMessage("Composition deleted.");
      window.requestAnimationFrame(() => {
        const buttons = root.current?.querySelectorAll<HTMLButtonElement>("[data-delete-composition]");
        const target = buttons?.[Math.min(index, buttons.length - 1)] ?? root.current;
        target?.focus();
      });
    } catch (error) { setError(accountError(error)); }
    finally { removing.current = false; setBusy(false); }
  }

  return <div ref={root} className="saved-compositions" tabIndex={-1} aria-label="Saved color compositions" aria-busy={account.dataLoading || busy}>
    {account.authLoading ? <p role="status">Loading your account…</p>
      : !account.user ? <div className="saved-gallery__empty">
        <p>Sign in to see your saved color compositions.</p>
        <Button onClick={onSignIn}>Sign in</Button>
      </div>
      : <>
        {account.dataLoading && <p role="status">Loading compositions…</p>}
        {account.error && <div><p role="alert">{account.error}</p><Button disabled={account.dataLoading || busy} onClick={() => { void account.refresh(); }}>Try again</Button></div>}
        {(!account.dataLoading && !account.error || account.saved.length > 0) && <SavedGallery items={account.saved} maximum={MAX_SAVED_COMPOSITIONS}
          empty={<div className="saved-gallery__empty"><p>No saved colors yet. Explore a palette and save a composition to see it here.</p><Button onClick={onExplore}>Explore palettes</Button></div>}
          renderItem={item => <>
            <header className="palette-card__header">
              <span className="palette-card__label composition-source__name">{paletteAttribution(item.composition)}</span>
              <Button size="XS" className="saved-compositions__delete" data-delete-composition={item.id} aria-label={`Delete ${paletteAttribution(item.composition)}`}
                title="Delete composition" disabled={busy || account.dataLoading} onClick={() => { void remove(item.composition); }} leadingIcon={<Trash2 size={16} aria-hidden="true" />} />
            </header>
            <PaletteCard composition={item.composition} artwork={item.composition.artwork} disabled={busy} onSelect={() => onOpen(item.composition)} />
          </>} />}
      </>}
    {error && <p role="alert">{error}</p>}
    <p role="status">{message}</p>
  </div>;
}
