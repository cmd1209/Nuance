# PatternSmith (v0.1 MVP)

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

