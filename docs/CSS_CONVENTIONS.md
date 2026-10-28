# Nuance — CSS Coding Conventions

## Purpose

CSS must remain readable, maintainable, predictable, and easy to debug by a human developer.

**Readable source code is a project requirement, not an optional formatting preference.**

These rules apply to all CSS written or modified by coding agents.

## 1. Formatting

Use expanded, multiline CSS formatting.

- One selector block per section.
- One declaration per line.
- Four-space indentation.
- A blank line between rules.
- Opening braces on the selector line.
- Closing braces on their own line.
- A space after each colon.
- End every declaration with a semicolon.
- Never minify or compress source CSS.
- Never use one-line declaration blocks, including for simple selectors.
- Use multiline formatting inside media queries and pseudo-class rules.

### Correct

```css
.nuance-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background-color: var(--color-action-primary);
    color: var(--color-action-on-primary);
    cursor: pointer;
}

.nuance-button:hover {
    background-color: var(--color-action-primary-hover);
}
```

### Incorrect

```css
.nuance-button { display: inline-flex; gap: var(--gap-sm); padding: 12px 24px; }
.nuance-button:hover { background: blue; }
```

## 2. Naming conventions

Use consistent, descriptive class names.

Existing Nuance classes follow a BEM-inspired convention:

```css
.nuance-header {}
.nuance-header__actions {}
.nuance-button {}
.nuance-button--primary {}
.nuance-button--sm {}
```

Preserve established class names. Do not rename selectors simply for stylistic consistency unless corresponding markup and tests are updated.

Use:

- `block` for a component
- `block__element` for a child element
- `block--modifier` for a variant
- `is-*` for transient UI states when necessary

Avoid deeply nested selectors and selectors dependent on fragile DOM structure.

Scope application-specific rules under `.nuance-app` where isolation is necessary, but do not repeat the parent selector unnecessarily when an existing component class already provides appropriate scoping.

## 3. Design tokens

Use the established project variables for recurring design decisions.

Examples:

```css
color: var(--color-text-primary);
background-color: var(--color-bg-surface);
gap: var(--gap-sm);
border-radius: var(--radius-md);
```

Guidelines:

- Reuse existing semantic tokens.
- Prefer meaningful names over raw color values.
- Keep primitive and semantic roles distinct.
- Do not create a new token for every isolated measurement.
- Do not duplicate values under multiple names without a clear reason.
- Do not introduce arbitrary colors, spacing, shadows, or radii when an existing token applies.
- Keep tokens centralized in their designated source.
- Preserve existing token names unless an intentional migration is required.

Design tokens are not an excuse to introduce unnecessary abstraction.

## 4. Declaration order

Group declarations consistently in this order:

1. Positioning
2. Display and layout
3. Sizing and spacing
4. Borders and backgrounds
5. Typography
6. Visual effects
7. Transitions and animations
8. Interaction properties

Example:

```css
.nuance-palette {
    position: relative;
    display: grid;
    width: 100%;
    max-width: var(--palette-max-width);
    gap: var(--gap-sm);
    padding: var(--gap-md);
    border-radius: var(--radius-lg);
    background-color: var(--color-bg-surface);
    transition: background-color 200ms ease;
}
```

Exact grouping matters less than maintaining consistency.

## 5. Component organization

Organize CSS by logical sections and components.

Suggested order:

1. Design tokens and themes
2. Base styles and resets
3. App shell and layout
4. Header and navigation
5. Color composition
6. Controls and buttons
7. Dialogs and overlays
8. Interaction states
9. Responsive adjustments
10. Accessibility and reduced motion

Keep a component's base rules and interaction states close together.

Use concise section comments where they improve navigation.

```css
/* ==========================================================================
   Color Composition
   ========================================================================== */

.nuance-composition {
    position: relative;
    width: 100%;
}

.nuance-composition__region {
    position: relative;
    min-width: 0;
    min-height: 0;
}
```

Avoid comments that merely repeat obvious CSS declarations.

## 6. Responsive CSS

- Use a small, consistent set of breakpoints.
- Prefer intrinsic layout, flexbox, and grid before introducing media queries.
- Keep breakpoints documented.
- Do not duplicate entire component rules across breakpoints.
- Avoid fixed pixel sizing where responsive behavior is required.
- Preserve accessible pointer and touch targets.

Use standard expanded formatting:

```css
@media (max-width: 768px) {
    .nuance-composition {
        width: 100%;
    }

    .nuance-header {
        padding-inline: var(--gap-md);
    }
}
```

## 7. Accessibility

Preserve visible keyboard focus indicators.

```css
.nuance-button:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 4px;
}
```

Respect reduced-motion settings.

```css
@media (prefers-reduced-motion: reduce) {
    .nuance-composition__region {
        transition: none;
    }
}
```

Do not remove focus outlines without providing an accessible replacement.

Do not rely exclusively on hover for important controls.

## 8. CSS architecture

Nuance uses React, TypeScript, Vite, and an existing token system.

- Prefer plain CSS for component styling.
- Preserve existing Tailwind integrations where already established.
- Do not mix several competing styling approaches within the same component.
- Do not introduce CSS-in-JS, styled-components, Sass, or another styling framework without a specific requirement.
- Avoid excessive specificity and `!important`.
- Use CSS custom properties for dynamic values where appropriate.
- Keep React responsible for state and interaction; keep CSS responsible for visual presentation.

## 9. Agent requirements

Every coding agent working on Nuance must:

1. Read this document before modifying CSS.
2. Inspect existing styles and tokens before adding new ones.
3. Follow expanded formatting in every new or modified rule.
4. Keep the diff focused.
5. Preserve rendered appearance unless visual changes are explicitly requested.
6. Avoid introducing unnecessary tokens, wrappers, or dependencies.
7. Run the available build and validation checks.
8. Report any intentional deviations from these conventions.

**Never prioritize reducing line count over code readability.**

## Guiding principle

Write CSS for the developer who will maintain it six months from now.

The goal is not the shortest stylesheet.

The goal is the clearest stylesheet.