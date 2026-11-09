import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const value = (flag, fallback) => { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1]; };
const seed = value('--seed', 'werner-nuance-1821-01');
const output = resolve(value('--out', 'src/nuance/dev/werner/initial-batch.json'));
const directory = await mkdtemp(join(tmpdir(), 'nuance-werner-'));
try {
  const outfile = join(directory, 'generator.mjs');
  await build({entryPoints:['src/nuance/domain/werner-generation.ts'],bundle:true,platform:'node',format:'esm',outfile});
  const { generateWernerBatch } = await import(pathToFileURL(outfile).href);
  const start = performance.now();
  const result = generateWernerBatch(seed);
  // Never overwrite a curated or previously generated artifact.
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag:'wx' });
  console.log(`${result.candidates.length} candidates in ${Math.round(performance.now()-start)}ms → ${output}`);
} finally { await rm(directory, {recursive:true,force:true}); }
