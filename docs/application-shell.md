# Nuance application shell

This is the current layout contract for Colors and future Types, Spaces, Details, and Designs sections. Domain algorithms, composition schemas, and Supabase persistence are independent of it. Follow [CSS conventions](CSS_CONVENTIONS.md) when changing styles.

## Structure and ownership

```text
NuanceApp — account and persistent Color editor state
└── AppShell — document theme and shared shell
    ├── AppHeader — logo, profile, theme controls
    ├── main.nuance-main — shared width and navigation clearance
    │   └── SectionLayout
    │       ├── heading + local navigation
    │       ├── contextual description
    │       ├── section content (Explore, Saved, or Edit)
    │       └── in-flow live status
    ├── Navigation — fixed viewport navigation
    └── native account / unsaved-change dialogs
```

`AppShell` receives header, navigation, content, and overlay slots. It does not know about palettes, editors, grids, or persistence. `AppHeader` receives account labels and callbacks. `SectionLayout` receives a title, heading ID, optional local navigation, description, arbitrary content, and optional status message. Only the Color section is implemented. The other main navigation items remain disabled.

`NuanceApp` keeps its reducer and account hook above these layout components. Switching views changes content, not the owning store. The active composition, clean baseline, saved ID, and unsaved-change confirmation survive navigation. No database or composition-format changes are part of this refactor.

## Document scrolling and short content

The document is the only primary vertical scroller. `html`, `body`, and `#root` use minimum percentage height, without fixed percentage heights. `.nuance-app` has `min-height: 100vh` followed by `min-height: 100dvh` as the dynamic-viewport implementation. It has no internal vertical overflow or fixed viewport height.

The shell is a column. The normal-flow header is followed by the main region, using the established header gap. Only `.nuance-main` can grow to absorb free viewport space. `SectionLayout` and its content are ordinary, intrinsically sized blocks. In particular, an empty Saved state does not grow or distribute its children through unused height.

The local section heading retains its existing sticky-to-top behavior. The app header scrolls away normally. The heading, description, and content use the same token-based spacing in all views. Status messages now participate in the document instead of being absolutely positioned after an expanded wrapper.

No `overflow-y: auto` or `scroll` belongs on shell, main, or section containers. Exceptions are the native modal's constrained content and the existing specialized horizontal palette carousel. Browser tests check that the carousel has no actual vertical overflow; it is not a page scroller.

`scrollbar-gutter: stable` on the document reserves scrollbar space, avoiding content-width shifts between short and long views.

## Fixed bottom navigation and clearance

`.nuance-navigation` is fixed to the viewport. It is a sibling of main, not a child of a scrolling section. Centering uses `inset-inline: 0` and automatic inline margins, without a translation transform. Shell ancestors must not gain transforms, filters, containment, or internal scrolling that would change the navigation's containing block.

The small shell geometry set is defined once in `nuance.css`:

- `--app-content-width`: existing 1140px page width.
- `--app-reading-width`: existing 780px description width.
- `--app-gutter`: 24px desktop / 16px mobile, using existing spacing tokens.
- `--app-header-gap`: 64px desktop / 32px mobile.
- `--app-nav-height`: 48px desktop / 68px stacked mobile navigation.
- `--app-nav-offset`: 24px above the viewport's safe bottom edge.
- `--app-bottom-clearance`: navigation height + offset + 32px breathing room + bottom safe-area inset.
- `--section-content-gap`: 32px desktop / 24px mobile.

Only main applies the clearance as bottom padding. Individual views must not add navigation spacers or bottom-padding compensation. Document scroll padding uses the same clearance so browser focus scrolling can reveal controls above the navigation.

The pill, colors, typography, icons, radii, and responsive stack remain intact. Navigation and header controls reflow within the available width. The viewport meta includes `viewport-fit=cover`; shell gutters and fixed navigation account for safe-area insets. Native dialogs use the browser top layer. The local popover, sticky heading, and navigation have ascending, modest stack levels (3, 4, 5).

## Background and theme ownership

The document's `--color-bg-canvas` is the single full-page background source. `index.html` starts with `data-theme="dark"` to match the initial editor preference. `AppShell` synchronizes that attribute before paint when the user changes themes. The root's `color-scheme` follows it, including native form controls and the browser canvas.

Body, root mount, app shell, main, and section layout wrappers are transparent. Do not add near-black fills, gradients, opacity, or overlay pseudo-elements to layout-only wrappers. The sticky heading needs an opaque fill and uses the same canvas token. The navigation, dialogs, artwork, and existing composition-stage gradient are intentional component surfaces; the editor surface stays limited to the editor's intrinsic content height.

Avoid CSS `:has(.nuance-app)` theme patches, separate page background aliases, and fixed-height roots. Theme ownership belongs to the shell and document; section state does not own the page background.

## Scroll and focus policy

Initial load starts normally at the top. Switching Explore/Saved/Edit scrolls the document to the main section start with native `scrollIntoView` and instant motion. Home returns to the document top. Selecting the enabled main navigation item scrolls to the section start. Future main-section routing should use the same entry policy.

The existing editor/card focus restoration remains, using `preventScroll` so it does not fight that document-scroll policy. Local arrow-key tab navigation retains focus on the chosen tab. Dialog focus trapping, Escape handling, and return focus remain native to the existing dialogs.

There is no JavaScript viewport-height measurement and no custom scroll-position store. Horizontal carousel position is still remembered independently of the active editing session.

## Audit findings and limits of the diagnosis

Before refactoring, percentage-height document roots were combined with a small-viewport-sized shell, a sticky footer in normal flow, and several nested `flex: 1 0 auto` wrappers (`main`, content, and editor). Those wrappers mixed shell sizing with section sizing. The status message was absolutely positioned after the expanded main region, and navigation spacing depended on normal-flow flex gaps. This made sparse-view geometry and content-end clearance depend on which wrapper happened to grow.

The page background was independently painted by the document, app, carousel, and sticky heading; the composition stage also had an intentional gradient. The root theme used a descendant `:has()` workaround while the app set its own color scheme. These were unnecessary independent surfaces and responsibilities. The refactor removes that structure rather than adding an element to cover a band.

Important evidence distinction: local pre-refactor Chrome tests resolved the main dark canvases to the same `#0f0e0e` and did **not** reproduce the user's exact display-dependent bands. A specific GPU/compositor defect was never confirmed. The structural causes of inconsistent sizing are demonstrable; the historical screenshot's exact paint discrepancy remains unconfirmed. The new browser suite verifies an uninterrupted sampled page canvas in both themes, including empty Saved, rather than claiming an unobserved original failure was reproduced.

## Future section rules

1. Mount section content in `SectionLayout` inside `AppShell`.
2. Pass local navigation and descriptions as content; do not teach the shell about fonts, colors, or saved datasets.
3. Keep domain/editor/persistence state above view changes when work must survive navigation.
4. Never introduce section viewport heights, primary vertical overflow, layout-only backgrounds, footer spacers, or view-specific navigation offsets.
5. Use `Navigation.activeSection` and `onSelect` when enabling a real, implemented section. Availability and current-page state are separate.
6. Keep specialized overlays local or in the shell overlay slot; use native dialogs for modal UI.
7. Test both sparse and long content, viewport resizing, zoom/reflow, and focus navigation before shipping.

## Validation and reproduction

`npm test` runs the project's Node/domain/component tests and PostgreSQL ownership/quota tests. `npm run build` performs TypeScript checking and the Vite production build. The project has no separate lint command or installed lint tool.

An optional isolated Chrome suite is checked in as `tests/shell-browser.mjs`. It uses synthetic accounts and intercepts all API traffic; it does not mutate real saved work, profiles, sessions, or passwords. Vite must have Supabase configuration so the existing account code is enabled. Its URL is read only to derive the mock storage key.

To run with temporary browser tooling outside the repository:

```sh
npm install --prefix /private/tmp/nuance-shell-browser playwright
npm run dev -- --host 127.0.0.1 --port 5176
# In a second terminal:
NUANCE_PLAYWRIGHT_MODULE=/private/tmp/nuance-shell-browser/node_modules/playwright/index.mjs node tests/shell-browser.mjs
```

Override `NUANCE_CHROME`, `NUANCE_BASE_URL`, or `NUANCE_ARTIFACTS` as needed. The default executable is installed macOS Chrome. This is optional development tooling, not an application dependency.

The suite exercises eight viewport sizes (1920×1080 through 320×568, including 568×320 landscape), both themes, empty and 1/2/4 saved records, long generic content, native document scrolling, fixed-navigation offsets and clearance, page-width stability, editing continuity, mouse border dragging, color editing, add/remove/reset, save/upsert IDs, quota enforcement, deletion failure/retry, profile changes, modal focus return, and keyboard tabs. It also exercises 200% CSS page zoom and Chrome-emulated safe-area insets. Native browser-toolbar zoom, physical mobile browser chrome, GPU-specific rendering, real email delivery, and real Supabase network writes are outside this mocked suite.

PNG export remains implemented and covered by the existing drawing tests and a browser canvas-encoding check. Its UI control intentionally remains hidden, per the explicit scope clarification for this task.

Before/after Explore and empty Saved screenshots (desktop/mobile, dark/light), failure screenshots if any, and the numeric layout report are written under `/private/tmp/nuance-shell-review`. Historical screenshots use a fresh shuffled palette set, so visual comparison should compare typography/geometry and source attribution rather than requiring identical randomly selected palette colors.


### Executed refactor checks

At completion of the refactor, the TypeScript/Vite production build and all 49 Node/component/PostgreSQL test cases passed. The isolated Chrome suite passed 41 numeric layout checks plus the interaction flows described above, with no page exceptions. Background samples were uniform at the checked screenshot coordinates in both themes. Before/after images were visually reviewed for empty Saved and populated Explore; discovery colors differ because of the intentional shuffle.
