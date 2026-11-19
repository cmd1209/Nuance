// Isolated browser verification: every Supabase request is intercepted, no email is sent.
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts = '/private/tmp/nuance-account-review';
await mkdir(artifacts, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'nuance-account-fixtures-'));
await build({ stdin: { contents: "export { historicalComposition, editorComposition, WADA_PALETTES } from './src/nuance/domain/wada';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: join(temporary, 'fixtures.mjs') });
const { historicalComposition, editorComposition, WADA_PALETTES } = await import(pathToFileURL(join(temporary, 'fixtures.mjs')).href);
const composition = editorComposition(historicalComposition(WADA_PALETTES[0]));
const env = await readFile('.env.local', 'utf8');
const remote = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]);
const project = remote.hostname.split('.')[0];
const makeUser = (id, email, metadata = {}) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: metadata, identities: [], created_at: new Date().toISOString() });
const alice = makeUser('11111111-1111-4111-8111-111111111111', 'alice@example.com');
const bob = makeUser('22222222-2222-4222-8222-222222222222', 'bob@example.com');
const users = [alice, bob];
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = user => ({ access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test`, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, user });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const images = new Map();
let signupBody, signupRedirect, uploads = 0, failUpload = false, failRemove = false, failName = false, failLogin = false, failLogout = false, failLoad = false, saved = false;
let releaseSignup;
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === new URL(base).origin) return route.continue();
  assert.equal(url.origin, remote.origin, 'unexpected external request');
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  let owner;
  try { owner = JSON.parse(Buffer.from(request.headers().authorization.split(' ')[1].split('.')[1], 'base64url')).sub; } catch {}
  const user = users.find(user => user.id === owner) || alice;
  if (url.pathname.endsWith('/signup')) {
    signupBody = request.postDataJSON(); signupRedirect = url.searchParams.get("redirect_to");
    await new Promise(resolve => { releaseSignup = resolve; });
    return reply({ user: alice, session: null });
  }
  if (url.pathname.endsWith('/token')) {
    if (failLogin) return reply({ msg: 'Invalid login credentials' }, 400);
    return reply(session(users.find(user => user.email === request.postDataJSON().email) || alice));
  }
  if (url.pathname.endsWith('/user')) {
    if (request.method() === 'PUT') {
      if (failName) return reply({ msg: 'Name could not be saved' }, 500);
      user.user_metadata = { ...user.user_metadata, ...request.postDataJSON().data };
    }
    return reply(user);
  }
  if (url.pathname.endsWith('/logout')) return failLogout ? reply({ msg: 'Logout temporarily unavailable' }, 422) : route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith('/profiles')) return reply([{ id: user.id, display_name: user === alice ? 'Legacy Alice' : '' }]);
  if (url.pathname.endsWith('/compositions')) return reply(saved && user === alice ? [{ id: composition.id, owner_id: user.id, document: composition, updated_at: new Date().toISOString() }] : []);
  if (url.pathname.endsWith('/typeface_favorites')) return reply([]);
  if (url.pathname.startsWith('/storage/v1/object')) {
    assert.ok(owner, 'avatars require a session');
    if (request.method() === 'DELETE') {
      if (failRemove) return reply({ message: 'Avatar removal failed' }, 500);
      images.delete(owner); return reply([]);
    }
    assert.ok(url.pathname.endsWith(`/${owner}/avatar`), 'avatar path belongs to session owner');
    if (request.method() === 'POST' || request.method() === 'PUT') {
      uploads++;
      if (failUpload) return reply({ message: 'Avatar upload failed' }, 500);
      // Store the test PNG; actual request still exercises the SDK upload path.
      images.set(owner, png); return reply({ Key: `avatars/${owner}/avatar` });
    }
    if (failLoad) return reply({ message: 'Avatar temporarily unavailable' }, 500);
    if (!images.has(owner)) return reply({ message: 'Object not found', statusCode: '404', error: 'not_found' }, 400);
    return route.fulfill({ status: 200, headers, contentType: 'image/png', body: images.get(owner) });
  }
  return route.abort();
});
const png = Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 60; canvas.height = 120;
  const context = canvas.getContext('2d');
  context.fillStyle = '#24536b'; context.fillRect(0, 0, 60, 120);
  context.fillStyle = '#f2c89c'; context.fillRect(10, 20, 40, 80);
  return canvas.toDataURL('image/png').split(',')[1];
}), 'base64');
const dialog = () => page.getByRole('dialog');
const openAccount = () => page.locator('.nuance-header .account-button').click();
const button = name => dialog().getByRole('button', { name, exact: true });
async function login(user) {
  await dialog().getByLabel('Email', { exact: true }).fill(user.email);
  await dialog().getByLabel('Password', { exact: true }).fill('password1234');
  await button('Log in').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}
async function upload(file) { await dialog().getByLabel('Choose avatar').setInputFiles(file); }
async function feedback(text) { await dialog().getByText(text, { exact: true }).waitFor(); }
try {
  await page.goto(base);
  await openAccount();
  await dialog().getByLabel('Email', { exact: true }).fill('alice@example.com');
  await dialog().getByLabel('Password', { exact: true }).fill('secret');
  await button('Create an account').click();
  assert.equal(await dialog().getByLabel('Password', { exact: true }).inputValue(), '');
  assert.equal(await dialog().getByLabel('First name', { exact: true }).getAttribute('required'), '');
  await dialog().getByLabel('First name', { exact: true }).fill('   ');
  await dialog().getByLabel('Password', { exact: true }).fill('password1234');
  await button('Sign up').click();
  await feedback('Enter your first name.');
  assert.equal(signupBody, undefined, 'blank names are rejected before reaching Supabase');
  await dialog().getByLabel('First name').fill(' Alice ');
  await dialog().getByLabel('Last name (optional)').fill(' Example ');
  await dialog().getByLabel('Password', { exact: true }).fill('password1234');
  await button('Already have an account? Log in').click();
  await button('Create an account').click();
  assert.equal(await dialog().getByLabel('First name').inputValue(), ' Alice ');
  assert.equal(await dialog().getByLabel('Email', { exact: true }).inputValue(), alice.email);
  assert.equal(await dialog().getByLabel('Password', { exact: true }).inputValue(), '');
  await dialog().getByLabel('Password', { exact: true }).fill('password1234');
  await button('Sign up').click();
  await button('Please wait...').waitFor();
  assert.equal(await button('Already have an account? Log in').isEnabled(), false);
  assert.equal(await dialog().getByLabel('Email', { exact: true }).isEnabled(), false);
  await page.waitForFunction(() => document.querySelector('dialog input[type=email]')?.disabled);
  // Wait for the intercepted signup request before releasing the controlled response.
  for (let attempt = 0; !releaseSignup && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(releaseSignup, "signup request was intercepted");
  assert.equal(signupBody.data.first_name, 'Alice'); assert.equal(signupBody.data.last_name, 'Example');
  assert.equal(signupRedirect, `${base}/?account=confirm`);
  releaseSignup();
  await feedback('Check your email to confirm your account, then log in.');
  await button('Back to log in').click();
  failLogin = true;
  await dialog().getByLabel('Password', { exact: true }).fill('password1234');
  await button('Log in').click(); await feedback('Invalid login credentials');
  assert.equal(await dialog().getByLabel('Password', { exact: true }).inputValue(), 'password1234');
  failLogin = false; await login(alice);
  assert.equal(await page.getByRole('tab', { name: 'Explore', exact: true }).getAttribute('aria-selected'), 'true');
  await openAccount();
  assert.equal(await dialog().getByLabel('First name').count(), 0);
  await button('Edit name').click();
  assert.equal(await dialog().getByLabel('First name').inputValue(), 'Legacy Alice');
  await dialog().getByLabel('First name').fill(' Alice ');
  await dialog().getByLabel('Last name (optional)').fill(' Example ');
  assert.equal(alice.user_metadata.first_name, undefined, 'typing never saves names');
  failName = true; await button('Save name').click(); await feedback('Name could not be saved');
  failName = false; await button('Save name').click(); await feedback('Name saved.');
  assert.equal(await button('Edit name').evaluate(element => element === document.activeElement), true);
  assert.equal(await dialog().getByLabel('First name').count(), 0);
  assert.equal(alice.user_metadata.first_name, 'Alice'); assert.equal(alice.user_metadata.last_name, 'Example');
  await button('Edit picture').click();
  await dialog().getByRole('button', { name: 'Security Manage password and login', exact: true }).click();
  await button('Reset password').waitFor();
  await dialog().getByRole('button', { name: 'Security Manage password and login', exact: true }).click();
  const before = uploads;
  for (const [file, text] of [
    [{ name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) }, 'Choose an image that is not empty.'],
    [{ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(2097153) }, 'Choose an image up to 2 MB.'],
    [{ name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }, 'Choose a JPEG, PNG, or WebP image.'],
    [{ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') }, 'This image could not be read. Choose another JPEG, PNG, or WebP.'],
  ]) { await upload(file); await feedback(text); }
  assert.equal(uploads, before);
  const image = { name: 'avatar.png', mimeType: 'image/png', buffer: png };
  await upload(image); await feedback('Avatar saved.');
  assert.equal(await dialog().locator('.account-dialog__avatar img').count(), 1);
  assert.equal(await page.locator('.account-button--avatar > span').count(), 0, 'avatar bypasses the Button label wrapper');
  const headerCrop = await page.locator('.account-button--avatar > img').evaluate(async image => {
    await image.decode();
    const bounds = image.getBoundingClientRect(), button = image.parentElement.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height, buttonWidth: button.width, buttonHeight: button.height,
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, fit: getComputedStyle(image).objectFit };
  });
  assert.deepEqual(headerCrop, { width: 44, height: 44, buttonWidth: 44, buttonHeight: 44, naturalWidth: 60, naturalHeight: 120, fit: 'cover' });
  const previous = await dialog().locator('.account-dialog__avatar img').getAttribute('src');
  failUpload = true; await upload(image); await feedback('Avatar upload failed');
  assert.equal(await dialog().locator('.account-dialog__avatar img').getAttribute('src'), previous);
  failUpload = false; await upload(image); await feedback('Avatar saved.');
  failRemove = true; await button('Remove avatar').click(); await feedback('Avatar removal failed');
  assert.equal(await dialog().locator('.account-dialog__avatar img').count(), 1);
  failRemove = false;
  saved = true; await page.reload();
  await page.getByRole('tab', { name: 'Saved', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('#color-saved-tab')?.getAttribute('aria-selected') === 'true');
  await openAccount(); await dialog().getByText('Alice Example', { exact: true }).waitFor();
  assert.equal(await button('Edit name').getAttribute('aria-expanded'), 'false');
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(viewport);
    const geometry = await dialog().evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, overflow: el.scrollWidth > el.clientWidth }; });
    assert.ok(geometry.x >= 0 && geometry.y >= 0 && geometry.right <= viewport.width && geometry.bottom <= viewport.height && !geometry.overflow, JSON.stringify(geometry));
    await button('Log out').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${artifacts}/account-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: `${artifacts}/account-desktop.png` });
  await button('Edit picture').click();
  await button('Remove avatar').click(); await feedback('Avatar removed.');
  assert.equal(await dialog().locator('.account-dialog__avatar img').count(), 0);
  assert.equal(await page.locator('.account-button').innerText(), 'A');
  failLogout = true; await button('Log out').click(); await feedback('Logout temporarily unavailable');
  failLogout = false; await button('Log in').waitFor();
  await login(alice); await openAccount(); await button('Log out').click(); await button('Log in').waitFor();
  await login(bob); await openAccount(); await button('Edit name').click();
  assert.equal(await dialog().getByLabel('First name').inputValue(), '');
  assert.equal(await dialog().locator('.account-dialog__avatar img').count(), 0);
  assert.equal(await page.locator('.account-button').innerText(), 'B');
  // Supabase broadcasts a sign-out to other tabs via its own local storage listener.
  const other = await context.newPage(); await other.goto(base);
  await other.locator('.nuance-header .account-button--avatar').waitFor();
  await button('Log out').click(); await other.locator('.nuance-header').getByRole('button', { name: 'Log in', exact: true }).waitFor();
  await other.close();
  await login(alice); failLoad = true; await page.reload(); await openAccount();
  await button('Retry avatar').waitFor(); failLoad = false; await button('Retry avatar').click(); await button('Edit picture').click(); await button('Upload avatar').waitFor();
  await page.waitForFunction(() => !document.querySelector('dialog [role=alert]'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.account-button').evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  console.log('PASS account modes, confirmation, busy/error feedback, optional/legacy names, avatar validation/upload/replace/remove/retry, restoration, destinations, narrow screens, logout, two-account isolation, cross-tab sign-out, keyboard focus');
} finally { await browser.close(); await rm(temporary, { recursive: true, force: true }); }
