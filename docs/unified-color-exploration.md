# Unified Color exploration

## Published collections

Explore now mixes the 348 unchanged Sanzo Wada combinations with **30 curator-approved Werner · Nuance palettes**. There is no collection selector, filter, extra tab, or grouped gallery. The existing carousel, preview geometry, arrow/swipe/keyboard interactions, editing workspace and universal eight-save library are shared.

The Werner selection was explicitly imported from the curator's `werner-nuance-approved.json`, exported **2026-11-09T14:09:36.784Z**. The original export is preserved at `src/nuance/data/werner/v1/upstream/approved-export.json`; its SHA-256 fingerprint is in `approved.json`. Production bundles only the 65 historical colors referenced by the approved collection; the full immutable 110-color source remains available to development curation. These are the curator's 30 approvals, not the first 30 generated candidates or test approvals. The import command validates all candidates against the checked-in generation batch and verifies their source colors. It refuses to overwrite an existing published artifact.

Permanent public IDs `werner-nuance-001` through `werner-nuance-030` and collection numbers follow that export's order. Each retains its generator candidate ID, ordered historical color IDs, method, seed, batch/version and source provenance. Shuffle order never determines attribution numbering.

## Balanced discovery

`domain/collections.ts` registers each collection's stable palette IDs and composition factories. `domain/discovery.ts` is a source-agnostic scheduler: it has no Wada/Werner branching and does not modify source collections.

- Each collection has its own independently shuffled queue.
- Round-robin selection distributes exposure across nonempty collections.
- A queue refills only after every palette in that collection's current cycle has been used.
- A palette cannot occur twice in the same requested batch. If a small collection runs out of eligible unique entries, the remaining exposure is redistributed.
- The round-robin turn carries between batches, avoiding a permanent rounding advantage for one source.
- An injected random function makes scheduler tests reproducible. Source palette IDs remain stable regardless of randomness.

The current initial batch contains **60 complete palettes: 30 Wada and 30 Werner**. Successive viewport pages interleave the collections: a 2:1 / 1:2 split on alternating three-card desktop pages, one of each on tablet pages, and alternating source exposure on mobile. Strictly equal counts are impossible on a single odd-sized page; the sequence remains balanced.

As browsing approaches the final loaded page, the existing carousel appends another balanced batch. No extra Explore More control is introduced. Earlier cards keep their order. Werner begins a new shuffled cycle after its 30 unique palettes; Wada continues its own cycle until all 348 have been exposed. Every Wada palette remains reachable without making its larger catalog dominate frequency.

The editor reducer owns both the loaded sequence and immutable discovery cursor. Switching views, editing, saving or changing theme does not shuffle or reset them. Reload starts a new discovery session, matching the existing refresh behavior. Compatibility Wada/procedural discovery utilities remain available but no longer drive the production carousel.

After a collection cycle refills, the same source palette can appear again later in the sequence. Rendering keys and remembered carousel positions include the **occurrence index**, while the underlying palette ID remains unchanged. This restores the exact occurrence selected rather than jumping back to its first appearance. Saved cards still use their document IDs.

## Attribution and provenance

Wada's existing `historical` metadata and legacy schema-version-1 records are unchanged. Werner uses an additive **`curated`** source reference, `source: "werner-nuance"`, and `curation: "nuance-generated"`. It does not borrow Wada's historical-combination metadata or claim Werner/Syme composed these palettes.

Examples:

- `Sanzo Wada · No. 57`
- `Werner · Nuance No. 12`
- `Based on Werner · Nuance No. 12` after edits or a generated extension

Historical names, HEX approximations and source color identifiers are retained on the original colors. The reference snapshot retains the original combination, generation metadata, digitizer, CC0 HEX-table attribution and dataset fingerprint. Persistence validates this against the frozen published library and restores the canonical reference; forged metadata is rejected. JSONB object-key reordering is supported.

See [Werner curation](werner-curation.md) for catalog provenance, licensing, scan limitations and the development tool. Later studio approvals/alternatives **do not automatically publish** or modify the imported collection.

## Editing, resetting and saving

Both sources open through the same selection/draft logic, dirty-state confirmation, color picker, adding/removing colors and proportional layout editor. Source percentages remain derived from the saved layout. Temporary main-section/local-view switches preserve the active editing session.

Authentic pairs remain two colors in Explore. As with existing Wada pairs, opening a pair in the editor adds a labeled Nuance-generated third color; original source colors remain unchanged. Extension suggestions use the stable source palette ID, so Werner pair extension/reset is deterministic across document clones.

`resetSourceComposition` resolves the registered original and restores its colors and standard proportions, retaining the saved composition ID and creation time. Wada's prior reset utility remains compatible. Saving/updating uses the same account repository and ownership/quota rules; no database migration or new persistence service is required. Edited saved palettes update their existing record.

PNG is deprecated and no download action is introduced. The existing hidden utility was not expanded.

## Adding another collection

Add its immutable, curator-approved data and composition/reference adapter, register it in `COLOR_COLLECTIONS`, and extend source validation/attribution as necessary for that data model. The scheduler, carousel and Explore interface need no source-specific controls or branches. New collections automatically receive fair exposure, with graceful redistribution for small/empty catalogs.

Keep published IDs and numbering immutable. Do not renumber published entries according to a new shuffle, studio status or regenerated batch.

## Validation

`npm test` covers 69 Node/database cases, including the imported 30 approvals, exact source data, independent cycle exhaustion, no duplicate palettes per batch, deterministic scheduling, a third collection, small/empty catalogs, all Werner save/reset paths, old Wada/custom records, forged provenance rejection, shared dirty-state behavior and the universal quota.

`tests/shell-browser.mjs` retains the existing application/Color checks and adds 50/50 discovery, appended cycles, exact occurrence restoration, Werner editing/reset, unsaved protection, mixed-source saves, update-in-place and reload. Its account API is mocked; no real user records are modified. The completed browser run passed 85 layout checks with no browser exceptions. `tests/werner-browser.mjs` continues to check that the studio/generator remain development-only, while approved source data is now intentionally part of production.

Run `npm run build` for TypeScript and the production bundle. There is no configured lint command.
