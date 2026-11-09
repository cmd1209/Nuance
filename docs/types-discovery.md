# Types — Google Fonts discovery and account favorites

Types Explore is a functional eight-typeface gallery. It keeps Nuance's `AppShell`, `SectionLayout`, segmented navigation, fixed bottom navigation, one document scroll, theme canvas and interface font. Spaces and Details keep their existing foundation components. Color editing, discovery and persistence are unchanged.

## Collection and registry

The curated collection mixes four serifs—DM Serif Display, Fraunces, Libre Baskerville and Cormorant Garamond—with Inter, Manrope, IBM Plex Sans and Space Grotesk. The gallery interleaves classifications rather than presenting category sections. There are no filters, search fields, pairing controls or type-scale/weight editors.

`domain/typefaces.ts` exports a deeply frozen registry, lookup functions and explicit fallback stacks. `data/typefaces/v1/registry.json` records:

- Namespaced stable ID (`google-fonts:inter`), family, source/provider label and classification.
- Available family weights/styles/subsets and variable-font support.
- Versioned, same-origin specimen URL, isolated CSS family alias, WOFF2 format, normal style, weight range, Latin subset, 400 specimen weight and swap display behavior.
- Pinned Fontsource package/font versions, exact upstream asset/metadata/license URLs, SHA-256 fingerprint and byte count.
- OFL license identifier, attribution, license URL and a self-hosted notice.

The individual pinned Fontsource metadata snapshots are checked in beside the registry. Family availability metadata describes the full upstream family; **only the selected normal Latin face is shipped**. Extra italic styles and non-Latin subsets are not downloaded by this phase.

## Source, licenses and files

The files come from Fontsource's Google Fonts packages, pinned to **5.3.0**. Fontsource documents [self-hosting](https://fontsource.org/docs/getting-started/introduction) and [variable faces](https://fontsource.org/docs/getting-started/variable). Each font is licensed under **SIL Open Font License 1.1**; its original copyright/license notice is preserved in `public/nuance/fonts/specimens/<id>-LICENSE.txt`. No binaries are modified or renamed internally; the CSS aliases isolate specimens from application typography.

DM Serif Display uses one static regular file. The other seven use one weight-variable normal file each. The eight Latin WOFF2 files total **273,968 bytes** (approximately 274 KB decimal / 268 KiB). They require no runtime Fontsource/Google API, external stylesheet, CDN request, new package dependency or build-time download.

`npm run fonts:verify` checks the local font binaries against the registry fingerprints. `node scripts/vendor-typefaces.mjs --restore` explicitly downloads the same pinned files/notices and verifies font hashes before restoring them. It does not update versions or query “latest”. Do not overwrite a pinned asset with a different font under the same URL.

## Loading and rendering

`typography/fontLoading.ts` owns a page-local promise cache keyed by font ID and package version. It loads one `FontFace` per family, catches errors/timeouts, and adds the face to `document.fonts` only after it loads. The CSS family names begin with `Nuance Specimen`, avoiding accidental matches with UI fonts.

`useSpecimenFont` observes active specimens with a 160px preload margin. Hidden Types sections and inactive panels do not start font requests. Loading begins when a card approaches the viewport; selecting a detail preview uses the same cached request/face. Returning between views/sections does not download additional weights or duplicate files. Versioned same-origin URLs also work with the browser's native HTTP cache.

Only specimen artwork receives the custom family/weight. Names, classifications, loading notices, headings, controls, paragraphs outside artwork and the application navigation remain in **Clarity City**. Generic serif/sans-serif fallbacks are explicit. Unavailable faces show a readable, accessible fallback notice; the gallery and detail selection still work. A failed face remains cached as unavailable for the current page; refresh retries it. No retry toolbar is introduced.

Gallery specimen frames reserve text/notice geometry so font arrival does not move cards. The sample uses a card-relative size, with a base size fallback for older CSS implementations. Explore shares `DiscoverySlider` with Color: three specimens per page above 1024px, two above 700px, and one on mobile. It uses the existing carousel styling, scroll snapping, swipe, arrow buttons and left/right keyboard navigation. The current page survives view and main-section changes. Existing reduced-motion behavior remains respected.

## Selection and contextual Edit

`state/types.ts` owns Types' local view and a minimal `TypefaceSelection`: stable font ID, source and registry version. The registry resolves family, classification and full metadata; binaries and duplicated font definitions do not enter selection state.

Explore is initially active and Edit is hidden. Each native specimen button is named “Preview <family>” and describes its classification. Selecting it opens a read-only detail preview with the actual family, a larger sample, a short phrase and reading text. The detail heading receives focus. Edit becomes available and resumes the selected typeface after temporary Saved/Explore or main-section navigation. Choosing another specimen explicitly changes the active selection.

`TypesSection` stays mounted alongside Colors, so its state is independent of the Color reducer. Types introduces no dirty state because no typography values can be edited in this phase. Color unsaved-change protection is untouched.

## Account favorites

The stage’s single heart-plus Save button now saves the selected typeface to the signed-in account. Guests use the existing account dialog; their selected typeface remains available after sign-in. Repeated saves upsert the same `(owner_id, font_id)` favorite instead of creating duplicates. Saving, loading and failure states are explicit, and success is reported only after the backend accepts the save.

Types → Saved reuses `SavedGallery`, `TypefaceCard` and the XS trash control, displaying the real account library and its eight-item counter. Saved remains a two-column grid with one column on mobile; specimen wrappers explicitly fill their grid cells to prevent shrink-to-fit text columns. A saved specimen opens the same Types detail workspace. Deletion requires confirmation, frees a slot, preserves records on failure, and restores keyboard focus. Typeface favorites do not consume Color composition slots.

Apply `supabase/migrations/202611090002_typeface_favorites.sql` to the connected Supabase project (after the existing account migrations). The migration creates the private `typeface_favorites` table with owner ID, stable font ID, provider/source, registry version, and timestamps. It adds a separate protected profile counter and atomic eight-item quota trigger. Existing color records, profile names, composition counters and color ownership rules are unchanged. No font binaries or duplicated family definitions are stored in the database: the versioned registry resolves canonical names, classification, loading configuration and licenses.

`account/typefaceRepository.ts` validates saved rows against the trusted registry. `useTypefaceFavorites.ts` handles loading, upsert, deletion and refresh independently of the Color/profile loading path. Missing migrations or font-library failures do not prevent Color from working. Owner and request-generation guards prevent an older account’s responses from replacing the current account’s library. Sign-out/account changes clear the Types workspace/private library; guest selections survive sign-in.

The allowance remains **eight typefaces**, separate from eight color compositions. Read-only preview selection itself is still in-memory; saved favorites persist across reloads and devices through the account. Font pairing, typography scales, advanced editing and Designs assembly remain later work.

## Extend the collection

1. Choose a typeface, verify its source/license and pin a specific Fontsource package version (or another provider's equivalent).
2. Add the required WOFF2 face and original license notice to the specimen asset directory, using a versioned filename.
3. Preserve its source metadata snapshot, compute its SHA-256/byte count, then add a namespaced registry entry with classification, supported family metadata, source label, loading configuration and explicit license attribution.
4. Keep family aliases unique, choose an available specimen weight and only the subset/style the specimens use. Additional libraries must supply the same metadata/loading contract.
5. Bump the registry version for incompatible updates; do not silently redefine a previously saved font reference. Run font verification, tests, build and browser checks.

The gallery maps the registry rather than provider-specific UI, so adding a registered family does not require new controls or a gallery rewrite. Saved favorites reference `TypefaceSelection` fields and versioned metadata. A future pairing document can combine two such references without changing font identity. Pairing, typography scales and design-system semantics remain later phases.

## Validation

`npm test` includes registry integrity, the exact eight families/classifications, pinned metadata/license checks, binary fingerprints, single-face file count, selection/navigation behavior, initial contextual Edit visibility, and loader request caching/failure handling, alongside all existing Color/account/database tests.

`npm run build` performs TypeScript and the production build. No lint command is configured. Existing Vite bundle-size/Browserslist warnings are unrelated to font file downloading; WOFF2 files are independent assets, not part of the JavaScript bundle.

Optional isolated Chrome checks:

```sh
NUANCE_PLAYWRIGHT_MODULE=/private/tmp/nuance-shell-browser/node_modules/playwright/index.mjs node tests/types-browser.mjs
```

The suite uses Chromium's platform-font inspection to confirm **actual custom-font glyph rendering**, rather than trusting a computed family string. It checks no specimen requests on initial Colors, lazy local loading, all eight exact faces, stable card geometry during delayed font arrival, UI font isolation, keyboard focus/selection, contextual Edit, cross-section Color-state preservation, cached reuse, both themes, desktop/mobile layouts, 200% CSS zoom and deliberately failed font requests. External account requests are intercepted; no live user data is changed. Run `tests/shell-browser.mjs` for the existing full Color and shell regression suite. Screenshots are written to `/private/tmp/nuance-types-review`.

The initial discovery phase passed 74 Node/component/database tests, all 85 existing shell layout checks, and the dedicated Types browser suite in development and production. The favorites extension adds repository validation, private PostgreSQL storage/quota tests and `tests/typeface-favorites-browser.mjs`: sign-in continuation, duplicate saves, eight-item libraries, reload/reopening, delete/save failure and retry, focus restoration, account isolation, stale responses, responsive layouts and isolation of font-library failures from Colors. These checks mock remote account requests and do not apply the migration to a live project.

The favorites implementation passed 76 Node/component/PostgreSQL tests, the dedicated mocked-account font-favorites browser workflow, the font-rendering/fallback suite, and all 85 existing Color/shell layout checks. TypeScript and the production build passed. The live Supabase migration was not applied by these local checks.
