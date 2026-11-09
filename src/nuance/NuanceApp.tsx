import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { HeartPlus, RotateCcw } from "lucide-react";
import { useAccount, accountError } from "./account/useAccount";
import { authReturn } from "./account/client";
import { canSaveComposition, MAX_SAVED_COMPOSITIONS } from "./account/compositionLimit";
import { AccountDialog } from "./components/AccountDialog";
import { SavedCompositions } from "./components/SavedCompositions";
import { SwitchCompositionDialog } from "./components/SwitchCompositionDialog";
import { AppShell } from "./components/AppShell";
import { AppHeader } from "./components/AppHeader";
import { FoundationSection } from "./components/FoundationSection";
import { TypesSection } from "./components/TypesSection";
import { DesignsSection } from "./components/DesignsSection";
import type { DesignCategoryId } from "./domain/categories";
import { applicationReducer, createApplicationState } from "./state/application";
import { SectionLayout } from "./components/SectionLayout";
import { SectionNavigation } from "./components/SectionNavigation";
import { MAX_COLORS, paletteAttribution } from "./domain/composition";
import { nextColor } from "./domain/palettes";
import { activeComposition, createEditorState, editorReducer } from "./state/editor";
import { Artwork } from "./components/Artwork";
import { PaletteSlider } from "./components/PaletteSlider";
import { ColorEditor } from "./components/ColorEditor";
import { Navigation } from "./components/Navigation";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import "./nuance.css";

export default function NuanceApp() {
  const [application, dispatchApplication] = useReducer(applicationReducer, undefined, createApplicationState);
  const [state, dispatch] = useReducer(editorReducer, undefined, createEditorState);
  const account = useAccount();
  const [accountOpen, setAccountOpen] = useState(!!authReturn.kind || authReturn.hasError), [saving, setSaving] = useState(false);
  useEffect(() => { if (account.recovery !== "none") setAccountOpen(true); }, [account.recovery]);
  const [adjusting, setAdjusting] = useState(false), [notice, setNotice] = useState("");
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    const next = account.user?.id ?? null;
    if (previousOwner.current && previousOwner.current !== next) {
      dispatch({ type: "clear-account" }); setAdjusting(false); setNotice("");
    }
    previousOwner.current = next;
  }, [account.user?.id]);
  const main = useRef<HTMLElement>(null);
  const explorePosition = useRef<number | null>(null);
  const rememberExplorePosition = useCallback((_id: string, index: number) => { explorePosition.current = index; }, []);
  const requestMorePalettes = useCallback(() => dispatch({ type: "more-palettes" }), []);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (state.activeCompositionId) editorTrigger.current = selectionTrigger.current;
  }, [state.activeCompositionId, state.editorOrigin]);
  const wasEditing = useRef(false);
  const composition = activeComposition(state), editing = state.view === "editor" && !!composition;
  useEffect(() => {
    if (editing === wasEditing.current) return;
    wasEditing.current = editing;
    if (application.activeSection !== "colors") return;
    if (main.current?.contains(document.activeElement) && document.activeElement?.getAttribute("role") === "tab") return;
    const colorSection = main.current?.querySelector<HTMLElement>('.section-layout[aria-labelledby="color-heading"]');
    if (editing) colorSection?.querySelector<HTMLElement>("#color-heading")?.focus({ preventScroll: true });
    else {
      const previous = editorTrigger.current;
      const cards = colorSection?.querySelectorAll<HTMLButtonElement>("[data-composition-id]");
      const target = previous?.isConnected ? previous : Array.from(cards ?? []).find(card => card.dataset.compositionId === previous?.dataset.compositionId && card.dataset.paletteIndex === previous?.dataset.paletteIndex)
        ?? colorSection?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      target?.focus({ preventScroll: true });
    }
  }, [editing, application.activeSection]);
  const viewKey = editing ? "edit" : state.sectionView;
  const previousView = useRef(viewKey);
  useLayoutEffect(() => {
    if (application.activeSection === "colors" && previousView.current !== viewKey) main.current?.scrollIntoView({ block: "start", behavior: "instant" });
    previousView.current = viewKey;
  }, [viewKey, application.activeSection]);
  const previousSection = useRef(application.activeSection);
  useLayoutEffect(() => {
    if (previousSection.current === application.activeSection) return;
    previousSection.current = application.activeSection;
    window.scrollTo({ top: 0, behavior: "instant" });
    const headingId = application.activeSection === "colors" ? "color-heading" : `${application.activeSection}-heading`;
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [application.activeSection]);
  function navigate(section: DesignCategoryId) {
    setAdjusting(false);
    if (section === application.activeSection) main.current?.scrollIntoView({ block: "start", behavior: "instant" });
    else dispatchApplication({ type: "navigate", section });
  }
  function openColorView(view: "explore" | "saved") {
    dispatch({ type: "section", view });
    navigate("colors");
  }
  function rememberEditorTrigger() {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const selected = composition?.colors.find(c => c.id === state.selectedColorId);
  const libraryFull = !!(account.user && composition && !account.dataLoading && !canSaveComposition(account.saved, composition.id));
  const closeEditor = useCallback(() => setAdjusting(false), []);
  async function saveToAccount() {
    if (!composition || saving) return;
    if (!account.user) { setAccountOpen(true); return; }
    setSaving(true); setNotice("");
    try { await account.save(composition); dispatch({ type: "save-succeeded", composition }); setNotice("Composition saved to your account."); }
    catch (error) { setNotice(accountError(error)); }
    finally { setSaving(false); }
  }
  return <AppShell theme={application.theme} mainRef={main}
    header={<AppHeader theme={application.theme} displayName={account.profile?.display_name ?? ""}
      signedIn={!!account.user} loading={account.authLoading} onAccount={() => setAccountOpen(true)}
      onTheme={() => dispatchApplication({ type: "theme" })}
      onHome={() => { if (application.activeSection === "colors") dispatch({ type: "back" }); navigate("colors"); window.scrollTo({ top: 0, behavior: "instant" }); }} />}
    navigation={<Navigation activeSection={application.activeSection} onSelect={navigate} />}
    overlays={<>
      {state.pendingSelection && <SwitchCompositionDialog onCancel={() => dispatch({ type: "cancel-switch" })}
        onDiscard={() => { dispatch({ type: "discard-and-switch" }); closeEditor(); setNotice(""); }} />}
      {accountOpen && <AccountDialog account={account} onClose={() => { account.dismissRecovery(); setAccountOpen(false); }} />}
    </>}>
    <SectionLayout hidden={application.activeSection !== "colors"} title="Color" headingId="color-heading" notice={notice}
      navigation={<SectionNavigation prefix="color" label="Color views" value={editing ? "edit" : state.sectionView} hasDraft={!!composition}
        onChange={view => { dispatch(view === "edit" ? { type: "resume-editor" } : { type: "section", view }); closeEditor(); setNotice(""); }} />}
      description={editing ? "Build your own color hierarchy with up to six colors. Add or remove colors, then drag the borders to adjust their proportions and explore how each color shapes the composition."
        : state.sectionView === "saved" ? "Your saved color compositions, ready to revisit and refine. Select a palette to continue editing or explore new combinations to add to your collection."
        : "Explore how colors interact through simple compositions. Experiment with different combinations to discover unexpected harmonies and contrasts."}>
      {editing ? <section id="color-edit-panel" role="tabpanel" aria-labelledby="color-edit-tab" className="nuance-workspace">
        <div className="nuance-stage">
          <div className="artwork-anchor">
            <p className="composition-source__name">{paletteAttribution(composition)}</p>
            <Artwork composition={composition} selectedColorId={state.selectedColorId}
              onSelect={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
              onAdjust={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
              onRemove={colorId => { dispatch({ type: "remove", colorId }); closeEditor(); }}
              onResize={(splitId, ratio) => dispatch({ type: "resize", splitId, ratio })} />
            {adjusting && selected && <ColorEditor color={selected} onChange={hex => dispatch({ type: "color", colorId: selected.id, hex })} onClose={closeEditor} />}
          </div>
          <div className="composition-actions" role="group" aria-label="Composition actions">
            {(composition.historical || composition.curated) && <Button className="composition-action" aria-label="Reset composition"
              title="Reset composition to its original colors and proportions"
              onClick={() => { dispatch({ type: "reset" }); closeEditor(); setNotice((composition.historical ?? composition.curated)?.originalColorCount === 2 ? "Original pair restored with a Nuance-generated third color for the editor." : composition.curated ? "Original Werner · Nuance combination restored." : "Original Wada combination restored."); }}
              leadingIcon={<RotateCcw size={20} aria-hidden="true" />} />}
            <Button className="composition-action composition-add" disabled={composition.colors.length >= MAX_COLORS}
              aria-label={composition.colors.length >= MAX_COLORS ? "Add color — maximum of six colors reached" : "Add color"}
              title={composition.colors.length >= MAX_COLORS ? "Maximum of six colors reached" : "Add a harmonizing color"}
              onClick={() => { dispatch({ type: "add", hex: nextColor(composition) }); closeEditor(); }}><Icon name="plus" size={20} /></Button>
            <Button className="composition-action" onClick={saveToAccount}
              disabled={saving || account.authLoading || !!account.user && account.dataLoading || libraryFull}
              aria-label={saving ? "Saving composition…" : libraryFull ? `Save composition — limit reached (${MAX_SAVED_COMPOSITIONS}/${MAX_SAVED_COMPOSITIONS})` : "Save composition"}
              aria-busy={saving}
              title={libraryFull ? "Delete a composition in Saved to make room. Existing saves can still be updated." : saving ? "Saving composition…" : "Save composition"}
              leadingIcon={<HeartPlus size={20} aria-hidden="true" />} />
          </div>
        </div>
      </section> : <>
      <section id="color-explore-panel" role="tabpanel" aria-labelledby="color-explore-tab" hidden={state.sectionView !== "explore"} className="nuance-palettes">
        {state.sectionView === "explore" &&
        <PaletteSlider palettes={state.suggestions} activeId={state.activeCompositionId} activeIndex={explorePosition.current ?? undefined} onPositionChange={rememberExplorePosition} onRequestMore={requestMorePalettes}
          onSelect={(palette, index) => { explorePosition.current = index; rememberEditorTrigger(); dispatch({ type: "select-palette", palette }); closeEditor(); setNotice(""); }} />}
      </section>
      <section id="color-saved-panel" role="tabpanel" aria-labelledby="color-saved-tab" hidden={state.sectionView !== "saved"}>
        {state.sectionView === "saved" && <SavedCompositions key={account.user?.id ?? "guest"} account={account}
          onOpen={composition => { rememberEditorTrigger(); dispatch({ type: "open-saved", composition }); closeEditor(); setNotice(""); }}
          onExplore={() => { dispatch({ type: "section", view: "explore" }); document.getElementById("color-explore-tab")?.focus(); }}
          onSignIn={() => setAccountOpen(true)} />}
      </section>
      </>}
    </SectionLayout>
    <TypesSection hidden={application.activeSection !== "types"} account={account} onSignIn={() => setAccountOpen(true)} onViewChange={() => main.current?.scrollIntoView({ block: "start", behavior: "instant" })} />
    {(["spaces", "details"] as const).map(section => <FoundationSection key={section} section={section}
      hidden={application.activeSection !== section} onViewChange={() => main.current?.scrollIntoView({ block: "start", behavior: "instant" })} />)}
    <DesignsSection hidden={application.activeSection !== "designs"} account={account} onVisit={navigate}
      onSavedColors={() => openColorView("saved")} onExploreColors={() => openColorView("explore")} onSignIn={() => setAccountOpen(true)} />
  </AppShell>;
}
