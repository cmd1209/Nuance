# Nuance typography specimens

Self-hosted Google Fonts from Fontsource packages pinned to 5.3.0. Each family has one normal Latin WOFF2 face and its original SIL OFL-1.1 license notice. DM Serif Display is static 400; the other seven files support variable weights.

These files are only used by the Types specimens; Nuance's interface stays in Clarity City. Exact upstream URLs, font/package versions, authorship, weight ranges and SHA-256 fingerprints are in `src/nuance/data/typefaces/v1/registry.json`. Original metadata snapshots are preserved alongside it.

Use `npm run fonts:verify` to verify the binaries, or `node scripts/vendor-typefaces.mjs --restore` to restore the pinned files from Fontsource. Full workflow: `docs/types-discovery.md`.
