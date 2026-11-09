# Nuance — Design exploration

Nuance's Color experience builds on the existing Patternsmith React/Vite/TypeScript/Tailwind app and preserves its Figma palette-selection and manipulation screens. Palette discovery now mixes 348 Sanzo Wada combinations with 30 approved Werner · Nuance palettes using balanced collection cycles, with deterministic OKLCH extensions for compositions of up to six colors. See [the Wada integration notes](docs/sanzo-wada-integration.md) for source attribution, provenance, reset behavior, and generation details.

All five main destinations are active. Colors contains the complete creative tool. Types, Spaces, and Details provide independent Explore/Saved foundations, while Designs introduces the four-ingredient assembly structure using only real saved-color availability. Switching destinations preserves the active Color workspace. See [section architecture](docs/sections.md).

```bash
npm install
npm run dev
npm test
npm run build
```

Choose a historical palette, click a color to see its name/origin and edit its HEX, add harmonizing colors up to six, remove down to three, reset its original colors/proportions, or drag the internal boundaries. Two-color originals stay authentic in discovery and gain a labeled Nuance-generated third color in the editor. Boundaries also support arrow keys, Shift+arrows, Home and End. The PNG renderer exports artwork only, while its UI control is currently hidden; Save to account stores the editable composition when signed in. Returning to a palette restores its client-side draft. Theme changes leave artwork colors unchanged.

Explore begins with 60 interleaved palettes, split equally between Wada and Werner · Nuance, and appends balanced batches as you browse. Each collection exhausts its own shuffled cycle before repeating. The loaded order stays stable while browsing, editing, and changing themes. The slider advances by three compositions on desktop, two on tablet (701–1024px), and one on mobile (700px and below), using swipe, navigation arrows, or the keyboard. Returning from the editor restores the selected palette’s exact occurrence. See [unified discovery](docs/unified-color-exploration.md) for source registration, attribution and cycle behavior.

Composition documents are versioned, serializable JSON with stable IDs. State transitions, palette generation, geometry, serialization and PNG export are separate from UI rendering. Supabase supports email/password sign-in and sign-up, email-based password recovery, a minimal private profile, and up to eight explicitly saved color compositions after applying the eight-save migration. The future Types save allowance is also eight; typography persistence is not implemented yet. See [account setup](docs/accounts.md) to connect a project and configure email templates and callback URLs. Unsaved drafts and theme preferences reset on page refresh; account sessions and saved compositions persist when Supabase is configured.

See [the application shell contract](docs/application-shell.md) for document scrolling, fixed navigation, theme ownership, section conventions, and browser validation.

The development-only [Werner · Nuance Curation Studio](docs/werner-curation.md) is available at `/dev/werner-curation` while running Vite. It contains 110 verified historical colors and 200 generated candidates for local review and export. The studio and generation engine remain excluded from production. Its 30 explicitly imported approvals now join Wada in Color Explore; later curation decisions never publish automatically.

See [the architecture and design notes](docs/nuance-architecture.md) for the future persistence boundary, exact Figma sources, documented design differences, Code Connect prerequisite and validation results.

The original Patternsmith app and infrastructure are preserved in `src/PatternsmithApp.tsx`, `src/components` and `src/lib`.

---

# Original PatternSmith (v0.1 MVP)

PatternSmith is a small local-first UI helper that turns a handful of **UI pattern decisions** (layout, density, radius, shadow, theme, accent) into:

- tokenized CSS variables (`:root` + `.dark`)
- a Tailwind `theme.extend` snippet
- a starter React component bundle (`Button`, `Card`, `Input`, `Badge`)

The app also shows a live preview dashboard so you can see the token decisions before exporting code.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS
- Minimal dependencies only

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite (usually `http://localhost:5173`).

## MVP scope (in)

- 2-pane layout (left controls/export, right live preview)
- Controls for layout, density, radius, shadow, theme, and accent presets
- Live preview with header, 3 cards, button, input, and badge
- Export panel with copy-to-clipboard for:
  - CSS variables
  - Tailwind theme extension
  - React component starter kit (4 files bundled in one block)

## Out of scope (for now)

- Authentication / SaaS features
- Database / backend
- Image or screenshot analysis
- AI generation
- File uploads
- Complex state management or routing

