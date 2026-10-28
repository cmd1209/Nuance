import { createComposition, type Composition } from "./composition";

/** Exact solid fills from the three Figma preset compositions. */
export const PRESET_HEXES = [
  ["#196AAC", "#CDC5B4", "#B59DA4"],
  ["#8A19AC", "#97752E", "#D22F5E"],
  ["#9EAC19", "#612CAD", "#DA861E"],
];
export const initialPalettes = () => PRESET_HEXES.map((colors, i) => createComposition(colors, `Color study ${i + 1}`, `preset-${i + 1}`));

function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
function distance(a: string, b: string) {
  return Math.sqrt([1, 3, 5].reduce((sum, i) => sum + (parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) ** 2, 0));
}
export function generatePalettes(previous: Composition[], random = Math.random): Composition[] {
  const base = random() * 360;
  return [0, 1, 2].map(index => {
    let colors: string[] = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      const hue = (base + index * 113 + attempt * 47) % 360;
      // A strong anchor, a quieter counterpoint, and a contrasting accent.
      colors = [hslToHex(hue, 48 + random() * 28, 34 + random() * 15), hslToHex((hue + 145) % 360, 15 + random() * 25, 68 + random() * 15), hslToHex((hue + 205) % 360, 48 + random() * 30, 43 + random() * 18)];
      if (colors.every((c, i) => colors.every((d, j) => i === j || distance(c, d) > 70)) && previous.every(p => p.colors.slice(0, 3).reduce((sum, c, i) => sum + distance(c.hex, colors[i]), 0) > 150)) break;
    }
    return createComposition(colors, `Color study ${index + 1}`);
  });
}

export function nextColor(composition: Composition) {
  const suggestions = generatePalettes([composition]);
  return suggestions.flatMap(p => p.colors).find(c => composition.colors.every(existing => distance(c.hex, existing.hex) > 75))?.hex || "#7DA8A0";
}
