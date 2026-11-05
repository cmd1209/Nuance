import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useAccount, accountError } from "./account/useAccount";
import { authReturn } from "./account/client";
import { canSaveComposition, MAX_SAVED_COMPOSITIONS } from "./account/compositionLimit";
import { AccountDialog } from "./components/AccountDialog";
import { SavedCompositions } from "./components/SavedCompositions";
import { SectionNavigation } from "./components/SectionNavigation";
import { MAX_COLORS, paletteAttribution } from "./domain/composition";
import { nextColor } from "./domain/palettes";
import { activeComposition, createEditorState, editorReducer } from "./state/editor";
import { downloadCompositionPng } from "./export/png";
import { Artwork } from "./components/Artwork";
import { PaletteSlider } from "./components/PaletteSlider";
import { ColorEditor } from "./components/ColorEditor";
import { Navigation } from "./components/Navigation";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import "./nuance.css";

export default function NuanceApp() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createEditorState);
  const account = useAccount();
  const [accountOpen, setAccountOpen] = useState(!!authReturn.kind || authReturn.hasError), [saving, setSaving] = useState(false);
  useEffect(() => { if (account.recovery !== "none") setAccountOpen(true); }, [account.recovery]);
  const [adjusting, setAdjusting] = useState(false), [exporting, setExporting] = useState(false), [notice, setNotice] = useState("");
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    const next = account.user?.id ?? null;
    if (previousOwner.current && previousOwner.current !== next) {
      dispatch({ type: "clear-account" }); setAdjusting(false); setNotice("");
    }
    previousOwner.current = next;
  }, [account.user?.id]);
  const main = useRef<HTMLElement>(null);
  const explorePosition = useRef<string | null>(null);
  const rememberExplorePosition = useCallback((id: string) => { explorePosition.current = id; }, []);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const wasEditing = useRef(false);
  const composition = activeComposition(state), editing = state.view === "editor" && !!composition;
  useEffect(() => {
    if (editing === wasEditing.current) return;
    wasEditing.current = editing;
    if (main.current?.contains(document.activeElement) && document.activeElement?.getAttribute("role") === "tab") return;
    if (editing) main.current?.querySelector<HTMLElement>("#color-heading")?.focus();
    else {
      const previous = editorTrigger.current;
      const cards = main.current?.querySelectorAll<HTMLButtonElement>("[data-composition-id]");
      const target = previous?.isConnected ? previous : Array.from(cards ?? []).find(card => card.dataset.compositionId === previous?.dataset.compositionId)
        ?? main.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      target?.focus();
    }
  }, [editing]);
  function rememberEditorTrigger() {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const selected = composition?.colors.find(c => c.id === state.selectedColorId);
  const libraryFull = !!(account.user && composition && !account.dataLoading && !canSaveComposition(account.saved, composition.id));
  const closeEditor = useCallback(() => setAdjusting(false), []);
  async function saveToAccount() {
    if (!composition || saving) return;
    if (!account.user) { setAccountOpen(true); return; }
    setSaving(true); setNotice("");
    try { await account.save(composition); setNotice("Composition saved to your account."); }
    catch (error) { setNotice(accountError(error)); }
    finally { setSaving(false); }
  }
  async function savePng() {
    if (!composition || exporting) return;
    setExporting(true); setNotice("");
    try { await downloadCompositionPng(composition); setNotice("Composition downloaded as PNG."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not download the composition."); }
    finally { setExporting(false); }
  }
  return <div className={`nuance-app ${editing ? "nuance-app--editor" : "nuance-app--palettes"}`} data-theme={state.preferences.theme}>
    <header className="nuance-header">
      <a className="nuance-wordmark" href="#" aria-label="Nuance — back to palettes" onClick={e => { e.preventDefault(); dispatch({ type: "back" }); closeEditor(); }}>
        <img src={`/nuance/assets/nuance-logo__${state.preferences.theme === "dark" ? "light" : "dark"}.svg`} alt="" width={350} height={81} />
      </a>
      <div className="nuance-header__actions">
        <Button className="account-button" disabled={account.authLoading} aria-label={account.user ? "Open your profile" : "Sign in"}
          onClick={() => setAccountOpen(true)} leadingIcon={<Icon name="user" />}><span className="account-button__name">{account.authLoading ? "Loading…" : account.user ? account.profile?.display_name || "Account" : "Sign in"}</span></Button>
        <Button onClick={() => dispatch({ type: "theme" })} aria-label={`Switch to ${state.preferences.theme === "dark" ? "light" : "dark"} theme`} leadingIcon={<Icon name="moon" />}>{state.preferences.theme === "dark" ? "Dark" : "Light"}</Button>
      </div>
    </header>
    <main ref={main} className="nuance-main">
      <section className="nuance-intro" aria-labelledby="color-heading">
        <div className="nuance-intro__heading">
          <h1 id="color-heading" tabIndex={-1}>Color</h1>
          <SectionNavigation prefix="color" label="Color views" value={editing ? "edit" : state.sectionView} hasDraft={!!composition}
            onChange={view => { dispatch(view === "edit" ? { type: "resume-editor" } : { type: "section", view }); closeEditor(); setNotice(""); }} />
        </div>
        <p>{editing ? "Build your own color hierarchy with up to six colors. Add or remove colors, then drag the borders to adjust their proportions and explore how each color shapes the composition."
          : state.sectionView === "saved" ? "Your saved color compositions, ready to revisit and refine. Select a palette to continue editing or explore new combinations to add to your collection."
          : "Explore how colors interact through simple compositions. Experiment with different combinations to discover unexpected harmonies and contrasts."}</p>
      </section>
      {editing ? <section id="color-edit-panel" role="tabpanel" aria-labelledby="color-edit-tab" className="nuance-workspace">
        <div className="nuance-stage">
          <div className="artwork-anchor">
          <p className="composition-source__name">{paletteAttribution(composition)}</p>
          <Artwork composition={composition} selectedColorId={state.selectedColorId}
            onSelect={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
            onAdjust={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
            onRemove={colorId => { dispatch({ type: "remove", colorId }); closeEditor(); }}
            onResize={(splitId, ratio) => dispatch({ type: "resize", splitId, ratio })} />
          <Button className="composition-add" disabled={composition.colors.length >= MAX_COLORS}
            aria-label={composition.colors.length >= MAX_COLORS ? "Add color — maximum of six colors reached" : "Add color"}
            title={composition.colors.length >= MAX_COLORS ? "Maximum of six colors reached" : "Add a harmonizing color"}
            onClick={() => { dispatch({ type: "add", hex: nextColor(composition) }); closeEditor(); }}><Icon name="plus" size={20} /></Button>
          {adjusting && selected && <ColorEditor color={selected} onChange={hex => dispatch({ type: "color", colorId: selected.id, hex })} onClose={closeEditor} />}
        </div></div>
        <div className="workspace-toolbar" aria-label="Composition actions">
          <div className="composition-source">
            <Button onClick={() => { dispatch({ type: "back" }); closeEditor(); setNotice(""); }} leadingIcon={<Icon name="back" />}>Back</Button>
          </div>
          <div className="workspace-toolbar__actions">
            {composition.historical && <Button title="Restore historical colors and proportions; two-color originals receive a labeled third color" onClick={() => { dispatch({ type: "reset" }); closeEditor(); setNotice(composition.historical?.originalColorCount === 2 ? "Original pair restored with a Nuance-generated third color for the editor." : "Original Wada combination restored."); }}>Reset</Button>}
            <Button onClick={saveToAccount} disabled={saving || account.authLoading || !!account.user && account.dataLoading || libraryFull}
              title={libraryFull ? "Delete a composition in Saved to make room. Existing saves can still be updated." : undefined}>
              {saving ? "Saving…" : libraryFull ? `Limit reached (${MAX_SAVED_COMPOSITIONS}/${MAX_SAVED_COMPOSITIONS})` : "Save"}
            </Button>
            <Button onClick={savePng} disabled={exporting} trailingIcon={<Icon name="download" />}>{exporting ? "Downloading…" : "PNG"}</Button>
          </div>
        </div>
      </section> : <>
      <section id="color-explore-panel" role="tabpanel" aria-labelledby="color-explore-tab" hidden={state.sectionView !== "explore"} className="nuance-palettes">
        {state.sectionView === "explore" &&
        <PaletteSlider palettes={state.suggestions} activeId={explorePosition.current ?? state.activeCompositionId} onPositionChange={rememberExplorePosition}
          onSelect={palette => { rememberEditorTrigger(); dispatch({ type: "select-palette", palette }); closeEditor(); setNotice(""); }} />}
      </section>
      <section id="color-saved-panel" role="tabpanel" aria-labelledby="color-saved-tab" hidden={state.sectionView !== "saved"}>
        {state.sectionView === "saved" && <SavedCompositions key={account.user?.id ?? "guest"} account={account}
          onOpen={composition => { rememberEditorTrigger(); dispatch({ type: "open-saved", composition }); closeEditor(); setNotice(""); }}
          onExplore={() => { dispatch({ type: "section", view: "explore" }); document.getElementById("color-explore-tab")?.focus(); }}
          onSignIn={() => setAccountOpen(true)} />}
      </section>
      </>}
      <p className="nuance-notice" role="status">{notice}</p>
    </main>
    <Navigation />
    {accountOpen && <AccountDialog account={account} onClose={() => { account.dismissRecovery(); setAccountOpen(false); }} />}
  </div>;
}
