# Nuance typography specimens

Self-hosted Google Fonts from Fontsource packages pinned to 5.3.0. The 30 families preserve their original SIL OFL-1.1 license notices. Variable families use one normal Latin WOFF2 file covering all supported weights. Static families include a separate normal Latin file for each supported weight, loaded only when selected. The library contains 52 WOFF2 files (1,474,100 bytes).

These files are only used by the Types specimens; Nuance's interface stays in Clarity City. Exact upstream URLs, font/package versions, authorship, weight ranges and SHA-256 fingerprints are in `src/nuance/data/typefaces/v1/registry.json`. Original metadata snapshots are preserved alongside it.

Use `npm run fonts:verify` to verify the binaries, or `node scripts/vendor-typefaces.mjs --restore` to restore the pinned files from Fontsource. Full workflow: `docs/types-discovery.md`.
