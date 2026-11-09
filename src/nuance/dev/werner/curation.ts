import { candidateId, candidateSignature, stableHash, WERNER_GENERATION_VERSION, WERNER_METHODS, type ReviewStatus, type WernerBatch, type WernerCandidate } from "../../domain/werner-generation";
import { WERNER_COLORS, WERNER_DATASET_VERSION, WERNER_PROVENANCE } from "../../domain/werner";

export const WERNER_STORAGE_KEY = "nuance:dev:werner-curation:v1";
export interface CurationState {
  schemaVersion: 1;
  datasetVersion: typeof WERNER_DATASET_VERSION;
  generationVersion: typeof WERNER_GENERATION_VERSION;
  batches: WernerBatch[];
  candidates: WernerCandidate[];
}
const statuses: ReviewStatus[] = ["pending", "approved", "rejected"];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid curation document.");
  return value as Record<string, unknown>;
}
export function validateCuration(value: unknown): CurationState {
  const data = object(value);
  if (data.schemaVersion !== 1 || data.datasetVersion !== WERNER_DATASET_VERSION || data.generationVersion !== WERNER_GENERATION_VERSION || !Array.isArray(data.batches) || !Array.isArray(data.candidates)) throw new Error("Unsupported curation version. The stored document has been preserved.");
  const batches = new Map<string, WernerBatch>();
  for (const item of data.batches) {
    const batch = object(item), counts = object(batch.counts);
    if (typeof batch.seed !== "string" || !batch.seed.trim() || batch.seed.length > 100 || batch.datasetVersion !== WERNER_DATASET_VERSION || batch.generationVersion !== WERNER_GENERATION_VERSION || ![2,3,4].every(n => Number.isInteger(counts[n]) && Number(counts[n]) >= 0) || Number(counts[2]) + Number(counts[3]) + Number(counts[4]) > 500) throw new Error("Invalid generation batch.");
    const id = `werner-batch-${stableHash(JSON.stringify([WERNER_DATASET_VERSION, WERNER_GENERATION_VERSION, batch.seed, {2:counts[2],3:counts[3],4:counts[4]}]))}`;
    if (batch.id !== id || batches.has(id)) throw new Error("Duplicate or invalid batch identity.");
    batches.set(id, item as WernerBatch);
  }
  const ids = new Set<string>(), combinations = new Set<string>(), source = new Set(WERNER_COLORS.map(color => color.id));
  for (const item of data.candidates) {
    const candidate = object(item);
    const batch = batches.get(String(candidate.batchId));
    if (candidate.collection !== "werner" || candidate.source !== "werner-1821" || candidate.curation !== "nuance-generated" || candidate.generationVersion !== WERNER_GENERATION_VERSION || !batch || candidate.seed !== batch.seed || !WERNER_METHODS.includes(candidate.method as never) || !statuses.includes(candidate.status as ReviewStatus) || !Array.isArray(candidate.colorIds) || candidate.colorIds.length < 2 || candidate.colorIds.length > 4 || new Set(candidate.colorIds).size !== candidate.colorIds.length || !candidate.colorIds.every(id => source.has(id))) throw new Error("Invalid candidate or historical source reference.");
    const id = candidateId(batch.seed, candidate.colorIds), signature = candidateSignature(item);
    if (candidate.id !== id || ids.has(id) || combinations.has(signature)) throw new Error("Duplicate or invalid candidate identity.");
    ids.add(id); combinations.add(signature);
  }
  for (const batch of batches.values()) for (const count of [2,3,4] as const) {
    if (data.candidates.filter((candidate: WernerCandidate) => candidate.batchId === batch.id && candidate.colorIds.length === count).length !== batch.counts[count]) throw new Error("Batch candidate counts do not match their generation metadata.");
  }
  return data as unknown as CurationState;
}
export function initialCuration(result: { batch: WernerBatch; candidates: WernerCandidate[] }): CurationState {
  return validateCuration({ schemaVersion:1, datasetVersion:WERNER_DATASET_VERSION, generationVersion:WERNER_GENERATION_VERSION, batches:[result.batch], candidates:result.candidates });
}
export function reviewCandidate(state: CurationState, id: string, status: ReviewStatus): CurationState {
  if (!statuses.includes(status) || !state.candidates.some(candidate => candidate.id === id)) throw new Error("Unknown candidate or review status.");
  return { ...state, candidates:state.candidates.map(candidate => candidate.id === id ? {...candidate, status} : candidate) };
}
export function appendAlternatives(state: CurationState, result: { batch: WernerBatch; candidates: WernerCandidate[] }): CurationState {
  return validateCuration({ ...state, batches:[...state.batches, result.batch], candidates:[...state.candidates, ...result.candidates] });
}
export function mergeProgress(current: CurationState, incoming: CurationState): CurationState {
  const existing = new Map(current.candidates.map(candidate => [candidate.id, candidate]));
  // Explicit local decisions win conflicts; imported decisions can fill pending entries.
  const candidates = current.candidates.map(candidate => {
    const imported = incoming.candidates.find(item => item.id === candidate.id);
    return candidate.status === "pending" && imported ? imported : candidate;
  });
  candidates.push(...incoming.candidates.filter(candidate => !existing.has(candidate.id)));
  const batches = [...current.batches, ...incoming.batches.filter(batch => !current.batches.some(item => item.id === batch.id))];
  return validateCuration({ ...current, candidates, batches });
}
export function exportCuration(state: CurationState, approvedOnly = false): string {
  const candidates = approvedOnly ? state.candidates.filter(candidate => candidate.status === "approved") : state.candidates;
  const references = new Set(candidates.flatMap(candidate => candidate.colorIds));
  return JSON.stringify({
    format:"nuance-werner-curation", kind:approvedOnly ? "approved" : "progress", ...state, candidates,
    exportedAt:new Date().toISOString(), label:"Werner · Nuance", source:{...WERNER_PROVENANCE, colors:approvedOnly ? WERNER_COLORS.filter(color => references.has(color.id)) : WERNER_COLORS},
    reviewGroups:Object.fromEntries(statuses.map(status => [status, candidates.filter(candidate => candidate.status === status).map(candidate => candidate.id)])),
  }, null, 2);
}
export function importCuration(text: string): CurationState {
  const data = object(JSON.parse(text));
  if (data.format !== "nuance-werner-curation" || data.kind !== "progress" || object(data.source).normalizedSha256 !== WERNER_PROVENANCE.normalizedSha256 || JSON.stringify(object(data.source).colors) !== JSON.stringify(WERNER_COLORS)) throw new Error("Import a complete progress export from the same Werner source dataset. Approved-only exports are for Phase 2.");
  const state = validateCuration(data);
  return {schemaVersion:1, datasetVersion:state.datasetVersion, generationVersion:state.generationVersion, batches:state.batches, candidates:state.candidates};
}
