// Local-only browser validation. All external account traffic is intercepted.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts = '/private/tmp/nuance-sizing-review';
await mkdir(artifacts, { recursive: true });
const env = await readFile('.env.local', 'utf8');
const project = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).hostname.split('.')[0];
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'sizing@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Sizing Test' }, identities: [], created_at: new Date().toISOString() };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
const browser = await chromium.launch({ executablePath: process.env.NUANCE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let library = [], colorWrites = 0, typeWrites = 0, failSave = false;
await page.addInitScript(({ project, token, user }) => {
  if (!localStorage.getItem('sizing-test-signed-out')) localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
}, { project, token, user });
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === new URL(base).origin) return route.continue();
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith('/user')) return reply(user);
  if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith('/profiles')) return reply([{ id: user.id, display_name: 'Sizing Test' }]);
  if (url.pathname.endsWith('/compositions')) { if (request.method() !== 'GET') colorWrites++; return reply([]); }
  if (url.pathname.endsWith('/typeface_favorites')) { if (request.method() !== 'GET') typeWrites++; return reply([]); }
  if (url.pathname.endsWith('/form_studies')) {
    if (request.method() === 'GET') return reply(library);
    if (failSave) { failSave = false; return reply({ message: 'Temporary Form save failure' }, 500); }
    const id = url.searchParams.get('id')?.slice(3);
    assert.equal(request.headers().authorization, `Bearer ${token}`);
    if (request.method() === 'DELETE') { library = library.filter(row => row.id !== id); return reply({}); }
    const body = request.postDataJSON();
    if (request.method() === 'POST') {
      assert.equal(body.owner_id, user.id);
      if (library.length === 3) return reply({ message: 'All three slots are in use.' }, 400);
      const row = { ...body, updated_at: new Date().toISOString() }; library.unshift(row); return reply(row);
    }
    assert.equal(request.method(), 'PATCH');
    const row = library.find(row => row.id === id);
    assert.ok(row, 'updates target an existing record');
    row.document = body.document; row.updated_at = new Date().toISOString(); return reply(row);
  }
  return reply({ statusCode: '404', message: 'Not found' }, 404);
});
const nav = page.getByRole('navigation', { name: 'Design exploration' });
const enterForm = () => nav.getByRole('button', { name: 'Form', exact: true }).click();
const values = () => page.locator('.sizing-editor__tokens tbody tr').evaluateAll(rows => rows.map(row => Number(row.children[1].textContent.replace('px', ''))));
const curve = () => page.locator('.sizing-editor__curve').getAttribute('d');
const saveAction = () => page.getByRole('button', { name: 'Save sizing study', exact: true });
async function save(name, asNew = false, replace) {
  await saveAction().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  if (asNew) await dialog.getByLabel('Save as a new study').check();
  if (replace) await dialog.getByLabel('Study to replace').selectOption(replace);
  await dialog.getByRole('button', { name: replace ? 'Replace study' : asNew || !library.length ? 'Save study' : 'Update study', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}
async function layout() {
  const state = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
    nav: getComputedStyle(document.querySelector('.nuance-navigation')).position,
    nested: [...document.querySelectorAll('.nuance-main, .nuance-main *')].filter(el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2).length }));
  assert.ok(state.scroll <= state.width + 1); assert.equal(state.nav, 'fixed'); assert.equal(state.nested, 0);
}
try {
  await page.goto(base); await enterForm();
  assert.equal(await page.locator('#form-explore-panel .form-grid').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 3);
  await page.getByRole('button', { name: 'Sizing', exact: true }).click();
  await saveAction().waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[aria-label="Save sizing study"]').disabled);
  const initial = await values(), initialCurve = await curve();
  assert.equal(initial.length, 11); assert.equal(initial[0], 0); assert.equal(initial.at(-1), 128);
  await page.getByRole('button', { name: '4px', exact: true }).click();
  const snapped = await values(); assert.ok(snapped.every(v => v % 4 === 0));
  assert.ok(snapped.every((v, i) => !i || v > snapped[i - 1])); assert.equal(await curve(), initialCurve);
  await page.getByLabel('Steps', { exact: true }).selectOption('12');
  assert.equal((await values()).length, 13); assert.equal(await curve(), initialCurve);
  await page.getByLabel('Max size', { exact: true }).fill('130');
  assert.equal(await saveAction().isDisabled(), true); await page.getByRole('alert').waitFor();
  assert.equal((await values()).at(-1), 128);
  await page.getByRole('button', { name: 'Reset sizing study', exact: true }).click();
  assert.deepEqual(await values(), initial); assert.equal(await page.getByLabel('Max size', { exact: true }).inputValue(), '128');
  await page.getByLabel('Max size', { exact: true }).fill('10');
  assert.equal(await page.getByRole('button', { name: '2px', exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('Steps', { exact: true }).locator('option[value="12"]').isDisabled(), true);
  await page.getByRole('button', { name: 'Reset sizing study', exact: true }).click();
  const handle = page.getByRole('slider', { name: 'Curve point 2', exact: true });
  await handle.scrollIntoViewIfNeeded();
  let bounds = await handle.boundingBox();
  const startStyle = await handle.getAttribute('style');
  await page.mouse.move(bounds.x + bounds.width / 2 + 8, bounds.y + bounds.height / 2);
  await page.mouse.down();
  assert.equal(await handle.getAttribute('style'), startStyle, 'grabbing away from the center causes no jump');
  assert.equal(await handle.evaluate(el => getComputedStyle(el).cursor), 'grabbing');
  await page.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2 - 35, { steps: 16 });
  await page.mouse.up();
  assert.notEqual(await curve(), initialCurve);
  assert.equal(await page.locator('.sizing-editor__point.is-active').count(), 0);
  const beforeKeyboard = await handle.getAttribute('style'); await handle.press('ArrowRight');
  assert.notEqual(await handle.getAttribute('style'), beforeKeyboard);
  await handle.press('Shift+ArrowUp');
  const edited = await values();
  const specimen = await page.locator('.sizing-editor__specimen').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.width)));
  edited.forEach((v, i) => assert.ok(Math.abs(specimen[i] - v / 128 * 100) < 0.001));
  await page.getByRole('tab', { name: 'Explore', exact: true }).click();
  await page.getByRole('tab', { name: 'Edit', exact: true }).click(); assert.deepEqual(await values(), edited);
  await save('Study one'); const firstId = library[0].id, firstDocument = structuredClone(library[0].document);
  await handle.press('ArrowUp'); await save('Study one updated');
  assert.equal(library.length, 1); assert.equal(library[0].id, firstId);
  await save('Study two', true); await save('Study three', true); assert.equal(library.length, 3);
  await saveAction().click(); let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Save as a new study').check();
  assert.equal(await dialog.getByRole('button', { name: 'Replace study', exact: true }).isDisabled(), true);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await save('Replacement', true, firstId); assert.equal(library.length, 3);
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  assert.equal(await page.locator('#form-saved-panel .form-study-card').count(), 3);
  assert.equal(await page.locator('#form-saved-panel .form-study-preview path').count(), 3);
  await page.getByRole('button', { name: 'Rename Replacement', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByLabel('Name', { exact: true }).fill('Renamed');
  await dialog.getByRole('button', { name: 'Rename study', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  const persisted = structuredClone(library.find(row => row.id === firstId).document);
  await page.reload(); await enterForm(); await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Renamed', exact: true }).click();
  assert.deepEqual(await values(), persisted.resolvedTokens.map(token => token.value));
  assert.equal(await page.getByLabel('Steps', { exact: true }).inputValue(), String(persisted.values.steps));
  const loadedCurve = await curve(); await handle.press('ArrowUp');
  await page.getByRole('button', { name: 'Reset sizing study', exact: true }).click(); assert.equal(await curve(), loadedCurve);
  failSave = true; await saveAction().click(); dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Update study', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.ok((await dialog.getByRole('alert').textContent()).includes('Temporary'));
  await dialog.getByRole('button', { name: 'Update study', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      const current = await page.locator('.nuance-app').getAttribute('data-theme');
      if (current !== theme) await page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }).click();
      await layout(); await page.screenshot({ path: `${artifacts}/${width}-${theme}.png`, fullPage: true });
    }
  }
  // A touch pointer uses the same captured drag path and releases cleanly.
  const cdp = await context.newCDPSession(page); await handle.scrollIntoViewIfNeeded(); bounds = await handle.boundingBox();
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const beforeTouch = await curve();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 12, y: y - 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(await curve(), beforeTouch); assert.equal(await page.locator('.sizing-editor__point.is-active').count(), 0);
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Delete Renamed', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('#form-saved-panel .form-study-card').length === 2);
  assert.equal(library.length, 2);
  await nav.getByRole('button', { name: 'Color', exact: true }).click();
  await page.locator('.palette-card').first().click();
  await page.locator('.color-region__select').first().click();
  await page.getByLabel('HEX', { exact: true }).fill('#123456');
  await page.getByRole('button', { name: 'Close color editor', exact: true }).click();
  const colorState = await page.locator('.color-region').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.colorId, hex: node.dataset.hex })));
  await nav.getByRole('button', { name: 'Type', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Inter', exact: true }).click();
  const typeText = await page.locator('.type-detail .type-specimen__quote-text').textContent();
  await enterForm(); await layout();
  await nav.getByRole('button', { name: 'Color', exact: true }).click();
  assert.deepEqual(await page.locator('.color-region').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.colorId, hex: node.dataset.hex }))), colorState);
  await nav.getByRole('button', { name: 'Type', exact: true }).click();
  assert.equal(await page.locator('.type-detail .type-specimen__quote-text').textContent(), typeText);
  assert.equal(colorWrites, 0); assert.equal(typeWrites, 0);
  await enterForm();
  await page.getByRole('button', { name: 'Open account for Sizing Test', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Log in', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await enterForm();
  assert.equal(await page.locator('#form-edit-tab').count(), 0, 'sign-out clears the private sizing draft');
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  assert.equal(await page.locator('#form-saved-panel .form-study-card').count(), 0);
  await page.getByRole('tab', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Sizing', exact: true }).click();
  assert.deepEqual(await values(), initial);
  await saveAction().click(); await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.notDeepEqual(firstDocument.values, persisted.values);
  assert.deepEqual(errors, []);
  console.log('PASS sizing precision, infeasible controls, steps, mouse/touch/keyboard, drafts, specimens, save/update/replace/rename/delete/reload, both themes, 1280/390/320px, document scroll, fixed navigation, isolated Color/Type accounts');
} finally { await browser.close(); }
