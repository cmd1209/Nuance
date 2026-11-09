import { generateWernerBatch, type WernerCandidate } from "../../domain/werner-generation";
self.onmessage = (event: MessageEvent<{ seed: string; existing: WernerCandidate[] }>) => {
  try { self.postMessage({ result:generateWernerBatch(event.data.seed, {2:10,3:20,4:10}, event.data.existing) }); }
  catch (error) { self.postMessage({ error:error instanceof Error ? error.message : "Alternative generation failed." }); }
};
