import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Offline import: audited snapshots are checked in; no network or floating dependency.
const directory = new URL('../src/nuance/data/werner/v1/', import.meta.url);
function csv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (quoted) throw new Error('Unclosed CSV field');
  const headers = rows.shift();
  return rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key, i) => [key, row[i] ?? ''])));
}
const snapshot = await readFile(new URL('upstream/c82-colors.csv', directory), 'utf8');
const table = await readFile(new URL('upstream/Werner.pm', directory), 'utf8');
const cc0 = Object.fromEntries([...table.matchAll(/(\w+)\s*=> 0x([0-9a-f]{6})/g)].map(match => [match[1], '#' + match[2].toUpperCase()]));
const families = { Whites:'white', Greys:'grey', Blacks:'black', Blues:'blue', Purples:'purple', Greens:'green', Yellows:'yellow', Oranges:'orange', Reds:'red', Browns:'brown' };
const rows = csv(snapshot);
if (rows.length !== 110 || Object.keys(cc0).length !== 110) throw new Error('Expected 110 source colors');
if (new Set(rows.map(row => row.Name.toLowerCase().replace(/[^a-z]/g, ''))).size !== 110) throw new Error('Duplicate historical color name');
const colors = rows.map((row, index) => {
  const number = Number(row.ID), key = row.Name.toLowerCase().replace(/[^a-z]/g, ''), hex = row.Hex.toUpperCase();
  if (number !== index + 1 || !families[row.Group] || !/^#[0-9A-F]{6}$/.test(hex) || cc0[key] !== hex) throw new Error(`Invalid or unmatched source row ${index + 1}`);
  return { id:`werner-${String(number).padStart(3,'0')}`, source:'werner-1821', number, name:row.Name, hex, family:families[row.Group],
    alias:row.Alias || null, characteristic:row['Characteristic color'] === '1',
    references:{animal:row.Animal || null, vegetable:row.Vegetable || null, mineral:row.Mineral || null} };
});
await writeFile(new URL('colors.json', directory), JSON.stringify(colors, null, 2) + '\n');
await writeFile(new URL('provenance.json', directory), JSON.stringify({
  datasetVersion:1, source:'werner-1821', edition:1821, title:"Werner’s Nomenclature of Colours", historicalAuthor:'Patrick Syme, after Abraham Gottlob Werner',
  digitizer:'Nicholas Rougeux', referenceURL:'https://www.c82.net/werner/',
  catalogURL:'https://docs.google.com/spreadsheets/d/10w7UebIDqN6ChEpBwLDQmAgVZZhLtKvnrLeNnBjJmsc/edit',
  hexTableAuthor:'Robert Rothenberg', hexTableLicense:'CC0-1.0',
  hexTableRevision:'854ecaa1997d3cc71b75b3324890ed6815241a77',
  hexTableURL:'https://github.com/robrwo/Graphics-ColorNames-Werner/tree/854ecaa1997d3cc71b75b3324890ed6815241a77',
  catalogSha256:createHash('sha256').update(snapshot).digest('hex'), hexTableSha256:createHash('sha256').update(table).digest('hex'),
  normalizedSha256:createHash('sha256').update(JSON.stringify(colors)).digest('hex'),
  importedOn:'2026-11-09', count:colors.length,
  limitation:'sRGB approximations of aged scanned swatches, not calibrated measurements of original pigments. Names, numbering, families and natural-history references transcribed from the 1821 catalog; historical spelling retained. No modern photographs imported.'
}, null, 2) + '\n');
console.log(`Validated ${colors.length} historical entries; every HEX matches the independent CC0 table.`);
