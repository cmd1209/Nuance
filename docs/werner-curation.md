# Werner · Nuance — development curation

**Current integration:** [Unified Color exploration](unified-color-exploration.md) explicitly imported the curator’s 30 approvals. The studio and generator remain development-only; the approved source data and catalog provenance are intentionally included in production. The Phase 1 isolation notes below describe the original scope, not a restriction on the now-authorized production collection.

## Open the studio

Run `npm run dev`, then open `/dev/werner-curation` on the printed localhost origin. This route is intentionally independent of production Colors. It reuses `AppShell`, `SectionLayout`, `Button`, `PaletteCard`, Nuance's themes and the document scroll. The fixed bottom bar contains the two exports. The logo returns to Nuance.

The route is gated by Vite's `import.meta.env.DEV` and a conditional lazy import in `src/App.tsx`. Production builds remove the studio, generator, worker and curation CSS; visiting the path renders “Page not found”. A static SPA host may still return HTTP 200 for that fallback; it never mounts the tool. No account hook, database write, authentication or privileged service is used by the studio.

## Historical source and license

Catalog: Patrick Syme's expanded **1821 second edition** of *Werner's Nomenclature of Colours*, following Abraham Gottlob Werner. The historical book is public domain. Nicholas Rougeux's [C82 recreation](https://www.c82.net/werner/) links its [structured spreadsheet](https://docs.google.com/spreadsheets/d/10w7UebIDqN6ChEpBwLDQmAgVZZhLtKvnrLeNnBjJmsc/edit), which provides 110 entries with original numbers, names, families, HEX approximations and animal/vegetable/mineral references.

The HEX table is independently distributed by Robert Rothenberg as [Graphics::ColorNames::Werner](https://github.com/robrwo/Graphics-ColorNames-Werner/tree/854ecaa1997d3cc71b75b3324890ed6815241a77), explicitly dedicated under **CC0-1.0** (see its README and `dist.ini`). It credits the C82 online catalog. All 110 HEX values match the spreadsheet exactly after case normalization. This is not a license claim for C82's website design or photographs; none are imported.

`src/nuance/data/werner/v1/` contains:

- `colors.json`: normalized color definitions; source IDs `werner-001` through `werner-110`.
- `provenance.json`: source URLs, authors, license, edition, pinned revision and SHA-256 fingerprints.
- `upstream/`: the downloaded CSV and independent Perl table, plus its license notices.

`npm run werner:import` is an **offline** importer. It validates 110 consecutive numbers, unique IDs, ten known families and six-digit HEXes, cross-checks every historical name/HEX against the independent table, then writes normalized JSON and fingerprints. It preserves historical spelling and capitalization, including unusual names. `domain/werner.ts` deep-freezes the source catalog and provenance.

These are sRGB approximations of aged scanned swatches, not calibrated pigment measurements. Do not silently replace them with modern interpretations. Modern photographs and photographic examples are excluded.

## Generation

`domain/werner-generation.ts` uses the existing OKLab conversion and perceptual distance functions. No dependencies were added. Every candidate contains only source color IDs: no interpolated or invented HEX values.

The checked-in `dev/werner/initial-batch.json` contains 200 pending candidates from seed `werner-nuance-1821-01`: 50 pairs, 100 trios, 50 quartets. Each of the four strategies contributes 50 palettes:

- **Analogous:** related chromatic hues (at most 75° apart) with lightness variation.
- **Complementary:** chromatic hue separation of at least 130°, optionally with neutrals.
- **Tonal:** a narrow hue range or neutrals, moderate chroma, and a lightness span of at least 0.15.
- **Expressive:** wider hue and lightness relationships, rewarding chroma and warm/cool counterpoints.

Generation ranks seeded proposals using OKLab/OKLCH relationships. Minimum within-palette OKLab distance is 0.065. Unordered sets cannot repeat; same-size sets with symmetric nearest-color distance below 0.04 are rejected. Usage penalties reduce individual-color and family repetition. The initial batch covers all 110 colors, with no color used more than 13 times. Coverage is a result, not a quota that overrides visual eligibility.

These are curation heuristics, not guarantees of aesthetic quality, text contrast or semantic suitability. The curator makes the final decision. Standard previews use the existing 50/50, 50/25/25 and 50/25/12.5/12.5 layouts; source colors are ordered lightest first with stable historical-number ties. Preview proportions are not historical Werner compositions.

IDs include a deterministic hash of algorithm version, seed and ordered color IDs. Batches record the dataset version, algorithm version, seed and configurable 2/3/4 counts. Changing the algorithm requires a new generation version; do not silently rewrite a reviewed batch.

`npm run werner:generate -- --seed YOUR-SEED --out /tmp/werner-batch.json` generates an independent 200-candidate artifact. The command refuses to overwrite any existing file. Configure counts through `generateWernerBatch(seed, {2:50,3:100,4:50}, existingCandidates)`. Do not replace `initial-batch.json` after reviews have begun; use appended alternatives instead.

## Review and persistence

Filter by color count, strategy and pending/approved/rejected status. Approve, Reject and Pending are reversible; selecting a preview toggles approved/pending. There is no enforced 30–50 limit.

Reviews and full batch records live only in this origin's local storage under `nuance:dev:werner-curation:v1`. They are separate from Supabase and saved compositions. A checked-in initial batch is used only when there is no existing storage document: reload does not regenerate or reorder it. Storage success is required before a review or new batch is applied in the UI. Quota/permission failures are reported and preserve the previous state. Concurrent-tab writes are detected before saving; reload a stale tab to continue.

Malformed or incompatible storage is not automatically replaced. Download the stored backup, then import a valid full progress file. There is no reset/clear-progress action. Browser storage can still be cleared outside the application, so export backups regularly.

**Generate 40 alternatives** creates 10 pairs, 20 trios and 10 quartets in a development-only worker, using the explicit seed and all existing candidates for duplicate/coverage checks. Existing rows, order and reviews are retained. A used seed is unavailable until changed. Generation failures add nothing. Reproduction of an appended batch requires the same preceding candidate set as well as the recorded seed/configuration/version.

## Export and recovery

The fixed bottom bar downloads:

- **Export progress:** full candidate order, statuses, review-group IDs, batches, versions, source definitions, fingerprint, attribution and an export timestamp. This reconstructs the workspace without regeneration.
- **Export approved:** only approved candidates and their referenced source colors, with generation metadata and provenance. This is the future Phase 2 input, not a publication action.

**Import progress (merge)** accepts complete progress exports from the same dataset/version. It preserves explicit local approved/rejected decisions when they conflict, fills local pending decisions from the file, and appends new valid candidates/batches. Duplicate sets, invalid IDs/references and incompatible source fingerprints fail without changing storage. Approved-only files are intentionally not workspace backups.

All combinations are labeled **Werner · Nuance**, `curation: "nuance-generated"`; they must never be presented as Werner's original compositions. This phase adds no production collection selector, saved-composition schema, semantic mapping or publishing step.

## Validation

`npm test` includes dataset integrity, deterministic regeneration of all 200 candidates, configurable distribution, source coverage, perceptual spacing, duplicate/near-duplicate checks, stable IDs, appended alternatives, review reversals, JSON round-trips, import conflict handling and standard preview geometry. Existing Color/account/database tests still run.

`npm run build` includes TypeScript checks and a production build. No lint command is configured.

Optional isolated browser checks use the temporary Playwright setup described in `application-shell.md`:

```sh
NUANCE_PLAYWRIGHT_MODULE=/private/tmp/nuance-shell-browser/node_modules/playwright/index.mjs node tests/werner-browser.mjs
```

The browser suite verifies gallery/filtering, reviews/reload, actual JSON downloads/import, worker alternatives, cross-tab and storage-error protection, corrupt-data recovery, themes, responsive layout and exclusion from production artifacts. Run `tests/shell-browser.mjs` for the existing full Color regression suite. Test accounts/API responses are mocked; tests do not write real account data.

For the production-route check, start `npm run preview -- --host 127.0.0.1 --port 5180` after building, then add `NUANCE_PRODUCTION_URL=http://127.0.0.1:5180` to the browser command. The completed implementation passed 62 Node/database tests, all 83 existing shell layout checks, the curation browser workflow, TypeScript and the production build. No production collection integration was performed.
