# Nuance Color — Phase 1

The original architecture below is extended by the [Sanzo Wada integration](sanzo-wada-integration.md), which documents current discovery, additive provenance fields, two-color previews, and generation/reset behavior.

## Composition and persistence boundary

`src/nuance/domain/composition.ts` defines the document shared by the editor, layout engine and PNG exporter:

```ts
interface Composition {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  artwork: { width: number; height: number; gap: number };
  colors: { id: string; hex: string }[];
  layout: LayoutNode;
}
```

A layout node is either a region referring to a stable color ID or a binary split with its own ID, axis, normalized ratio and two children. Documents contain no React objects, DOM measurements, account IDs, UI theme, selected state or browser objects. IDs survive color edits, split resizing and JSON round-trips. New colors and splits receive UUIDs; creating an editable draft creates a new document ID without replacing its original preset.

`serializeComposition` and `deserializeComposition` are the only document format boundary. Deserialization reconstructs known fields, validates versions, timestamps, dimensions, colors, IDs, unique region references, tree depth and valid geometry. Unknown future versions are rejected rather than silently corrupted.

`state/editor.ts` owns the editor transitions independently of the view. `NuanceApp` hosts that state with React's reducer. Preferences live separately in `state.preferences`; transient input text, the open color popover and download feedback stay in UI state. Drafts are currently indexed by source palette ID; each stored document has its own independent ID. Returning to the same palette restores its draft. Explore More replaces only suggestions and retains drafts. Changing the theme cannot mutate a composition.

### Adding Supabase later

Add persistence outside the editor: load a JSON document, validate it with `deserializeComposition`, then put it in the document state. Observe document changes and pass `serializeComposition(document)` to a future save function. The adapter can persist preferences separately. Auth identifies the owner at that boundary; it does not enter the layout or rendering code. Session restoration can load active document IDs and preferences there as well.

There is deliberately no adapter interface, Supabase dependency, auth UI, database schema, localStorage write, or cloud request yet. Drafts and preferences last for the current page session only; refreshing resets them. PNG download is an independent export action, not a save-to-library operation. The same composition document can later be referenced by Type, Space and Detail without coupling their future UI to this Color screen.

## Geometry and rendering

- `domain/layout.ts`: normalized partitions, constraints, adding, removal and shared painted rectangles.
- Initial areas: 50 / 25 / 25. A fourth color subdivides the last 25% region to produce 50 / 25 / 12.5 / 12.5. Subsequent additions split the smallest eligible region along its longer physical side.
- Limits: three to six colors; a region's minimum normalized extent is 8% of the whole artwork on each axis.
- Dragging clamps ratios against descendant minimum extents. Tightening an ancestor also normalizes descendant ratios in the document, so serialized and displayed layouts agree.
- Removal promotes a sibling subtree into its parent, preserving full coverage and stable IDs for surviving nodes.
- `components/Artwork.tsx`: renders geometry, uses Pointer Events/capture and reads the artwork bounds only at gesture start. Geometry stays independent of responsive screen pixels.
- Separators support arrows (2%), Shift+arrows (10%), Home and End. Visible gutters are 8 artwork pixels; hit areas are 20 CSS pixels, expanded to 28 on coarse pointers. Touch scrolling is suppressed only on active separator controls.
- `export/png.ts`: draws only artwork at the document's original 500×300 size using the same painted rectangles. Gutters are transparent, so changing the interface theme never changes exported art. No UI outlines, labels, popovers or toolbar are exported.

## Figma source and explicit differences

Source: `fWnLFvrPLaTtREPwyHzoLi`, frames `35:1311` (selection) and `40:1796` (manipulation). Neither Figma frame was modified by this implementation.

- The 932px content column, 640px instruction width, 300×200 preset cards, 500×300 artwork, spacing, corner radii, toolbar and bottom navigation come from those frames.
- `tokens.css` exports the existing primitive and semantic variable aliases, including the intentionally reversed Primary button mappings. UI theme and composition colors are separate.
- The frame's actual left/right proportions differ slightly from the written 50/25/25 requirement. This implementation follows the explicit proportional requirement. No alternate page layout was introduced.
- Controls and the wordmark use locally bundled Clarity City. Source headings/instructions use Roboto M3 styles, retained for visual fidelity. The source's 32/40 heading, 16/24 copy, 0.5px tracking and 49.787px wordmark are measured source styles; they are not invented replacements for missing tokens. The original M3 variables are not in the local token collections.
- The 932px and 500px source dimensions do not have exact named layout aliases in the existing collections. They remain documented frame measurements in CSS instead of modifying the design system.
- The manipulation concept displays `#196AAC` over the beige region. The functional editor shows the actual selected region's HEX instead.
- The contextual picker concept contains only HEX and Adjust. A compact contextual native color picker/validated HEX form supplies the requested interaction; there is no permanent sidebar.
- The Figma User control remains visible but disabled. Type, Space and Detail remain visible, keyboard discoverable, and marked unavailable. No authentication or placeholder feature pages were built.
- Narrow screens retain the same navigation, three-card row and artwork hierarchy. Toolbar actions wrap when needed; touch controls expand to 44px minimum height.
- All eleven Figma SVG assets are downloaded unmodified into `public/nuance/icons`. CSS masks preserve their geometry and inherit semantic theme colors. Both fonts and their licenses are bundled locally; no Figma asset URLs or remote font requests remain at runtime.

## Code Connect readiness

The user requested mappings. Figma reports the relevant components as `UNPUBLISHED`. The Code Connect skill requires published team library components, so no mappings were published and no Figma components were published on the user's behalf.

Proposed matches once published:

| Figma component | Node | Code |
| --- | --- | --- |
| Button / Ghost | 28:374 | `components/Button.tsx` (`variant="ghost"`) |
| Button / Primary | 28:158 | `components/Button.tsx` (`variant="primary"`) |
| Color-Pallet-Selection | 35:1040 | `components/PaletteCard.tsx` |
| navigation | 35:1188 | `components/Navigation.tsx` |
| Source Lucide icons | corresponding original icon nodes | `components/Icon.tsx` |

Paths above are relative to `src/nuance`. Button size, label and optional icon slots have direct code props. Hover/press/focus are browser interactions; disabled uses the native disabled prop. Do not map unrelated old Patternsmith preview buttons.

## Verification

- `npm run build`: TypeScript and Vite production build.
- `npm test`: nine Node test cases covering exact presets, HEX validation, proportions, region limits, removal of every leaf, extreme divider changes, palette replacement, navigation/draft independence, document round-tripping and artwork-only drawing. Tests reuse Vite's installed esbuild and Node's built-in test runner; no test framework or runtime dependency was added.
- Temporary Playwright/installed Chrome checks at 1545×980 and 390×844 passed all 12 requested interaction scenarios with no browser exceptions. Verified every Figma asset loads locally, actual PNG dimensions/filename/decoded pixels, both axis drags, keyboard resizing, invalid HEX, six/three limits, theme independence and draft restoration.
- Desktop content bounds match the Figma measurements exactly: selection x=306.5/y=278.5/w=932/h=408, editor artwork x=522.5/y=400.5/w=500/h=300.
- Production build reports only the repository's existing outdated Browserslist data notice.

The Patternsmith implementation is retained in `src/PatternsmithApp.tsx` with its original components/utilities. The existing Vite, React, TypeScript and Tailwind setup remains in use.
