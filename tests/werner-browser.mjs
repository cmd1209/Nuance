// Optional: use the same temporary Playwright setup as tests/shell-browser.mjs.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts=process.env.NUANCE_ARTIFACTS || '/private/tmp/nuance-werner-review';
const key='nuance:dev:werner-curation:v1';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce',acceptDownloads:true});
const errors=[], external=[];
await context.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin===new URL(base).origin || url.protocol==='blob:')return route.continue();
 external.push(url.origin);return route.fulfill({status:200,contentType:'application/json',body:'[]'});
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const gallery=page.locator('.werner-candidate');
const data=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function download(label,name) {
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();
 const item=await pending;const path=join(artifacts,name);await item.saveAs(path);return JSON.parse(await readFile(path,'utf8'));
}
try {
 await page.goto(`${base}/dev/werner-curation`);await gallery.nth(199).waitFor();
 assert.equal(await gallery.count(),200);assert.equal((await data()).candidates.length,200);assert.deepEqual(external,[]);
 const ids=await gallery.evaluateAll(items=>items.map(item=>item.dataset.candidateId));
 await page.getByLabel('Colors',{exact:true}).selectOption('2');assert.equal(await gallery.count(),50);
 await page.getByLabel('Method',{exact:true}).selectOption('analogous');assert.ok(await gallery.count()>0 && await gallery.count()<50);
 await page.getByLabel('Review',{exact:true}).selectOption('approved');assert.equal(await gallery.count(),0);
 await page.getByLabel('Colors',{exact:true}).selectOption('all');await page.getByLabel('Method',{exact:true}).selectOption('all');await page.getByLabel('Review',{exact:true}).selectOption('all');
 await page.evaluate(()=>localStorage.setItem('production-sentinel','unchanged'));
 await gallery.first().getByRole('button',{name:'Approve',exact:true}).click();
 await gallery.nth(1).getByRole('button',{name:'Reject',exact:true}).click();
 await page.getByText('1 approved / 200 candidates',{exact:true}).waitFor();
 await page.reload();await gallery.nth(199).waitFor();assert.deepEqual(await gallery.evaluateAll(items=>items.map(item=>item.dataset.candidateId)),ids);
 assert.equal((await data()).candidates[0].status,'approved');assert.equal((await data()).candidates[1].status,'rejected');
 await gallery.nth(1).getByRole('button',{name:'Pending',exact:true}).click();assert.equal((await data()).candidates[1].status,'pending');
 await gallery.nth(1).getByRole('button',{name:'Reject',exact:true}).click();
 const approved=await download('Export approved','approved.json');assert.equal(approved.candidates.length,1);assert.equal(approved.candidates[0].id,ids[0]);
 const progress=await download('Export progress','progress.json');assert.equal(progress.candidates.length,200);assert.equal(progress.source.colors.length,110);assert.equal(progress.reviewGroups.rejected.length,1);
 // Import restores a pending decision, while explicit local decisions win conflicts.
 await gallery.first().getByRole('button',{name:'Pending',exact:true}).click();
 await page.getByLabel('Import progress (merge)',{exact:true}).setInputFiles(join(artifacts,'progress.json'));
 await page.getByText('1 approved / 200 candidates',{exact:true}).waitFor();assert.equal((await data()).candidates[0].status,'approved');
 const seed=page.getByLabel('Alternative batch seed',{exact:true});await seed.fill('browser-alternatives-01');
 await page.getByRole('button',{name:'Generate 40 alternatives',exact:true}).click();
 await page.getByText('1 approved / 240 candidates',{exact:true}).waitFor({timeout:30000});
 const expanded=await data();assert.equal(expanded.candidates.length,240);assert.equal(expanded.candidates[0].status,'approved');assert.equal(expanded.candidates[1].status,'rejected');
 assert.equal(new Set(expanded.candidates.map(c=>[...c.colorIds].sort().join('|'))).size,240);
 assert.equal(await page.evaluate(()=>localStorage.getItem('production-sentinel')),'unchanged');
 assert.equal(await page.getByRole('button',{name:'Generate 40 alternatives',exact:true}).isDisabled(),true);
 console.log('PASS gallery, filters, reversible persisted reviews, export/import, worker alternatives and production-storage isolation');
 // A second tab must not overwrite newer decisions from the first tab.
 const other=await context.newPage();await other.goto(`${base}/dev/werner-curation`);await other.locator('.werner-candidate').nth(239).waitFor();
 await gallery.nth(2).getByRole('button',{name:'Approve',exact:true}).click();
 await other.locator('.werner-candidate').nth(2).getByRole('button',{name:'Reject',exact:true}).click();
 await other.getByRole('alert').filter({hasText:'Progress changed in another tab'}).waitFor();
 assert.equal((await data()).candidates[2].status,'approved');await other.close();
 // A failed write cannot turn an unsaved review into a displayed success.
 await page.evaluate(key=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return window.originalSet.call(this,k,v);};},key);
 await gallery.first().getByRole('button',{name:'Pending',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Review not saved'}).waitFor();assert.equal((await data()).candidates[0].status,'approved');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});await page.reload();await gallery.nth(239).waitFor();
 console.log('PASS cross-tab conflict and storage failure preserve existing approvals');
 for(const width of [1280,390,320])for(const theme of ['dark','light']) {
  await page.setViewportSize({width,height:844});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} theme`,exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('.nuance-navigation').evaluate(el=>getComputedStyle(el).position),'fixed');
  const nested=await page.locator('.nuance-main').evaluate(el=>[el,...el.querySelectorAll('*')].filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+2).length);assert.equal(nested,0);
  await page.screenshot({path:join(artifacts,`studio-${width}-${theme}.png`)});
 }
 console.log('PASS both themes, desktop/mobile grid, document scroll and fixed exports');
 // Malformed storage is never automatically reset. A raw backup remains downloadable.
 const recovery=await browser.newContext();await recovery.addInitScript(key=>localStorage.setItem(key,'{broken-progress'),key);
 const damaged=await recovery.newPage();await damaged.goto(`${base}/dev/werner-curation`);
 await damaged.getByRole('alert').waitFor();assert.equal(await damaged.locator('.werner-candidate').count(),0);
 assert.equal(await damaged.evaluate(key=>localStorage.getItem(key),key),'{broken-progress');
 assert.equal(await damaged.getByRole('button',{name:'Download stored backup',exact:true}).isVisible(),true);
 await damaged.getByLabel('Import progress (merge)',{exact:true}).setInputFiles(join(artifacts,'progress.json'));
 await damaged.locator('.werner-candidate').nth(199).waitFor();await recovery.close();
 assert.deepEqual(errors,[]);console.log('PASS corrupt-data recovery without overwriting, and no browser exceptions');
 // Production artifacts must not contain the generation engine, worker, or curation UI. Approved source data is now published.
 for(const name of await readdir('dist/assets')) {
  if(!/\.(js|css)$/.test(name))continue;
  const contents=await readFile(join('dist/assets',name),'utf8');
  assert.ok(!/werner-studio__gallery|nuance:dev:werner-curation|No distinct /.test(contents),name);
 }
 console.log('PASS production artifacts exclude generation, worker, curation state and styles; approved catalog is allowed');
 if(process.env.NUANCE_PRODUCTION_URL) {
  const production=await browser.newContext(), origin=new URL(process.env.NUANCE_PRODUCTION_URL).origin;
  await production.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const target=await production.newPage();
  await target.goto(`${origin}/dev/werner-curation`);await target.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
  assert.equal(await target.locator('.werner-studio').count(),0);
  assert.equal(await target.evaluate(key=>localStorage.getItem(key),key),null);
  await target.goto(origin);await target.getByRole('heading',{name:'Color',exact:true}).waitFor();
  assert.equal(await target.locator('.palette-slider [data-composition-id^="werner-nuance-"]').count(),30);
  assert.equal(await target.locator('.palette-slider [data-composition-id^="sanzo-wada-"]').count(),30);
  await target.locator('.palette-slider [data-composition-id^="werner-nuance-"]').first().click();
  await target.getByRole('button',{name:'Reset composition',exact:true}).waitFor();
  assert.match(await target.locator('.artwork-anchor .composition-source__name').textContent(),/Werner · Nuance No\./);
  await production.close();console.log('PASS production studio route unavailable; unified 30/30 Explore and Werner editing work in production');
 }
 await rm(join(artifacts,'failure.png'),{force:true});
} catch(error) {await page.screenshot({path:join(artifacts,'failure.png')});throw error;}
finally {await browser.close();}
