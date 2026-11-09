// Optional browser suite. See docs/application-shell.md for temporary tooling setup.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts = process.env.NUANCE_ARTIFACTS || '/private/tmp/nuance-shell-review';
const temporary = await mkdtemp(join(tmpdir(), 'nuance-browser-'));
await mkdir(artifacts, { recursive: true });
await build({ stdin: { contents: `export * from './src/nuance/domain/composition'; export * from './src/nuance/domain/wada'; export * from './src/nuance/domain/layout'; export * from './src/nuance/export/png';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: join(temporary, 'fixtures.mjs') });
const domain = await import(pathToFileURL(join(temporary, 'fixtures.mjs')).href);
const { cloneComposition, historicalComposition, editorComposition, WADA_PALETTES, addColor } = domain;
const threeSource = WADA_PALETTES.find(p => p.originalColorCount === 3);
const two = cloneComposition(historicalComposition(WADA_PALETTES.find(p => p.originalColorCount === 2)));
const three = editorComposition(cloneComposition(historicalComposition(threeSource)));
const four = editorComposition(cloneComposition(historicalComposition(WADA_PALETTES.find(p => p.originalColorCount === 4))));
let six = editorComposition(cloneComposition(historicalComposition(threeSource)));
for (const hex of ['#112233', '#445566', '#778899']) six = addColor(six, hex);
const fixtures = [two, three, four, six, ...[two, three, four, six].map(cloneComposition)];
let env = '';
try { env = await readFile('.env.local', 'utf8'); } catch { /* CI may configure Vite through the environment. */ }
const supabaseURL = process.env.VITE_SUPABASE_URL || env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
assert.ok(supabaseURL, 'Configure Vite with a Supabase URL; all API requests are mocked by this suite.');
const project = new URL(supabaseURL).hostname.split('.')[0];
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'Test' }, identities: [], created_at: new Date().toISOString() };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
const executablePath = process.env.NUANCE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
page.setDefaultTimeout(10000);
const exceptions = [], reports = [];
page.on('pageerror', error => exceptions.push(error.message));
let profile = { id: user.id, display_name: 'Test' }, saved = [], posts = 0, failDelete = false;
const records = count => fixtures.slice(0, count).map(composition => ({ id: composition.id, owner_id: user.id, document: structuredClone(composition), updated_at: new Date().toISOString() }));
await page.addInitScript(({ project, token, user }) => !localStorage.getItem('nuance-test-signed-out') && localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })), { project, token, user });
await page.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === new URL(baseURL).origin) return route.continue();
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith('/user')) return reply(user);
  if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith('/typeface_favorites')) return reply([]);
  if (url.pathname.endsWith('/profiles')) {
    if (request.method() === 'POST') { profile = request.postDataJSON(); return reply(profile); }
    return reply([profile]);
  }
  if (url.pathname.endsWith('/compositions')) {
    if (request.method() === 'POST') {
      posts++;
      const record = { ...request.postDataJSON(), updated_at: new Date().toISOString() };
      assert.equal(record.owner_id, user.id);
      if (saved.length >= 8 && !saved.some(item => item.id === record.id)) return reply({ message: 'You can save up to eight compositions.' }, 400);
      saved = [record, ...saved.filter(item => item.id !== record.id)];
      return reply(record);
    }
    if (request.method() === 'DELETE') {
      if (failDelete) { failDelete = false; return reply({ message: 'Temporary delete failure' }, 500); }
      assert.equal(url.searchParams.get('owner_id'), `eq.${user.id}`);
      const id = url.searchParams.get('id').slice(3);
      saved = saved.filter(item => item.id !== id);
      return reply({ id });
    }
    return reply(saved);
  }
  return route.abort();
});
async function load(count = 0) {
  saved = records(count);
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Open your profile' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function selectView(name) {
  await page.getByRole('tab', { name, exact: true }).click();
  if (name === 'Saved') await page.locator('.section-layout:not([hidden])').getByText(`${saved.length} / 8 saved`, { exact: true }).waitFor();
}
async function theme(value) {
  if (await page.locator('.nuance-app').getAttribute('data-theme') !== value)
    await page.getByRole('button', { name: `Switch to ${value} theme` }).click();
}
async function scrollEnd() {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
async function layout(label) {
  const result = await page.evaluate(() => {
    const root = document.documentElement, nav = document.querySelector('.nuance-navigation');
    const navStyle = getComputedStyle(nav), box = nav.getBoundingClientRect();
    const content = document.querySelector('.section-layout:not([hidden]) .section-layout__content').getBoundingClientRect();
    const description = document.querySelector('.section-layout:not([hidden]) .section-layout__description').getBoundingClientRect();
    const verticalScrollers = [...document.querySelectorAll('.nuance-app *')].filter(element => {
      const style = getComputedStyle(element);
      return /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1 && !element.closest('dialog');
    }).map(element => element.className);
    return { scrollingElement: document.scrollingElement.tagName, width: root.clientWidth, scrollWidth: root.scrollWidth, navPosition: navStyle.position,
      navBottom: box.bottom, navHeight: box.height, navWidth: box.width, navCenter: box.x + box.width / 2,
      sectionLeft: document.querySelector('.section-layout:not([hidden])').getBoundingClientRect().left,
      viewport: innerHeight, scrollers: verticalScrollers, contentGap: content.top - description.bottom,
      appHeight: document.querySelector('.nuance-app').getBoundingClientRect().height,
      sectionHeight: document.querySelector('.section-layout:not([hidden])').getBoundingClientRect().height,
      mainPadding: parseFloat(getComputedStyle(document.querySelector('.nuance-main')).paddingBottom),
      scrollY, headerTop: document.querySelector('.nuance-header').getBoundingClientRect().top,
      lastContentBottom: content.bottom,
      navButtons: [...nav.querySelectorAll('button')].map(button => {const r=button.getBoundingClientRect();return { left:r.left,right:r.right };}) };
  });
  assert.equal(result.scrollingElement, 'HTML', label);
  assert.ok(result.scrollWidth <= result.width + 1, `${label}: horizontal overflow`);
  assert.equal(result.navPosition, 'fixed', label);
  assert.ok(Math.abs(result.navBottom - (result.viewport - 24)) < 1, `${label}: navigation offset`);
  assert.ok(Math.abs(result.navCenter - result.width / 2) < 1, `${label}: navigation centering`);
  assert.deepEqual(result.scrollers, [], `${label}: nested vertical scrollers`);
  assert.ok(result.contentGap >= 23 && result.contentGap <= 33, `${label}: content rhythm`);
  assert.ok(result.appHeight >= result.viewport, `${label}: shell fills viewport`);
  assert.ok(result.mainPadding >= result.navHeight + 24, `${label}: central clearance`);
  assert.ok(result.navButtons.every(button => button.left >= 0 && button.right <= result.width + 1), `${label}: clipped navigation`);
  reports.push({ label, ...result });
  return result;
}
async function pixels(label) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(0, 0);
  const screenshot = await page.screenshot({ path: join(artifacts, `${label}.png`), fullPage: true });
  const sampled = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return Array.from({ length: 12 }, (_, index) => [...context.getImageData(1, Math.floor((image.height - 1) * index / 11), 1, 1).data]);
  }, screenshot.toString('base64'));
  const expected = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g).map(Number).slice(0, 3).concat(255));
  for (const pixel of sampled) assert.deepEqual(pixel, expected, `${label}: canvas band`);
}
async function artwork() {
  return page.locator('.composition-artwork').evaluate(element => ({
    colors: [...element.querySelectorAll('.color-region')].map(region => ({ id: region.dataset.colorId, hex: region.dataset.hex, left: region.style.left, top: region.style.top, width: region.style.width, height: region.style.height })),
    splits: [...element.querySelectorAll('[role="separator"]')].map(divider => divider.getAttribute('aria-valuenow')),
    source: document.querySelector('.artwork-anchor .composition-source__name').textContent,
  }));
}
async function save() {
  await page.getByRole('button', { name: 'Save composition', exact: true }).click();
  await page.getByText('Composition saved to your account.', { exact: true }).waitFor();
}
try {
  const viewports = [{ width: 1920, height: 1080 }, { width: 1280, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 640, height: 400 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 568, height: 320 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await load();
    assert.equal(await page.getByRole('tab', { name: 'Edit', exact: true }).count(), 0);
    for (const value of ['dark', 'light']) {
      await theme(value); await selectView('Explore'); const exploreBounds = await layout(`explore-${viewport.width}-${viewport.height}-${value}`);
      if ([1280, 390].includes(viewport.width)) await pixels(`after-${viewport.width}-${value}-explore`);
      await selectView('Saved'); const savedBounds = await layout(`empty-${viewport.width}-${viewport.height}-${value}`);
      assert.equal(savedBounds.sectionLeft, exploreBounds.sectionLeft, 'no horizontal shift between views');
      assert.equal(savedBounds.width, exploreBounds.width, 'stable document width between views');
      if ([1280, 390].includes(viewport.width)) await pixels(`after-${viewport.width}-${value}-saved`);
      assert.equal(await page.locator('.saved-gallery__item').count(), 0);
    }
  }
  console.log('PASS: eight viewport sizes × two themes, Explore and empty Saved, with screenshots.');
  const appNav = page.getByRole('navigation', {name:'Design exploration'});
  const destinations = { types:'Types', spaces:'Spaces', details:'Details', designs:'Designs' };
  const expectedDescriptions = {
    types: {
      explore:'Explore how typography shapes character and hierarchy. Experiment with type combinations, scale, and rhythm to discover what feels right.',
      saved:'Your saved typography selections, ready to revisit and refine. Select a favorite to continue editing or explore new combinations.'
    },
    spaces: {
      explore:'Explore how spacing creates structure and rhythm. Discover how small changes in distance and proportion can transform a layout.',
      saved:'Your saved spacing systems, ready to revisit and refine. Select a favorite to continue editing or explore new possibilities.'
    },
    details: {
      explore:'Explore the subtle details that give interfaces their character. Discover combinations of corners, borders, shadows, and effects.',
      saved:'Your saved detail configurations, ready to revisit and refine. Select a favorite to continue editing or explore new combinations.'
    }
  };
  for (const viewport of [{width:1280,height:1000},{width:390,height:844},{width:568,height:320}]) {
    await page.setViewportSize(viewport); await load();
    for (const value of ['dark','light']) {
      await theme(value);
      for (const [section,title] of Object.entries(destinations)) {
        await appNav.getByRole('button',{name:title,exact:true}).click();
        await page.getByRole('heading',{name:title,level:1,exact:true}).waitFor();
        assert.equal(await appNav.locator('[aria-current="page"]').textContent(),title);
        assert.equal(await page.locator('.section-layout:not([hidden])').count(),1);
        assert.equal(await page.evaluate(()=>window.scrollY),0);
        assert.equal(await page.locator('html').getAttribute('data-theme'),value);
        if(section==='designs') {
          assert.equal(await page.getByRole('tab').count(),0);
          assert.equal(await page.locator('.designs-ingredients > li').count(),4);
          await page.getByText('No saved palettes yet. Save a color composition to use it here.',{exact:true}).waitFor();
          await layout(`phase2-designs-${viewport.width}-${value}`);
        } else {
          assert.equal(await page.getByRole('tab',{name:'Edit',exact:true}).count(),0);
          for(const local of ['explore','saved']) {
            await page.getByRole('tab',{name:local==='explore'?'Explore':'Saved',exact:true}).click();
            await page.getByRole('tab',{name:local==='explore'?'Explore':'Saved',selected:true,exact:true}).waitFor();
            assert.equal(await page.locator('.section-layout:not([hidden]) .section-layout__description').textContent(),expectedDescriptions[section][local]);
            await layout(`phase2-${section}-${local}-${viewport.width}-${value}`);
          }
        }
        if(viewport.width!==568) await pixels(`phase2-${section}-${viewport.width}-${value}`);
      }
    }
  }
  await appNav.getByRole('button',{name:'Types',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Saved',selected:true,exact:true}).count(),1);
  await appNav.getByRole('button',{name:'Spaces',exact:true}).click();
  await page.getByRole('button',{name:'Back to Explore',exact:true}).click();
  await appNav.getByRole('button',{name:'Details',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Saved',selected:true,exact:true}).count(),1);
  await appNav.getByRole('button',{name:'Spaces',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Explore',selected:true,exact:true}).count(),1);
  await appNav.getByRole('button',{name:'Types',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Saved',selected:true,exact:true}).count(),1);
  console.log('PASS: all five destinations, exact descriptions, independent local views, contextual Edit, both themes, fixed navigation, and sparse layouts.');
  await page.setViewportSize({width:1280,height:1000}); await load(2);
  await appNav.getByRole('button',{name:'Designs',exact:true}).click();
  await page.getByText('2 saved palettes available',{exact:true}).waitFor();
  assert.equal(await page.locator('.designs-saved-colors > li').count(),2);
  assert.deepEqual(await page.locator('.designs-saved-colors > li').allTextContents(),fixtures.slice(0,2).map(domain.paletteAttribution));
  await page.getByRole('button',{name:'View saved colors',exact:true}).click();
  await page.getByText('2 / 8 saved',{exact:true}).waitFor();
  assert.equal(await appNav.locator('[aria-current="page"]').textContent(),'Colors');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-delete-composition]').first().click();
  await page.getByText('1 / 8 saved',{exact:true}).waitFor();
  await appNav.getByRole('button',{name:'Designs',exact:true}).click();
  await page.getByText('1 saved palette available',{exact:true}).waitFor();
  assert.equal(await page.locator('.designs-saved-colors > li').count(),1);
  await page.getByRole('button',{name:'Go to Types',exact:true}).click();
  await page.getByRole('heading',{name:'Types',level:1,exact:true}).waitFor();
  await appNav.getByRole('button',{name:'Designs',exact:true}).click();
  await page.getByText('1 saved palette available',{exact:true}).waitFor();
  console.log('PASS: Designs shows only real saved records, ingredient links work, and data updates after Color deletion.');
  for (const count of [1, 2, 4, 8]) {
    await page.setViewportSize({ width: 390, height: 844 }); await load(count); await selectView('Saved');
    assert.equal(await page.locator('.saved-gallery__item').count(), count);
    await scrollEnd(); const result = await layout(`saved-${count}-at-document-end`);
    assert.ok(result.lastContentBottom < result.viewport - result.navHeight - 24, 'final card clears navigation');
  }
  console.log('PASS: one, two, four, and eight saved records; final content clears the navigation.');
  // Generic future section content must use the document scroll, too.
  await page.setViewportSize({ width: 1280, height: 720 }); await load(); await selectView('Saved');
  await page.locator('.section-layout:not([hidden]) .section-layout__content').evaluate(element => {
    const paragraph = document.createElement('p'); paragraph.textContent = 'Long section content. '.repeat(3000); element.appendChild(paragraph);
  });
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  let result = await layout('long-generic-section'); assert.ok(result.scrollY > 0); assert.ok(result.headerTop < 0);
  await scrollEnd(); result = await layout('long-generic-section-end'); assert.ok(result.lastContentBottom < result.viewport - result.navHeight - 24);
  await load();
  // Explicit 200% page zoom, in addition to the narrow-viewport reflow cases above.
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await selectView('Saved');
  assert.ok(await page.getByRole('button', { name: 'Explore palettes', exact: true }).isVisible());
  assert.ok(await page.locator('.nuance-navigation').isVisible());
  await pixels('after-page-zoom-200');
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  console.log('PASS: long generic content, native document scroll, and 200% CSS page zoom.');
  await page.setViewportSize({ width: 1280, height: 1000 }); await load();
  const carousel = page.locator('#color-explore-panel .palette-slider__viewport');
  await page.getByRole('button', {name:'Next palettes',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#color-explore-panel .palette-slider__viewport').scrollLeft > 0);
  await page.getByRole('button', {name:'Previous palettes',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#color-explore-panel .palette-slider__viewport').scrollLeft < 1);
  await carousel.focus(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#color-explore-panel .palette-slider__viewport').scrollLeft > 0);
  const carouselPosition = await carousel.evaluate(element=>element.scrollLeft);
  await appNav.getByRole('button',{name:'Types',exact:true}).click();
  await appNav.getByRole('button',{name:'Colors',exact:true}).click();
  await page.waitForFunction(position=>Math.abs(document.querySelector('#color-explore-panel .palette-slider__viewport').scrollLeft-position)<1,carouselPosition);
  const exploredWadaId = await page.locator('.palette-card').evaluateAll(cards => cards.find(card => card.dataset.compositionId.startsWith('sanzo-wada-') && card.querySelectorAll('.palette-card__color').length === 3).dataset.compositionId);
  await page.locator(`[data-composition-id="${exploredWadaId}"]`).click();
  assert.equal(await page.getByRole('tab', { name: 'Edit', selected: true }).count(), 1);
  const original = await artwork();
  await page.locator('.color-region__select').first().click();
  await page.getByLabel('HEX', { exact: true }).fill('#123456');
  await page.getByRole('button', { name: 'Close color editor', exact: true }).click();
  const separator = page.getByRole('separator').first(), bounds = await separator.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2, { steps: 5 }); await page.mouse.up();
  const modified = await artwork(); assert.notDeepEqual(modified, original);
  for (const view of ['Explore', 'Saved']) { await selectView(view); await selectView('Edit'); assert.deepEqual(await artwork(), modified); }
  for(const title of ['Types','Spaces','Details','Designs']) {
    await appNav.getByRole('button',{name:title,exact:true}).click();
    assert.equal(await page.getByRole('dialog',{name:'Switch palettes?'}).count(),0);
    await appNav.getByRole('button',{name:'Colors',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Edit',selected:true,exact:true}).count(),1);
    assert.deepEqual(await artwork(),modified);
  }
  await appNav.getByRole('button',{name:'Types',exact:true}).click(); await theme('light');
  await appNav.getByRole('button',{name:'Colors',exact:true}).click();
  assert.equal(await page.locator('.nuance-app').getAttribute('data-theme'),'light');
  assert.deepEqual(await artwork(),modified);
  console.log('PASS: Color editing and carousel position survive every main destination; global theme remains independent.');
  await save(); assert.equal(saved.length, 1); const id = saved[0].id;
  await selectView('Saved'); await page.locator('.saved-gallery .palette-card').click();
  await page.locator('.color-region__select').first().click(); await page.getByLabel('HEX', { exact: true }).fill('#ABCDEF');
  await page.getByRole('button', { name: 'Close color editor', exact: true }).click();
  await save(); assert.equal(saved.length, 1); assert.equal(saved[0].id, id); assert.equal(saved[0].document.colors[0].hex, '#ABCDEF');
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
  while (await page.locator('.color-region').count() < 6) await page.getByRole('button', { name: 'Add color', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: 'Add color — maximum of six colors reached', exact: true }).isDisabled());
  await page.locator('.color-region').last().hover(); await page.getByRole('button', { name: /^Remove color/ }).last().click();
  assert.equal(await page.locator('.color-region').count(), 5);
  await page.getByRole('button', { name: 'Reset composition', exact: true }).click(); assert.equal(await page.locator('.color-region').count(), 3);
  const beforeSwitch = await artwork();
  await selectView('Explore');
  const otherId = await page.locator('.palette-card').evaluateAll((cards, current) => cards.find(card => card.dataset.compositionId !== current).dataset.compositionId, exploredWadaId);
  await page.locator(`[data-composition-id="${otherId}"]`).click();
  await page.getByRole('dialog', { name: 'Switch palettes?' }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual(await artwork(), beforeSwitch);
  await selectView('Explore'); await page.locator(`[data-composition-id="${otherId}"]`).click();
  await page.getByRole('button', { name: 'Discard & Switch', exact: true }).click(); assert.notEqual((await artwork()).source, beforeSwitch.source);
  assert.equal(await page.getByRole('button', { name: /PNG|Download composition/ }).count(), 0);
  console.log('PASS: palette arrows/keyboard, edits, real mouse drag, view continuity, save/upsert identity, six-color limit, removal/reset, cancel/discard. PNG stays hidden.');
  await load(8); await selectView('Saved'); await page.locator('.saved-gallery .palette-card').first().click();
  assert.equal(await page.locator('.color-region').count(), 2);
  await save(); assert.equal(saved.length, 8);
  await selectView('Explore'); await page.locator('.palette-card').first().click();
  assert.ok(await page.getByRole('button', { name: /Save composition — limit reached/ }).isDisabled());
  await selectView('Saved');
  page.on('dialog', dialog => dialog.accept()); failDelete = true;
  await page.locator('[data-delete-composition]').first().click();
  await page.getByRole('alert').filter({ hasText: 'Temporary delete failure' }).waitFor(); assert.equal(saved.length, 8);
  await page.locator('[data-delete-composition]').first().click(); await page.getByText('7 / 8 saved', { exact: true }).waitFor(); assert.equal(saved.length, 7);
  await page.getByRole('button', { name: 'Open your profile' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).waitFor();
  await page.getByLabel('Display name', { exact: true }).fill('Updated name'); await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Profile updated.', { exact: true }).waitFor(); assert.equal(profile.display_name, 'Updated name');
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Open your profile' }).evaluate(element => element === document.activeElement), true);
  console.log('PASS: editing at capacity, two-color saved geometry, quota, deletion failure/retry/count, profile update and modal focus return.');
  await page.setViewportSize({width:1280,height:1000}); await load();
  const allCards = page.locator('.palette-slider .palette-card');
  assert.equal(await allCards.count(),60);
  assert.equal(await page.locator('.palette-slider [data-composition-id^="sanzo-wada-"]').count(),30);
  assert.equal(await page.locator('.palette-slider [data-composition-id^="werner-nuance-"]').count(),30);
  assert.equal(await page.getByRole('combobox').count(),0);
  const firstBatch = await allCards.evaluateAll(cards=>cards.map(card=>card.dataset.compositionId));
  await page.locator('#color-explore-panel .palette-slider__viewport').evaluate(element=>element.scrollTo({left:element.scrollWidth,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelectorAll('.palette-slider .palette-card').length===120);
  assert.deepEqual((await allCards.evaluateAll(cards=>cards.map(card=>card.dataset.compositionId))).slice(0,60),firstBatch);
  assert.equal(await page.locator('.palette-slider [data-composition-id^="werner-nuance-"]').count(),60);
  const occurrence = await page.locator('.palette-slider [data-composition-id="werner-nuance-005"]').last().getAttribute('data-palette-index');
  await page.locator(`[data-palette-index="${occurrence}"]`).click();
  assert.equal((await artwork()).source,'Werner · Nuance No. 5');
  const originalWerner = await artwork();
  await page.locator('.color-region__select').first().click();await page.getByLabel('HEX',{exact:true}).fill('#123456');
  await page.getByRole('button',{name:'Close color editor',exact:true}).click();
  const wernerDivider=page.getByRole('separator').first();await wernerDivider.focus();await page.keyboard.press('ArrowRight');
  assert.match((await artwork()).source,/^Based on Werner · Nuance No. 5/);
  const modifiedWerner=await artwork();await selectView('Explore');await selectView('Edit');assert.deepEqual(await artwork(),modifiedWerner);
  await selectView('Saved');await selectView('Edit');assert.deepEqual(await artwork(),modifiedWerner);
  await selectView('Explore');
  await page.waitForFunction(index=>{
    const el=document.querySelector('#color-explore-panel .palette-slider__viewport');const step=el.clientWidth+parseFloat(getComputedStyle(el).columnGap);
    return Math.round(el.scrollLeft/step)===Math.floor(Number(index)/3);
  },occurrence);
  await page.locator('.palette-slider [data-composition-id^="sanzo-wada-"]').first().click();
  await page.getByRole('dialog',{name:'Switch palettes?'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await artwork(),modifiedWerner);
  await save();const wernerSavedId=saved[0].id;assert.equal(saved[0].document.source,'werner-nuance');assert.equal(saved[0].document.curated.combinationNumber,5);
  assert.equal(saved[0].document.curated.curation,'nuance-generated');assert.equal(saved[0].document.curated.colors.length,3);
  await page.getByRole('button',{name:'Reset composition',exact:true}).click();assert.equal((await artwork()).source,'Werner · Nuance No. 5');
  assert.deepEqual((await artwork()).colors.map(c=>c.hex),originalWerner.colors.map(c=>c.hex));
  await save();assert.equal(saved.length,1);assert.equal(saved[0].id,wernerSavedId);
  await selectView('Explore');await page.locator('.palette-slider [data-composition-id^="sanzo-wada-"]').first().click();await save();assert.equal(saved.length,2);
  await selectView('Saved');await page.locator(`[data-composition-id="${wernerSavedId}"]`).click();assert.equal((await artwork()).source,'Werner · Nuance No. 5');
  await page.locator('.color-region__select').first().click();await page.getByLabel('HEX',{exact:true}).fill('#ABCDEF');await page.getByRole('button',{name:'Close color editor',exact:true}).click();
  await save();assert.equal(saved.length,2);assert.equal(saved.find(record=>record.id===wernerSavedId).document.colors[0].hex,'#ABCDEF');
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();await selectView('Saved');
  await page.locator(`[data-composition-id="${wernerSavedId}"]`).click();assert.equal((await artwork()).colors[0].hex,'#ABCDEF');
  await page.setViewportSize({width:390,height:844});await layout('unified-werner-editor-mobile');await pixels('unified-werner-editor-mobile');
  assert.equal(await page.getByRole('button',{name:/PNG|Download composition/}).count(),0);
  console.log('PASS: unified 50/50 discovery, appended source cycles, repeated-palette position, Werner attribution/reset/editing/dirty protection and mixed-source save/update/reload. No added controls or PNG action.');
  await load(4); await selectView('Saved');
  await page.locator(`[data-composition-id="${six.id}"]`).click();
  for (const viewport of [{width:390,height:844},{width:320,height:568},{width:568,height:320}]) {
    const beforeResize = await artwork();
    await page.setViewportSize(viewport);
    assert.deepEqual(await artwork(), beforeResize);
    await scrollEnd();
    const result = await layout(`six-color-editor-${viewport.width}-${viewport.height}`);
    assert.ok(result.lastContentBottom < result.viewport - result.navHeight - 24);
    await page.locator('.color-region__select').first().click();
    await page.getByLabel('HEX', {exact:true}).fill('#334455');
    await page.getByRole('button', {name:'Close color editor',exact:true}).click();
    assert.equal((await artwork()).colors[0].hex, '#334455');
    assert.equal(await page.locator('.color-region').count(), 6);
  }
  const png = await page.evaluate(async composition => {
    const { compositionPng } = await import('/src/nuance/export/png.ts');
    const blob = await compositionPng(composition), bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
    return { type: blob.type, width: bitmap.width, height: bitmap.height, pixel: [...context.getImageData(0,0,1,1).data] };
  }, six);
  assert.equal(png.type,'image/png'); assert.equal(png.width,six.artwork.width); assert.equal(png.height,six.artwork.height);
  assert.deepEqual(png.pixel,[1,3,5].map(offset=>parseInt(six.colors[0].hex.slice(offset,offset+2),16)).concat(255));
  console.log('PASS: six-color editor resizing and color controls on portrait/landscape viewports; hidden PNG utility encodes exact artwork.');
  // Keep all controls in flow even with a maximum-length display name.
  profile.display_name = 'Long display name '.repeat(4).slice(0, 80);
  await page.setViewportSize({ width: 320, height: 568 }); await load();
  await layout('long-display-name-320');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 20, left: 12, right: 12, bottom: 34 } });
  const safe = await page.locator('.nuance-navigation').evaluate(element => ({ bottom: element.getBoundingClientRect().bottom, viewport: innerHeight }));
  assert.ok(Math.abs(safe.viewport - safe.bottom - 58) < 1, 'navigation respects bottom safe area');
  assert.ok(await page.getByRole('button', { name: 'Open your profile' }).isVisible());
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
  console.log('PASS: long display-name wrapping and simulated mobile safe-area insets.');
  await selectView('Explore');
  await page.getByRole('tab', { name: 'Explore', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('tab', { name: 'Saved', selected: true }).waitFor();
  await page.evaluate(()=>{ localStorage.clear(); localStorage.setItem('nuance-test-signed-out', 'true'); });
  await page.reload();
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  await appNav.getByRole('button',{name:'Designs',exact:true}).click();
  const activeDesigns = page.locator('.section-layout:not([hidden])');
  await activeDesigns.getByText('Sign in to access your saved palettes.',{exact:true}).waitFor();
  await activeDesigns.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Email',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('heading',{name:'Designs',level:1,exact:true}).count(),1);
  console.log('PASS: Designs signed-out state and the shared authentication dialog.');
  assert.deepEqual(exceptions, []);
  await rm(join(artifacts, 'failure.png'), {force:true});
  await writeFile(join(artifacts, 'layout-report.json'), JSON.stringify({ reports, posts, exceptions }, null, 2));
  console.log(`PASS: keyboard tabs, no browser exceptions. ${reports.length} layout checks; screenshots/report: ${artifacts}`);
} catch (error) {
  await page.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await browser.close(); await rm(temporary, { recursive: true, force: true });
}
