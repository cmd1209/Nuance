# Form sizing studies

Form → Sizing retains the original three-point monotone cubic curve. The editor adds 1/2/4px output precision, 6–12 positive steps, movable horizontal knot positions, and proportional specimens in the token table. Zero is always a separate token. No scale is applied to Nuance's own interface, Spacing, or Design yet.

## Continuous curve and resolved tokens

`domain/sizing.ts` owns generation independently of React. Each configuration contains `maxSize`, `precision`, `steps`, three normalized vertical `points`, and their three normalized horizontal `positions`. The default is 128px, 1px, and 10 positive steps. Both endpoints remain fixed at (0,0) and (1,1).

The existing monotone cubic interpolation now weights tangents by the distances between knots, allowing horizontal movement without changing the curve family. Horizontal knots stay ordered with at least 0.04 normalized separation. Vertical values cannot cross their neighbors. Pointer capture and the initial grab offset preserve smooth mouse/touch movement; arrows adjust both axes, Shift increases the increment, and Home/End move to the adjacent vertical limits.

Quantization operates after sampling the continuous curve. Values round to the nearest precision unit, then clamp between the previous token plus one increment and the maximum minus the increments reserved for the remaining steps. The last value is exactly the configured maximum. This resolves collisions predictably without increasing the maximum or reducing precision. Flat curves can still produce strictly ascending output.

A feasible maximum is an integer multiple of precision, at least `steps × precision`, and at most 4096px. Incompatible step and precision choices are disabled. Invalid maximum edits show an inline error, retain the last valid output, and disable saving until corrected. Step and precision changes resample the same curve. Graph dots show resolved values; fine connector lines indicate the difference from the continuous curve. Bars use those identical resolved values.

## Persistence

`domain/formStudies.ts` defines a generic, versioned Form study envelope. Sizing documents contain:

- `schemaVersion: 1`, UUID, setting, and study name (1–80 characters).
- `generatorVersion: "monotone-cubic-v1"`.
- Source configuration in `values`.
- The exact generated `resolvedTokens`.

Readers validate the source, supported versions, and an exact reproduction of stored tokens. Loading creates independent arrays, so editing cannot mutate saved data. Other Form tools can reuse the envelope and account storage while adding their own generator readers.

`account/formStudyRepository.ts` and `useFormStudies.ts` load and mutate records independently of Color and Type. Owner and request-generation guards prevent late results from a previous account becoming visible. Failed writes refresh the library so a quota filled in another tab can offer replacement. Account changes clear the private draft. View and main-navigation changes retain working settings. Opening another saved study asks before replacing dirty work.

Saving opens a compact native dialog. An existing study updates its identity; “Save as a new study” allocates another slot. At three slots, the dialog requires an explicit replacement target and labels the action “Replace study.” Replacement updates the chosen record atomically. Saved cards support rename, delete, and miniature curve previews; no empty cards are generated. Reset restores the current study's loaded settings, or the initial curve for a new draft.

## Database deployment

Apply `supabase/migrations/202611230001_form_studies.sql` to enable live account persistence. It creates only the shared `form_studies` and private `form_study_quotas` tables, policies, indexes, and triggers. It does not change Color, Type, profiles, or existing records.

RLS restricts each record to its owner. Authenticated clients can update only the document; identities and component categories remain stable. A server-maintained counter locks each owner/component quota, enforcing three slots even for simultaneous inserts. Updates and replacements consume no additional slot. The migration is tested locally with PostgreSQL/PGlite; local tests do not deploy it remotely.

## Validation

`npm test` includes generation, collision/boundary constraints, nonuniform interpolation, step resampling, serialization, and database ownership/quota checks. Three unrelated existing palette discovery/reference tests currently fail.

For isolated browser checks, run a local Vite server on 127.0.0.1:5176, then:

```sh
NUANCE_PLAYWRIGHT_MODULE=/private/tmp/nuance-account-browser/node_modules/playwright/index.mjs node tests/sizing-browser.mjs
```

Use an installed Playwright module path if that temporary installation is absent. The suite intercepts every external account request and uses synthetic records. It verifies dragging, touch, keyboard, quantization, infeasible inputs, step counts, specimens, drafts, save/update/replacement/rename/delete/reload, failure recovery, themes, 1280/390/320px layouts, document scroll, bottom navigation, Color/Type draft preservation, and sign-out clearing. Screenshots are written to `/private/tmp/nuance-sizing-review`.
