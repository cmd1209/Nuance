import NuanceApp from "./nuance/NuanceApp";
import { lazy, Suspense } from "react";

// Vite removes the import and the entire studio dependency tree in production.
const WernerCurationStudio = import.meta.env.DEV ? lazy(() => import("./nuance/dev/werner/WernerCurationStudio")) : null;
export default function App() {
  if (window.location.pathname.replace(/\/$/, "") === "/dev/werner-curation") {
    return WernerCurationStudio ? <Suspense fallback={<p role="status">Loading curation studio…</p>}><WernerCurationStudio /></Suspense>
      : <main><h1>Page not found</h1><a href="/">Return to Nuance</a></main>;
  }
  return <NuanceApp />;
}
