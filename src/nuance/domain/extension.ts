import type { Composition } from "./composition";

export type Lab = { l: number; a: number; b: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const radians = (h: number) => h * Math.PI / 180;
const hue = (c: Lab) => (Math.atan2(c.b, c.a) * 180 / Math.PI + 360) % 360;
const chroma = (c: Lab) => Math.hypot(c.a, c.b);
const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// Björn Ottosson's OKLab transforms: https://bottosson.github.io/posts/oklab/
// Work in linear sRGB before applying the perceptual transform.
export function hexToOklab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return { l: 0.2104542553*l + 0.793617785*m - 0.0040720468*s,
    a: 1.9779984951*l - 2.428592205*m + 0.4505937099*s,
    b: 0.0259040371*l + 0.7827717662*m - 0.808675766*s };
}
export function perceptualDistance(a: Lab, b: Lab): number {
  return Math.hypot(a.l-b.l, a.a-b.a, a.b-b.b);
}
function linearRgb(l: number, c: number, h: number): number[] {
  const a = c * Math.cos(radians(h)), b = c * Math.sin(radians(h));
  const ll = (l + 0.3963377774*a + 0.2158037573*b) ** 3;
  const mm = (l - 0.1055613458*a - 0.0638541728*b) ** 3;
  const ss = (l - 0.0894841775*a - 1.291485548*b) ** 3;
  return [4.0767416621*ll - 3.3077115913*mm + 0.2309699292*ss,
    -1.2684380046*ll + 2.6097574011*mm - 0.3413193965*ss,
    -0.0041960863*ll - 0.7034186147*mm + 1.707614701*ss];
}
/** Reduce chroma at fixed lightness/hue rather than clipping RGB and changing character. */
export function oklchToHex(l: number, c: number, h: number): string {
  l = clamp(l, 0.08, 0.96);
  let lo = 0, hi = Math.max(0, c);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (linearRgb(l, mid, h).every(v => v >= 0 && v <= 1)) lo = mid; else hi = mid;
  }
  return '#' + linearRgb(l, lo, h).map(v => {
    const encoded = v <= 0.0031308 ? 12.92*v : 1.055*v**(1/2.4)-0.055;
    return Math.round(clamp(encoded, 0, 1)*255).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}
function seeded(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { state = Math.imul(state ^ state >>> 15, 1 | state); state ^= state + Math.imul(state ^ state >>> 7, 61 | state); return ((state ^ state >>> 14) >>> 0) / 4294967296; };
}
export type ExtensionStrategy = "tonal" | "complementary" | "analogous" | "neutral" | "intermediate";
export function suggestExtension(composition: Composition, onlyStrategy?: ExtensionStrategy): { hex: string; strategy: ExtensionStrategy } {
  const labs = composition.colors.map(c => hexToOklab(c.hex));
  const paletteId = composition.historical?.paletteId ?? composition.id;
  const random = seeded(`${paletteId}:${composition.extensionIndex ?? composition.colors.length}`);
  const meanL = labs.reduce((s,c) => s+c.l,0)/labs.length;
  const meanC = labs.reduce((s,c) => s+chroma(c),0)/labs.length;
  const maxC = Math.max(...labs.map(chroma));
  const warmFraction = labs.filter(c => hue(c) < 110 || hue(c) > 330).length/labs.length;
  const lightSpread = Math.max(...labs.map(c=>c.l))-Math.min(...labs.map(c=>c.l));
  const strategies: ExtensionStrategy[] = onlyStrategy ? [onlyStrategy] : ["tonal", "complementary", "analogous", "neutral", "intermediate"];
  const preference = Math.floor(random()*strategies.length);
  let best = { hex: "#808080", strategy: "neutral" as ExtensionStrategy, score: -Infinity };
  // Compare 150 structured candidates. Seed affects anchors, hue offsets and tie-breaking;
  // current edited colors drive every measurement. Muted inputs cap candidate chroma.
  for (let i = 0; i < 150; i++) {
    const strategy = strategies[i % strategies.length];
    const anchor = labs[Math.floor(random()*labs.length)], other = labs[Math.floor(random()*labs.length)];
    let h = hue(anchor), c = clamp(meanC*(0.65+random()*0.45), 0.008, Math.max(0.018,maxC*0.95));
    let l = clamp(meanL+(random()-0.5)*0.62,0.16,0.91);
    if (strategy === "tonal") { l = clamp(anchor.l+(random()<0.5 ? -1 : 1)*(0.16+random()*0.18),0.16,0.91); c = chroma(anchor)*0.8; }
    if (strategy === "complementary") { h += 160+random()*40; c *= 0.7; }
    if (strategy === "analogous") h += (random()<0.5 ? -1 : 1)*(20+random()*30);
    if (strategy === "neutral") { l = random()<0.5 ? 0.18+random()*0.15 : 0.81+random()*0.12; c = Math.min(0.025,meanC*0.22); }
    if (strategy === "intermediate") h += (((hue(other)-h+540)%360)-180)*0.5;
    const hex = oklchToHex(l,c,h), lab = hexToOklab(hex), actualC = chroma(lab);
    const distances = labs.map(existing=>perceptualDistance(lab,existing));
    const nearest = Math.min(...distances);
    if (nearest < 0.065 || composition.colors.some(color=>color.hex.toUpperCase()===hex)) continue;
    const hueAffinity = Math.min(...labs.filter(v=>chroma(v)>0.02).map(v=>hueDistance(h,hue(v))));
    const lightGap = Math.min(...labs.map(v=>Math.abs(v.l-lab.l)));
    const warm = (h % 360 + 360)%360 < 110 || (h % 360 + 360)%360 > 330;
    // Reward useful perceptual spacing without maximizing novelty. Modest hue and
    // chroma penalties keep the source character; a temperature counterpoint is optional.
    const score = Math.min(nearest,0.24)*3 + Math.min(lightGap,0.2)*(lightSpread<0.3 ? 0.7 : 0.25)
      - Math.abs(actualC-meanC)*0.5 - Math.max(0,actualC-maxC)*2
      + (Number.isFinite(hueAffinity) ? (1-hueAffinity/180)*0.04 : 0)
      + ((warm && warmFraction<0.34) || (!warm && warmFraction>0.66) ? 0.025 : 0)
      + (i%strategies.length===preference ? 0.035 : 0) + random()*0.012;
    if (score>best.score) best = { hex, strategy, score };
  }
  // Dense edited palettes can exhaust a preferred strategy. Choose a supporting
  // neutral at the largest perceptual gap rather than returning an arbitrary HEX.
  if (!Number.isFinite(best.score)) {
    for (let i = 0; i <= 100; i++) {
      const hex = oklchToHex(0.08 + i * 0.0088, Math.min(meanC*0.15,0.02), hue(labs[0]));
      const score = Math.min(...labs.map(c=>perceptualDistance(hexToOklab(hex),c)));
      if (score > best.score) best = { hex, strategy: "neutral", score };
    }
  }
  return { hex: best.hex, strategy: best.strategy };
}
export const nextColor = (composition: Composition): string => suggestExtension(composition).hex;
