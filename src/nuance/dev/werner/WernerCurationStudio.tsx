import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { PaletteCard } from "../../components/PaletteCard";
import { SectionLayout } from "../../components/SectionLayout";
import { Icon } from "../../components/Icon";
import { WERNER_METHODS, type ReviewStatus, type WernerBatch, type WernerCandidate } from "../../domain/werner-generation";
import { wernerColor } from "../../domain/werner";
import { appendAlternatives, exportCuration, importCuration, initialCuration, mergeProgress, reviewCandidate, WERNER_STORAGE_KEY, type CurationState } from "./curation";
import { candidatePreview } from "./preview";
import initialBatch from "./initial-batch.json";
import "../../nuance.css";
import "./werner-curation.css";

function load() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WERNER_STORAGE_KEY);
    return { state:raw !== null ? importCuration(raw) : initialCuration(initialBatch as {batch:WernerBatch; candidates:WernerCandidate[]}), raw, error:"" };
  } catch (error) { return { state:null, raw, error:`Could not load curation progress: ${message(error)} No stored data has been overwritten. Download the stored backup before importing a complete progress export.` }; }
}
const message = (error: unknown) => error instanceof Error ? error.message : "Unknown storage error.";
function download(text: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], {type})), link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function CandidateCard({ candidate, onReview }: { candidate: WernerCandidate; onReview: (id: string, status: ReviewStatus) => void }) {
  const composition = useMemo(() => candidatePreview(candidate), [candidate.id]);
  return <article className={`werner-candidate werner-candidate--${candidate.status}`} aria-labelledby={`${candidate.id}-title`} data-candidate-id={candidate.id}>
    <PaletteCard composition={composition} onSelect={() => onReview(candidate.id, candidate.status === "approved" ? "pending" : "approved")}
      actionLabel={`${candidate.status === "approved" ? "Mark pending" : "Approve"} ${candidate.id}`} />
    <div className="werner-candidate__heading">
      <h2 id={`${candidate.id}-title`} title={candidate.id}>{candidate.id}</h2>
      <span className="werner-candidate__status">{candidate.status}</span>
    </div>
    <p className="werner-candidate__meta">{candidate.method} · {candidate.colorIds.length} colors</p>
    <ul className="werner-candidate__colors">
      {candidate.colorIds.map(id => { const color = wernerColor(id); return <li key={id}>
        <span>{color.name}</span><span>{color.hex}</span>
      </li>; })}
    </ul>
    <div className="werner-candidate__actions" role="group" aria-label={`Review ${candidate.id}`}>
      {(["approved", "rejected", "pending"] as const).map(status => <Button key={status} size="XS" variant={candidate.status === status ? "primary" : "ghost"}
        aria-pressed={candidate.status === status} onClick={() => onReview(candidate.id, status)}>
        {status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Pending"}
      </Button>)}
    </div>
  </article>;
}
export default function WernerCurationStudio() {
  const [loaded] = useState(load), [state, setState] = useState(loaded.state);
  const stateRef = useRef(state), stored = useRef(loaded.raw);
  const [error, setError] = useState(loaded.error), [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [count, setCount] = useState("all"), [method, setMethod] = useState("all"), [status, setStatus] = useState("all");
  const [seed, setSeed] = useState("werner-nuance-alternatives-01"), [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  function persist(next: CurationState) {
    // Compare before writing: another tab's decisions must never be silently lost.
    if (localStorage.getItem(WERNER_STORAGE_KEY) !== stored.current) throw new Error("Progress changed in another tab. Reload this page before continuing; this action was not applied.");
    const text = exportCuration(next);
    localStorage.setItem(WERNER_STORAGE_KEY, text);
    stored.current = text; stateRef.current = next; setState(next); setError("");
  }
  useEffect(() => {
    if (stateRef.current && stored.current === null) {
      try { persist(stateRef.current); }
      catch (error) { setError(`Progress could not be stored: ${message(error)} Export progress to keep a backup. Review actions are applied only after storage succeeds.`); }
    }
    return () => worker.current?.terminate();
  }, []);
  function review(id: string, status: ReviewStatus) {
    if (!stateRef.current) return;
    try { persist(reviewCandidate(stateRef.current, id, status)); setNotice(`Candidate marked ${status}.`); }
    catch (error) { setError(`Review not saved: ${message(error)}`); }
  }
  function alternatives() {
    if (!stateRef.current || busy) return;
    setError(""); setNotice("Generating 40 alternatives. Existing decisions will be preserved."); setBusy(true);
    const currentWorker = new Worker(new URL("./generation.worker.ts", import.meta.url), {type:"module"});
    worker.current = currentWorker;
    const finish = () => { currentWorker.terminate(); worker.current = null; setBusy(false); };
    currentWorker.onmessage = (event: MessageEvent<{error?:string; result?:{batch:WernerBatch; candidates:WernerCandidate[]}}>) => {
      try {
        if (event.data.error || !event.data.result) throw new Error(event.data.error || "No candidates generated.");
        persist(appendAlternatives(stateRef.current!, event.data.result));
        setNotice("Added 40 pending alternatives. Existing candidates and decisions are unchanged.");
      } catch (error) { setError(`No alternatives added: ${message(error)}`); }
      finally { finish(); }
    };
    currentWorker.onerror = () => { setError("Alternative generation failed. Existing progress is unchanged."); finish(); };
    currentWorker.postMessage({seed, existing:stateRef.current.candidates});
  }
  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    try {
      const imported = importCuration(await file.text());
      persist(stateRef.current ? mergeProgress(stateRef.current, imported) : imported);
      setNotice("Progress imported. Existing approved/rejected decisions were preserved; imported decisions filled pending entries.");
    } catch (error) { setError(`Import not applied: ${message(error)}`); }
  }
  const approved = state?.candidates.filter(candidate => candidate.status === "approved").length ?? 0;
  const candidates = state?.candidates.filter(candidate => (count === "all" || candidate.colorIds.length === Number(count)) && (method === "all" || candidate.method === method) && (status === "all" || candidate.status === status)) ?? [];
  return <AppShell theme={theme}
    header={<header className="nuance-header">
      <a className="nuance-wordmark" href="/" aria-label="Return to Nuance"><img src={`/nuance/assets/nuance-logo__${theme === "dark" ? "light" : "dark"}.svg`} alt="" width={350} height={81} /></a>
      <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} leadingIcon={<Icon name="moon" />} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "Dark" : "Light"}</Button>
    </header>}
    navigation={<nav className="nuance-navigation werner-studio__exports" aria-label="Curation exports">
      <Button variant="navigation" disabled={!state} onClick={() => state && download(exportCuration(state), "werner-nuance-progress.json")}>Export progress</Button>
      <Button variant="navigation" disabled={!state || !approved} onClick={() => state && download(exportCuration(state, true), "werner-nuance-approved.json")}>Export approved</Button>
    </nav>}>
    <SectionLayout title="Werner · Nuance" headingId="werner-heading" description="Curation Studio · Contemporary compositions from Werner’s 1821 color catalog. Select a preview to approve it, or use the review controls below. This workspace is available only in development.">
      <div className="werner-studio">
        {error && <div className="werner-studio__error" role="alert"><p>{error}</p>
          {stored.current !== null && <Button onClick={() => download(stored.current!, "werner-stored-backup.txt", "text/plain")}>Download stored backup</Button>}
        </div>}
        <p role="status">{notice}</p>
        <div className="werner-studio__summary"><p>{approved} approved / {state?.candidates.length ?? 0} candidates</p>
          <label className="werner-studio__import">Import progress (merge)<input type="file" accept="application/json,.json" disabled={busy} onChange={restore} /></label>
        </div>
        {state && <>
          <div className="werner-studio__filters" role="group" aria-label="Candidate filters">
            <label>Colors<select aria-label="Colors" value={count} onChange={event => setCount(event.target.value)}><option value="all">All candidates</option>{[2,3,4].map(n => <option key={n} value={n}>{n} colors</option>)}</select></label>
            <label>Method<select aria-label="Method" value={method} onChange={event => setMethod(event.target.value)}><option value="all">All methods</option>{WERNER_METHODS.map(method => <option key={method}>{method}</option>)}</select></label>
            <label>Review<select aria-label="Review" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{["pending","approved","rejected"].map(status => <option key={status}>{status}</option>)}</select></label>
            <p>{candidates.length} shown</p>
          </div>
          <div className="werner-studio__gallery">
            {candidates.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} onReview={review} />)}
          </div>
          {!candidates.length && <p>No candidates match these filters.</p>}
          <form className="werner-studio__alternatives" onSubmit={event => { event.preventDefault(); alternatives(); }}>
            <label>Alternative batch seed<input value={seed} maxLength={100} required disabled={busy} onChange={event => setSeed(event.target.value)} /></label>
            <Button type="submit" disabled={busy || !seed.trim() || state.batches.some(batch => batch.seed === seed)} aria-busy={busy}>{busy ? "Generating…" : "Generate 40 alternatives"}</Button>
            <p>10 pairs, 20 trios, 10 quartets. Choose a new seed for another batch. Existing candidates and reviews stay intact.</p>
          </form>
        </>}
      </div>
    </SectionLayout>
  </AppShell>;
}
