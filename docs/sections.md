# Application destinations and creative-section state

Nuance has five functional destinations in its existing fixed bottom navigation: Colors, Types, Spaces, Details, and Designs. They share one `AppShell`, one main landmark, the existing global canvas, and the browser document scroll. The [application-shell contract](application-shell.md) still applies.

## Global and local responsibilities

`state/application.ts` owns only the active main section and global light/dark theme. Authentication, profile, and existing saved Color records remain in the application-level `useAccount` hook. No new database tables, schemas, persistence adapters, routing dependencies, or generated datasets were introduced.

`state/editor.ts` continues to own all Color-specific work: local Explore/Saved/Edit view, active composition, drafts, clean baselines, source attribution, selection, and unsaved-change confirmation. It no longer owns the application theme. Composition documents and algorithms are unchanged.

`NuanceApp` keeps these stores mounted above the section content. Every `SectionLayout` stays mounted; the native `hidden` attribute makes inactive sections absent from layout and keyboard navigation. This retains section UI state without adding viewport wrappers or scroll containers. The Color picker closes on global navigation; its underlying composition and selected color remain intact.

Switching main sections never dispatches Color reset/back/select actions and never prompts to discard work. Returning to Colors restores its previous local view and exact editing session. Explicit Designs links to Color Explore or Saved change only that local view, preserving the current editing context for the Edit tab.

The Color carousel ignores zero-width measurements while its containing section is hidden. It restores the remembered page when visible, including when the viewport breakpoint changes.

## Four creative destinations

Colors remains the complete palette exploration/editing/saving experience.

Types, Spaces, and Details use one `FoundationSection` component configured by `domain/sections.ts`. Each mounted instance has its own local Explore/Saved state. Changing Types to Saved does not change Spaces or Details; leaving and returning preserves that local choice.

Each uses the established `SectionLayout`, `SectionNavigation`, `Button`, and shared `EmptyState` presentation. All provided contextual descriptions are kept in the section definitions, including the future Edit descriptions. Explore is initially active, Saved works, and Edit stays hidden because no valid selection exists yet. Do not enable Edit with a fabricated selection merely to fill out the navigation.

The foundation deliberately does not load fonts, pair typefaces, generate scales, edit typography, create grids/spacing systems, render detail generators, or persist new favorites. Future implementations may replace a section's content and add its own editing state without changing the shell. The shared structure does not assume palettes or a grid.

## Designs is assembly-oriented

`DesignsSection` has a heading, the provided description, and a `Your Design` area with four ingredients: Colors, Types, Spaces, and Details. It has no Explore/Saved/Edit control.

Colors reads actual saved composition names and availability from `account.saved`. It supports the existing account loading/error/retry states, a signed-out sign-in action, and an honest empty state. A link opens the real Color Saved view; an empty library can lead to Color Explore. Counts and names update after saves or deletion without a reload.

Types, Spaces, and Details explain that saved ingredients will become available when their exploration tools are ready and link to those real destinations. These are availability messages, not fake saved selections or disabled placeholder cards.

The current layout uses two columns where space permits and one on mobile, using existing spacing and typography tokens. It adds no decorative surfaces or extra navigation. There is no selection store for a design yet, and no design preview/export engine. Those workflows belong to a later phase.

## Navigation, focus, and persistence

Global destinations are in-session application state, matching the existing local-view model. No URL/deep-link router or browser-history protocol is added. Reloading starts in Color Explore; existing authentication sessions and saved Color compositions retain their existing persistence behavior.

Selecting a different main destination uses native document scrolling to return to the top and focuses that section's heading. Selecting the current destination scrolls to main. Local view switching retains the existing section-start scroll policy and keyboard tab behavior. The main navigation uses one `aria-current="page"` item and all five buttons are enabled; each creative tablist has section-specific IDs.

Profile and theme controls remain global and available from every destination. Unsaved-change confirmation is still limited to explicitly replacing a Color composition, not leaving its section temporarily.

## Validation

The optional `tests/shell-browser.mjs` suite now includes the new sections, exact descriptions, independent local navigation, hidden Edit states, main navigation, real saved-color availability in Designs, Color editing/carousel retention across all destinations, and cross-section theme changes. It also retains the existing layout, responsive, editing, profile, quota, deletion, and mocked persistence checks. Screenshot colors are compared to the current computed canvas token so legitimate token adjustments do not invalidate the background test.

Run `npm test`, `npm run build`, and the optional browser command documented in [application-shell.md](application-shell.md). No separate lint command is configured. Tests use synthetic account data and intercept external requests; they do not write to a real user account.
