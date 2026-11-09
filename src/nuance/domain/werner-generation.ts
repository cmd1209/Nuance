import { hexToOklab, perceptualDistance } from "./extension";
import { WERNER_COLORS, WERNER_DATASET_VERSION } from "./werner";

export const WERNER_GENERATION_VERSION = "werner-oklab-v1" as const;
export const WERNER_METHODS = ["analogous", "complementary", "tonal", "expressive"] as const;
export type WernerMethod = typeof WERNER_METHODS[number];
export type ReviewStatus = "pending" | "approved" | "rejected";
export type CandidateCounts = Record<2 | 3 | 4, number>;
export const DEFAULT_WERNER_COUNTS: CandidateCounts = { 2: 50, 3: 100, 4: 50 };
export interface WernerCandidate {
  id: string;
  collection: "werner";
  source: "werner-1821";
  curation: "nuance-generated";
  method: WernerMethod;
  colorIds: string[];
  generationVersion: typeof WERNER_GENERATION_VERSION;
  seed: string;
  batchId: string;
  status: ReviewStatus;
}
export interface WernerBatch {
  id: string;
  datasetVersion: typeof WERNER_DATASET_VERSION;
  generationVersion: typeof WERNER_GENERATION_VERSION;
  seed: string;
  counts: CandidateCounts;
}
export function stableHash(text: string): string {
  let a = 2166136261, b = 2246822507;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909); }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
function randomSource(seed: string): () => number {
  let state = parseInt(stableHash(seed).slice(0, 8), 16);
  return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export const candidateSignature = (candidate: Pick<WernerCandidate, "colorIds">): string => [...candidate.colorIds].sort().join("|");
export function candidateId(seed: string, colorIds: string[]): string {
  return `werner-candidate-${stableHash(`${WERNER_GENERATION_VERSION}|${seed}|${colorIds.join("|")}`)}`;
}
const measured = WERNER_COLORS.map(color => {
  const lab = hexToOklab(color.hex);
  return { ...color, lab, c: Math.hypot(lab.a, lab.b), h: (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360 };
});
type Measured = typeof measured[number];
const byId = new Map(measured.map(color => [color.id, color]));
const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
function relations(colors: Measured[], method: WernerMethod): number {
  const chromatic = colors.filter(color => color.c > 0.035);
  const hues = chromatic.flatMap((a, i) => chromatic.slice(i + 1).map(b => hueDistance(a.h, b.h)));
  const hueSpan = hues.length ? Math.max(...hues) : 0;
  const lightSpan = spread(colors.map(color => color.lab.l)), chromaSpan = spread(colors.map(color => color.c));
  if (method === "analogous") {
    if (chromatic.length < 2 || hueSpan > 75 || lightSpan < 0.12) return -Infinity;
    return 0.7 * (1 - hueSpan / 100) + lightSpan * 0.8 + chromaSpan;
  }
  if (method === "complementary") {
    if (hueSpan < 130 || lightSpan < 0.12) return -Infinity;
    return hueSpan / 180 + lightSpan * 0.6 + (colors.length > chromatic.length ? 0.12 : 0);
  }
  if (method === "tonal") {
    if (hueSpan > 45 || lightSpan < 0.15 || Math.max(...colors.map(color => color.c)) > 0.13) return -Infinity;
    return (1 - hueSpan / 90) * 0.6 + lightSpan + (0.13 - Math.max(...colors.map(color => color.c)));
  }
  if (hueSpan < 65 || lightSpan < 0.2) return -Infinity;
  const warm = chromatic.some(color => color.h < 110 || color.h > 330);
  const cool = chromatic.some(color => color.h >= 110 && color.h <= 330);
  return hueSpan / 180 * 0.45 + lightSpan + chromaSpan * 1.4 + (warm && cool ? 0.15 : 0);
}
/** Set distance ignores order: similar permutations are not fresh alternatives. */
export function paletteDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length !== b.length) return Infinity;
  const directed = (from: readonly string[], to: readonly string[]) => Math.max(...from.map(id => Math.min(...to.map(other => perceptualDistance(byId.get(id)!.lab, byId.get(other)!.lab)))));
  return Math.max(directed(a, b), directed(b, a));
}
export function generateWernerBatch(seed: string, counts: CandidateCounts = DEFAULT_WERNER_COUNTS, existing: readonly WernerCandidate[] = []): { batch: WernerBatch; candidates: WernerCandidate[] } {
  if (!seed.trim() || seed.length > 100) throw new Error("Use a seed between 1 and 100 characters.");
  if (![2, 3, 4].every(n => Number.isInteger(counts[n as 2 | 3 | 4]) && counts[n as 2 | 3 | 4] >= 0) || Object.values(counts).reduce((a, b) => a + b, 0) > 500) throw new Error("A batch must contain at most 500 candidates with non-negative integer counts.");
  const canonicalCounts = { 2: counts[2], 3: counts[3], 4: counts[4] };
  const batchId = `werner-batch-${stableHash(JSON.stringify([WERNER_DATASET_VERSION, WERNER_GENERATION_VERSION, seed, canonicalCounts]))}`;
  const batch: WernerBatch = { id: batchId, datasetVersion: WERNER_DATASET_VERSION, generationVersion: WERNER_GENERATION_VERSION, seed, counts: canonicalCounts };
  const random = randomSource(batchId), candidates: WernerCandidate[] = [], signatures = new Set(existing.map(candidateSignature));
  const uses = new Map<string, number>(), familyUses = new Map<string, number>();
  for (const item of existing) for (const id of item.colorIds) {
    const color = byId.get(id);
    if (!color) throw new Error(`Unknown source color ${id}`);
    uses.set(id, (uses.get(id) ?? 0) + 1); familyUses.set(color.family, (familyUses.get(color.family) ?? 0) + 1);
  }
  const familySizes = new Map<string, number>();
  measured.forEach(color => familySizes.set(color.family, (familySizes.get(color.family) ?? 0) + 1));
  let slot = 0;
  for (const count of [2, 3, 4] as const) for (let index = 0; index < counts[count]; index++, slot++) {
    const method = WERNER_METHODS[slot % WERNER_METHODS.length];
    let best: { colors: Measured[]; score: number } | null = null;
    // Broad proposals, perceptual eligibility, then coverage and family penalties.
    // This is deterministic ranking of source colors, never generation of new HEXes.
    for (let attempt = 0; attempt < 650; attempt++) {
      const pool: Measured[] = [];
      for (let i = 0; i < count; i++) {
        const color = measured[Math.floor(random() * measured.length)];
        if (pool.some(other => other.id === color.id || perceptualDistance(color.lab, other.lab) < 0.065)) break;
        pool.push(color);
      }
      if (pool.length !== count || signatures.has(candidateSignature({ colorIds: pool.map(color => color.id) }))) continue;
      const quality = relations(pool, method);
      if (!Number.isFinite(quality)) continue;
      const ids = pool.map(color => color.id);
      if ([...existing, ...candidates].some(other => paletteDistance(ids, other.colorIds) < 0.04)) continue;
      const repetition = pool.reduce((total, color) => total + (uses.get(color.id) ?? 0), 0) / count;
      const familyRepetition = pool.reduce((total, color) => total + (familyUses.get(color.family) ?? 0) / Math.sqrt(familySizes.get(color.family)!), 0) / count;
      const score = quality - repetition * 0.08 - familyRepetition * 0.035 + random() * 0.12;
      if (!best || score > best.score) best = { colors: pool, score };
    }
    if (!best) throw new Error(`No distinct ${method} palette found for slot ${slot + 1}. Try a different seed or smaller batch.`);
    // Dominant preview region starts with the lightest source color, with stable ties.
    const colorIds = best.colors.sort((a, b) => b.lab.l - a.lab.l || a.number - b.number).map(color => color.id);
    const candidate: WernerCandidate = { id: candidateId(seed, colorIds), collection: "werner", source: "werner-1821", curation: "nuance-generated", method, colorIds, generationVersion: WERNER_GENERATION_VERSION, seed, batchId, status: "pending" };
    if ([...existing, ...candidates].some(other => other.id === candidate.id)) throw new Error("Candidate ID collision; choose a different seed.");
    candidates.push(candidate); signatures.add(candidateSignature(candidate));
    for (const color of best.colors) { uses.set(color.id, (uses.get(color.id) ?? 0) + 1); familyUses.set(color.family, (familyUses.get(color.family) ?? 0) + 1); }
  }
  return { batch, candidates };
}
