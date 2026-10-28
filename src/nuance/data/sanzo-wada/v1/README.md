# Sanzo Wada dataset, Nuance v1

Vendored without changes from https://github.com/mattdesl/dictionary-of-colour-combinations
at commit `c142bd0bc8049ea48db4da5eb397981f047e8ef4`.

159 colors, 348 combinations numbered 1–348. Group `colors.json` by combination
number while traversing the source array in order; do not sort colors by hue,
name, or HEX. This is the order preserved by upstream, not a separate claim
about spatial placement in the printed book. Preserve upstream HEX values;
RGB/LAB/CMYK and swatch metadata remain available in the raw file.

Historical combinations compiled by Sanzo Wada, published by Seigensha Art.
Original digitization by Dain M. Blodorn Kim; corrected data and perceptual
CMYK conversion by Matt DesLauriers. See UPSTREAM-README.md and LICENSE.md.
The license is also shipped at /nuance/licenses/sanzo-wada.txt in built sites.

Normalization lives in domain/wada.ts. Generated extensions belong to editor
documents and are never written into this historical source.
