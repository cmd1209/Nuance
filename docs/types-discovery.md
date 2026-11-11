# Types — Google Fonts discovery and account favorites

Types Explore is a functional 30-typeface gallery. It keeps Nuance's `AppShell`, `SectionLayout`, segmented navigation, fixed bottom navigation, one document scroll, theme canvas and interface font. Spaces and Details keep their existing foundation components. Color editing, discovery and persistence are unchanged.

## Collection and registry

The collection preserves the original eight families and appends the 22 requested additions, for 30 total: 9 serif, 18 sans-serif, 2 monospace, and 1 display family. Inconsolata and Source Code Pro are labeled Monospace and use a monospace fallback. Comfortaa follows its source classification, Display. The gallery has no category sections, filters, search fields, or pairing controls. The saved-favorite allowance remains eight.

`domain/typefaces.ts` exports a deeply frozen registry, lookup functions and explicit fallback stacks. `data/typefaces/v1/registry.json` records:

- Namespaced stable ID (`google-fonts:inter`), family, source/provider label and classification.
- Available family weights/styles/subsets and variable-font support.
- Versioned, same-origin specimen URL, isolated CSS family alias, WOFF2 format, normal style, weight range, Latin subset, 400 specimen weight and swap display behavior. Static families also record a pinned local file, upstream URL, hash and byte count for each additional supported weight.
- Pinned Fontsource package/font versions, exact upstream asset/metadata/license URLs, SHA-256 fingerprint and byte count.
- OFL license identifier, attribution, license URL and a self-hosted notice.

The individual pinned Fontsource metadata snapshots are checked in beside the registry. Family availability metadata describes the full upstream family; **only normal Latin faces are shipped**. Italic styles and non-Latin subsets are not downloaded.

## Source, licenses and files

The files come from Fontsource's Google Fonts packages, pinned to **5.3.0**. Fontsource documents [self-hosting](https://fontsource.org/docs/getting-started/introduction) and [variable faces](https://fontsource.org/docs/getting-started/variable). Each font is licensed under **SIL Open Font License 1.1**; its original copyright/license notice is preserved in `public/nuance/fonts/specimens/<id>-LICENSE.txt`. No binaries are modified or renamed internally; the CSS aliases isolate specimens from application typography.

Variable families use one file per family. Lato, PT Serif, Fira Sans, Barlow, and Arvo have separate files for their supported static weights; DM Serif Display, Questrial, and Archivo Black have one static weight each. The 52 Latin WOFF2 files total **1,474,100 bytes** (approximately 1.47 MB decimal). They require no runtime Fontsource/Google API, external stylesheet, CDN request, new package dependency or build-time download.

`npm run fonts:verify` checks the local font binaries against the registry fingerprints. `node scripts/vendor-typefaces.mjs --restore` explicitly downloads the same pinned files/notices and verifies font hashes before restoring them. It does not update versions or query “latest”. Do not overwrite a pinned asset with a different font under the same URL.

## Loading and rendering

`typography/fontLoading.ts` owns a page-local promise cache keyed by font ID, package version, and asset URL. It loads one `FontFace` per variable family and one per selected static weight, catches errors/timeouts, and adds the face to `document.fonts` only after it loads. The CSS family names begin with `Nuance Specimen`, avoiding accidental matches with UI fonts.

`useSpecimenFont` observes active specimens with a 160px preload margin. Hidden Types sections and inactive panels do not start font requests. Loading begins when a card approaches the viewport; selecting a detail preview uses the same cached request/face. Returning between views/sections reuses loaded files. Changing a variable weight reuses its face; selecting a new static weight loads just that weight. Versioned same-origin URLs also work with the browser's native HTTP cache.

Only specimen artwork receives the custom family/weight. Names, classifications, loading notices, headings, controls, paragraphs outside artwork and the application navigation remain in **Clarity City**. Generic serif, sans-serif, and monospace fallbacks are explicit; display faces use the sans-serif fallback. Unavailable faces show a readable, accessible fallback notice; the gallery and detail selection still work. A failed face remains cached as unavailable for the current page; refresh retries it. No retry toolbar is introduced.

Gallery specimen frames reserve text/notice geometry so font arrival does not move cards. The sample uses a card-relative size, with a base size fallback for older CSS implementations. Explore shares `DiscoverySlider` with Color: three specimens per page above 1024px, two above 700px, and one on mobile. It uses the existing carousel styling, scroll snapping, swipe, arrow buttons and left/right keyboard navigation. The current page survives view and main-section changes. Existing reduced-motion behavior remains respected.

## Selection and contextual Edit

`state/types.ts` owns Types' local view and a minimal `TypefaceSelection`: stable font ID, source and registry version. The registry resolves family, classification and full metadata; binaries and duplicated font definitions do not enter selection state.

Explore is initially active and Edit is hidden. Each native specimen button is named “Preview <family>” and describes its classification. Selecting it opens a read-only detail preview with the actual family, a larger sample, a short phrase and reading text. The detail heading receives focus. Edit becomes available and resumes the selected typeface after temporary Saved/Explore or main-section navigation. Choosing another specimen explicitly changes the active selection.

`TypesSection` stays mounted alongside Colors, so its state is independent of the Color reducer. Types introduces no dirty state because no typography values can be edited in this phase. Color unsaved-change protection is untouched.

## Account favorites

The stage’s single heart-plus Save button now saves the selected typeface to the signed-in account. Guests use the existing account dialog; their selected typeface remains available after sign-in. Repeated saves upsert the same `(owner_id, font_id)` favorite instead of creating duplicates. Saving, loading and failure states are explicit, and success is reported only after the backend accepts the save.

Types → Saved reuses `SavedGallery`, `TypefaceCard` and the XS trash control, displaying the real account library and its eight-item counter. Saved remains a two-column grid with one column on mobile; specimen wrappers explicitly fill their grid cells to prevent shrink-to-fit text columns. A saved specimen opens the same Types detail workspace. Deletion requires confirmation, frees a slot, preserves records on failure, and restores keyboard focus. Typeface favorites do not consume Color composition slots.

Apply `supabase/migrations/202611090002_typeface_favorites.sql` to the connected Supabase project (after the existing account migrations). The migration creates the private `typeface_favorites` table with owner ID, stable font ID, provider/source, registry version, and timestamps. It adds a separate protected profile counter and atomic eight-item quota trigger. Existing color records, profile names, composition counters and color ownership rules are unchanged. No font binaries or duplicated family definitions are stored in the database: the versioned registry resolves canonical names, classification, loading configuration and licenses.

Apply `supabase/migrations/202611100001_typeface_specimen_settings.sql` after the favorites migration to enable saving `font_weight` and `alphabet`. Existing favorites receive Normal (400) and quote mode defaults without changing ownership, counts, or color records. Saving an existing font updates its settings in the same favorite. Saved cards render these persisted settings, and reopening restores them in Edit.

`account/typefaceRepository.ts` validates saved rows against the trusted registry. `useTypefaceFavorites.ts` handles loading, upsert, deletion and refresh independently of the Color/profile loading path. Missing migrations or font-library failures do not prevent Color from working. Owner and request-generation guards prevent an older account’s responses from replacing the current account’s library. Sign-out/account changes clear the Types workspace/private library; guest selections survive sign-in.

The allowance remains **eight typefaces**, separate from eight color compositions. Read-only preview selection itself is still in-memory; saved favorites persist across reloads and devices through the account. Font pairing, typography scales, advanced editing and Designs assembly remain later work.

## Baseline resizing

The bottom typeface actions include a Lucide CaseSensitive button that switches the editing specimen to the paired-case alphabet AaBb…Zz and hides the attribution. The control changes to a MessageSquareQuote icon to restore the assigned quote and caption. Both modes share the typeface’s current size and baseline resizing; each typeface remembers its mode during the session. Explore continues to display the assigned quote; Saved displays the saved mode.

The TypeOutline action cycles through the selected family’s available weights in ascending order, wrapping after the last weight. Its tooltip and accessible label identify the current and next weights. Single-weight fonts disable the action. Locally loaded variable faces or individual static weight files supply the actual weights, with synthesis disabled. Quote and alphabet modes share the selected weight, which is remembered per typeface during the session and reflected in Explore. Saved specimens persist the font reference, selected weight, and alphabet mode.

Specimen artwork contains the assigned quote and attribution, or the paired-case alphabet with no caption. Saved previews display the persisted mode and weight. In Edit, only the quote has a draggable baseline handle; the attribution keeps its caption size. Drag down to enlarge or up to shrink; arrow keys adjust by 1px (Shift: 8px), and Home/End select the size limits. Quote sizes range from 14–192px. Each typeface keeps its own sizes while navigating during the current session. Favorites persist weight and alphabet mode alongside the font reference; custom sizes are not persisted to the account. Explore, Saved, and Edit start quotes at 36px. Once manually resized, Explore mirrors that typeface’s edited size for the session. Saved retains the 36px preview default.

`tests/typeface-resizing-browser.mjs` uses the isolated Playwright setup below to verify real baseline alignment, captured dragging, keyboard controls, size limits, per-font/session state, responsive wrapping, and bottom action placement.

## Extend the collection

1. Choose a typeface, verify its source/license and pin a specific Fontsource package version (or another provider's equivalent).
2. Add the required WOFF2 face and original license notice to the specimen asset directory, using a versioned filename.
3. Preserve its source metadata snapshot, compute its SHA-256/byte count, then add a namespaced registry entry with classification, supported family metadata, source label, loading configuration and explicit license attribution.
4. Keep family aliases unique, choose an available specimen weight and only the subset/style the specimens use. Additional libraries must supply the same metadata/loading contract.
5. Bump the registry version for incompatible updates; do not silently redefine a previously saved font reference. Run font verification, tests, build and browser checks.

The gallery maps the registry rather than provider-specific UI, so adding a registered family does not require new controls or a gallery rewrite. Saved favorites reference `TypefaceSelection` fields and versioned metadata. A future pairing document can combine two such references without changing font identity. Pairing, typography scales and design-system semantics remain later phases.

## Validation

`npm test` includes registry integrity, the exact 30 families/classifications, pinned metadata/license checks, binary fingerprints, complete static-weight coverage and file count, selection/navigation behavior, initial contextual Edit visibility, and loader request caching/failure handling, alongside all existing Color/account/database tests.

`npm run build` performs TypeScript and the production build. No lint command is configured. Existing Vite bundle-size/Browserslist warnings are unrelated to font file downloading; WOFF2 files are independent assets, not part of the JavaScript bundle.

Optional isolated Chrome checks:

```sh
NUANCE_PLAYWRIGHT_MODULE=/private/tmp/nuance-shell-browser/node_modules/playwright/index.mjs node tests/types-browser.mjs
```

The suite uses Chromium's platform-font inspection to confirm **actual custom-font glyph rendering**, rather than trusting a computed family string. It checks no specimen requests on initial Colors, lazy local loading, all 30 exact families, stable card geometry during delayed font arrival, UI font isolation, keyboard focus/selection, contextual Edit, cross-section Color-state preservation, cached reuse, both themes, desktop/mobile layouts, 200% CSS zoom and deliberately failed font requests. External account requests are intercepted; no live user data is changed. Run `tests/shell-browser.mjs` for the existing full Color and shell regression suite. Screenshots are written to `/private/tmp/nuance-types-review`.

The initial discovery phase passed 74 Node/component/database tests, all 85 existing shell layout checks, and the dedicated Types browser suite in development and production. The favorites extension adds repository validation, private PostgreSQL storage/quota tests and `tests/typeface-favorites-browser.mjs`: sign-in continuation, duplicate saves, eight-item libraries, reload/reopening, delete/save failure and retry, focus restoration, account isolation, stale responses, responsive layouts and isolation of font-library failures from Colors. These checks mock remote account requests and do not apply the migration to a live project.

The favorites implementation passed 76 Node/component/PostgreSQL tests, the dedicated mocked-account font-favorites browser workflow, the font-rendering/fallback suite, and all 85 existing Color/shell layout checks. TypeScript and the production build passed. The live Supabase migration was not applied by these local checks.

### Custom specimen text

Apply `supabase/migrations/202611110001_typeface_custom_text.sql` after the specimen-settings migration before running this version against Supabase. It adds `custom` and nullable `custom_text` (up to 2,000 characters); existing favorites retain their quote/alphabet presentation.

The specimen control cycles Quote → Alphabet → Edit. Edit uses the TextCursorInput icon and opens a text field without the quote caption. Ctrl+Enter, Command+Enter, or Escape finishes typing; double-click the custom specimen or focus it and press Enter to edit again. Saving retains custom text and its presentation. Returning to Quote restores the original attribution and keeps custom text available for the next Edit cycle. Reset uses the palette's RotateCcw icon and restores the original quote, default size, and weight; save again to persist the reset.

### Expanding the collection

`node scripts/import-typefaces.mjs <fontsource-id> ...` imports explicitly named families from pinned Fontsource 5.3.0 packages. It stages metadata, original license notices, and verified WOFF2 downloads before writing the registry; existing IDs are skipped. The versioned registry remains at v1 because existing IDs and selection formats are unchanged. Adding these families needs no database migration.

All 30 families have explicit assignments to the same four quotes in `TypefaceSpecimen.tsx`: reading-oriented serifs and Noto Sans use Bringhurst; text and code-oriented families primarily use Spiekermann; expressive letterforms use Carter; versatile and geometric families use Vignelli. Original assignments remain stable.

`tests/typeface-weights-browser.mjs` verifies every static weight in Lato, PT Serif, Fira Sans, Barlow, and Arvo using Chromium's actual rendered PostScript face names; each weight must use a distinct bundled face and each file must be requested only once. It also checks Monospace/Display labels, single-weight controls, and mobile wrapping. Use the same `NUANCE_PLAYWRIGHT_MODULE` and `NUANCE_BASE_URL` settings as the main Types browser suite.
