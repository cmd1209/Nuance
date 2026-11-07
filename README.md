# Nuance — Color exploration

Nuance's Color experience builds on the existing Patternsmith React/Vite/TypeScript/Tailwind app and preserves its Figma palette-selection and manipulation screens. Palette discovery now draws from 348 Sanzo Wada combinations, with deterministic OKLCH extensions for compositions of up to six colors. See [the Wada integration notes](docs/sanzo-wada-integration.md) for source attribution, provenance, reset behavior, and generation details.

```bash
npm install
npm run dev
npm test
npm run build
```

Choose a historical palette, click a color to see its name/origin and edit its HEX, add harmonizing colors up to six, remove down to three, reset its original colors/proportions, or drag the internal boundaries. Two-color originals stay authentic in discovery and gain a labeled Nuance-generated third color in the editor. Boundaries also support arrow keys, Shift+arrows, Home and End. The PNG renderer exports artwork only, while its UI control is currently hidden; Save to account stores the editable composition when signed in. Returning to a palette restores its client-side draft. Theme changes leave artwork colors unchanged.

Browse all 348 historical compositions in a freshly shuffled order on each page load. The order stays stable while browsing, editing, and changing themes. The slider advances by three compositions on desktop, two on tablet (701–1024px), and one on mobile (700px and below), using swipe, navigation arrows, or the keyboard. Returning from the editor restores the selected palette's page.

Composition documents are versioned, serializable JSON with stable IDs. State transitions, palette generation, geometry, serialization and PNG export are separate from UI rendering. Supabase supports email/password sign-in and sign-up, email-based password recovery, a minimal private profile, and explicit composition saving. See [account setup](docs/accounts.md) to connect a project and configure email templates and callback URLs. Unsaved drafts and theme preferences reset on page refresh; account sessions and saved compositions persist when Supabase is configured.

See [the application shell contract](docs/application-shell.md) for document scrolling, fixed navigation, theme ownership, section conventions, and browser validation.

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

