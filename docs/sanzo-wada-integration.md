# Sanzo Wada integration

Nuance now defaults to 348 historical combinations from Sanzo Wada's *A Dictionary
of Colour Combinations*. Discovery stays client-side in the existing three cards.
Explore More samples without replacement and excludes all three previous IDs.
`discoverPalettes` routes between `sanzo-wada` (default) and the retained
`procedural` source. `legacyInitialPalettes` preserves the original Figma presets.

## Historical data

`src/nuance/data/sanzo-wada/v1/colors.json` is an unchanged, commit-pinned copy of
[mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations/tree/c142bd0bc8049ea48db4da5eb397981f047e8ef4).
The accompanying upstream README, provenance README, and MIT license are included.
The production build also ships the license at `/nuance/licenses/sanzo-wada.txt`.
Credit: Sanzo Wada / Seigensha Art; original digitization by Dain M. Blodorn Kim;
corrected dataset and CMYK conversion by Matt DesLauriers.

`domain/wada.ts` groups colors by their original combination IDs (1–348), retaining
source-array order. It does not claim to recover a separate spatial order from
printed pages. All 159 source colors retain names, HEX, RGB, LAB, CMYK, and swatch
metadata. Raw and normalized historical data are recursively frozen. Original
HEX strings are preserved verbatim in the source/reference; current editor HEX
values use the existing uppercase normalization.

## Documents and provenance

The existing schemaVersion 1 JSON composition contract has additive metadata:

- `source: "sanzo-wada"` and `historical` identify the source palette, stable
  combination number, dataset version, original count, and original named colors.
- Each current color records `origin: original | generated | user`. Historical
  colors additionally carry `sourceColorId`, their historical name and
  `originalHex`, which survives edits. Changing an added color marks it `user`.
- `currentColorCount` follows additions/removals. `extensionIndex` is a persisted,
  monotonic seed component; removal does not reuse an extension index.
- `layoutModified` records a proportion change. Color edits, removal, additions,
  and layout changes produce the lightweight `Based on Sanzo Wada · No. …` label.

Drafts have independent composition UUIDs and retain their historical reference
through editing, navigation, serialization and reset. Deserialization checks
historical references/provenance against the canonical local dataset, restoring
its frozen reference. Older schemaVersion 1 documents without metadata still load.
No database, authentication, external discovery API, or new dependency was added.
Drafts continue to last only for the current page session.

## Authentic discovery and editor minimum

Historical cards show only the original 2–4 colors. Two colors use a 50/50 split;
three use 50/25/25; four use 50/25/12.5/12.5. Opening a pair creates a draft and
subdivides the second half for a deterministic muted complementary third color.
Its label is `Nuance-generated extension`, never a historical color name.
The original pair remains separately preserved in the reference.

Reset restores original colors and initial proportions using the canonical
library. For pairs, it reapplies that same labeled third color to satisfy the
editor's three-color minimum, with explicit status feedback. Pairs therefore
remain labeled adaptations inside the editor; their discovery cards stay
historically authentic. Other resets restore the exact three/four-color original.

The existing binary layout engine still subdivides the smallest eligible region,
preserves stable surviving IDs, clamps draggable boundaries, and exports shared
geometry at 500×300. Attribution/reset sit in existing whitespace; card and artwork
dimensions and desktop positions remain unchanged. Historical names and origin
are available in the existing color popover and accessible region labels.

## Extension algorithm

`domain/extension.ts` implements Ottosson's public-domain sRGB ↔ OKLab transforms
and uses polar OKLCH for candidates. A hash of source palette ID plus extension
index seeds candidate sampling. Draft UUIDs and timestamps do not affect Wada
suggestions. Current edited colors supply all palette measurements.

150 candidates span tonal, muted complementary, analogous, supporting-neutral,
and intermediate-hue strategies. Automatic pair extensions restrict candidates
to the complementary strategy; ordinary Add Color compares all five. Scoring
considers nearest perceptual distance, lightness gaps/spread, hue affinity,
chroma similarity and warm/cool balance, with a small seeded strategy preference.
Candidates closer than 0.065 OKLab units to any current color are rejected.
Source chroma constrains vividness, including for muted palettes. Binary-search
chroma reduction at fixed lightness/hue maps candidates into sRGB before encoding;
scoring uses the final quantized HEX. If a densely edited palette exhausts a
strategy, a deterministic supporting-neutral search finds a perceptual gap.

These are aesthetic heuristics, not an assertion that Wada authored the added
colors or that numerical spacing guarantees a particular aesthetic preference.

## Verification

`npm test` covers pinned source bytes, all 348 IDs and source color order/values,
source freezing, discovery non-repetition, every historical combination extended
to six, deterministic suggestions, sRGB HEX, perceptual spacing, strategy variety,
muted/black/white/saturated inputs, provenance, reset, serialization, and the
existing geometry/dragging/export regressions. `npm run build` checks TypeScript
and the Vite production bundle.

Local Chrome checks (temporary Playwright harness, no project dependency) cover
three-card replacement, authentic pair previews, labeled third color, historical
names, invalid/valid HEX editing, adding/removing to limits, pointer and keyboard
resize, reset, restored drafts, themes, real PNG dimensions/decoded pixels, and
no page exceptions. Desktop viewport 1545×980 and mobile 390×844 are checked for
layout and overflow; desktop 300×200 cards and 500×300 artwork retain their prior
positions. Screenshots are visually reviewed for attribution and popover layout.
