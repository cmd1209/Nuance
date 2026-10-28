import { useCallback, useReducer, useState } from "react";
import { MAX_COLORS, MIN_COLORS } from "./domain/composition";
import { generatePalettes, nextColor } from "./domain/palettes";
import { activeComposition, createEditorState, editorReducer } from "./state/editor";
import { downloadCompositionPng } from "./export/png";
import { Artwork } from "./components/Artwork";
import { PaletteCard } from "./components/PaletteCard";
import { ColorEditor } from "./components/ColorEditor";
import { Navigation } from "./components/Navigation";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import "./nuance.css";

export default function NuanceApp() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createEditorState);
  const [adjusting, setAdjusting] = useState(false), [exporting, setExporting] = useState(false), [notice, setNotice] = useState("");
  const composition = activeComposition(state), editing = state.view === "editor" && !!composition;
  const selected = composition?.colors.find(c => c.id === state.selectedColorId);
  const closeEditor = useCallback(() => setAdjusting(false), []);
  async function savePng() {
    if (!composition || exporting) return;
    setExporting(true); setNotice("");
    try { await downloadCompositionPng(composition); setNotice("Composition downloaded as PNG."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not download the composition."); }
    finally { setExporting(false); }
  }
  return <div className={`nuance-app ${editing ? "nuance-app--editor" : "nuance-app--palettes"}`} data-theme={state.preferences.theme}>
    <header className="nuance-header">
      <a className="nuance-wordmark" href="#" aria-label="Nuance — back to palettes" onClick={e => { e.preventDefault(); dispatch({ type: "back" }); closeEditor(); }}><span>N</span>uance</a>
      <div className="nuance-header__actions">
        <Button disabled className="account-placeholder" title="Accounts are not available in this phase" leadingIcon={<Icon name="user" />}>User</Button>
        <Button onClick={() => dispatch({ type: "theme" })} aria-label={`Switch to ${state.preferences.theme === "dark" ? "light" : "dark"} theme`} leadingIcon={<Icon name="moon" />}>{state.preferences.theme === "dark" ? "Dark" : "Light"}</Button>
      </div>
    </header>
    <main className="nuance-main">
      <section className="nuance-intro" aria-labelledby="color-heading">
        <h1 id="color-heading">Color</h1>
        <p>{editing ? "Build your own color hierarchy with up to six colors. Add or remove colors, then drag the borders to adjust their proportions and explore how each color shapes the composition."
          : "Explore how colors interact through simple compositions. Experiment with different combinations to discover unexpected harmonies and contrasts."}</p>
      </section>
      {editing ? <section className="nuance-workspace" aria-label="Color manipulation">
        <div className="nuance-stage"><div className="artwork-anchor">
          <Artwork composition={composition} selectedColorId={state.selectedColorId}
            onSelect={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
            onAdjust={id => { dispatch({ type: "select-color", colorId: id }); setAdjusting(true); }}
            onResize={(splitId, ratio) => dispatch({ type: "resize", splitId, ratio })} />
          {adjusting && selected && <ColorEditor color={selected} onChange={hex => dispatch({ type: "color", colorId: selected.id, hex })} onClose={closeEditor} />}
        </div></div>
        <div className="workspace-toolbar" aria-label="Composition actions"><div className="workspace-toolbar__edit">
          <Button onClick={() => { dispatch({ type: "back" }); closeEditor(); setNotice(""); }} leadingIcon={<Icon name="back" />}>Back to Palettes</Button>
          <Button disabled={composition.colors.length <= MIN_COLORS || !selected} title={!selected ? "Select a color to remove" : "Remove selected color"}
            onClick={() => { dispatch({ type: "remove" }); closeEditor(); }} trailingIcon={<Icon name="minus" />}>Remove</Button>
          <Button disabled={composition.colors.length >= MAX_COLORS} onClick={() => { dispatch({ type: "add", hex: nextColor(composition) }); closeEditor(); }} trailingIcon={<Icon name="plus" />}>Add Color</Button>
        </div><Button onClick={savePng} disabled={exporting} trailingIcon={<Icon name="download" />}>{exporting ? "Exporting…" : "Save"}</Button></div>
      </section> : <section className="nuance-palettes" aria-label="Palette suggestions">
        <div className="palette-grid">{state.suggestions.map((palette, index) => <PaletteCard key={palette.id} composition={palette}
          highlighted={state.activeCompositionId ? state.activeCompositionId === palette.id : index === 0}
          onSelect={() => { dispatch({ type: "select-palette", palette }); closeEditor(); setNotice(""); }} />)}</div>
        <Button onClick={() => { dispatch({ type: "explore", suggestions: generatePalettes(state.suggestions) }); setNotice("Three new palette suggestions."); }} trailingIcon={<Icon name="plus" />}>Explore More</Button>
      </section>}
      <p className="nuance-notice" role="status">{notice}</p>
    </main>
    <Navigation />
  </div>;
}
