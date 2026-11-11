// Run with the same isolated Playwright/Chrome setup as tests/types-browser.mjs.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts=process.env.NUANCE_ARTIFACTS || '/private/tmp/nuance-types-resizing';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin ? route.continue() : route.fulfill({status:200,contentType:'application/json',body:'[]'}));
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const quote=page.getByRole('slider',{name:'Quote size',exact:true});
const captionSize=()=>page.locator('.type-detail .type-specimen__quote-caption').evaluate(el=>getComputedStyle(el).fontSize);
const size=handle=>handle.getAttribute('aria-valuenow').then(Number);
const explore=()=>page.getByRole('tab',{name:'Explore',exact:true}).click();
async function aligned(){
  await page.waitForFunction(()=>[...document.querySelectorAll('#types-edit-panel .type-line')].every(line=>{
    const marker=line.querySelector('.type-line__baseline-marker').getBoundingClientRect();
    const handle=line.querySelector('.type-line__handle').getBoundingClientRect();
    return Math.abs(marker.top-(handle.top+handle.height/2))<1;
  }));
  const offsets=await page.locator('.type-line').evaluateAll(lines=>lines.map(line=>{
    const marker=line.querySelector('.type-line__baseline-marker').getBoundingClientRect();
    const handle=line.querySelector('.type-line__handle').getBoundingClientRect();
    return Math.abs(marker.top-(handle.top+handle.height/2));
  }));
  assert.ok(offsets.every(offset=>offset<1),'handles must track the actual text baselines');
}
try{
  await page.goto(base);
  await page.getByRole('navigation',{name:'Design exploration'}).getByRole('button',{name:'Types',exact:true}).click();
  assert.equal(await page.getByRole('slider').count(),0,'discovery specimens stay read-only');
  const exploreSize=fontId=>page.locator(`#types-explore-panel [data-font-id="${fontId}"] .type-specimen__quote-text`).evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.equal(await exploreSize('google-fonts:dm-serif-display'),28,'Explore defaults to 28px');
  await page.getByRole('button',{name:'Preview DM Serif Display',exact:true}).click();
  await page.locator('.type-detail[data-font-status="loaded"]').waitFor();
  const weightButton=()=>page.getByRole('button',{name:/^Font weight:/});
  const renderedWeight=()=>page.locator('.type-detail .type-specimen__quote-text').evaluate(el=>Number(getComputedStyle(el).fontWeight));
  assert.equal(await weightButton().isDisabled(),true,'single-weight fonts cannot cycle to synthetic styles');
  await aligned();
  assert.equal(await page.getByRole('slider').count(),1,'only the quote is adjustable');
  const original=await size(quote),captionOriginal=await captionSize();
  const originalText=await page.locator('.type-detail .type-specimen__quote-text').textContent();
  const alphabet=page.getByRole('slider',{name:'Alphabet size',exact:true});
  await page.getByRole('button',{name:'Show alphabet',exact:true}).click();
  assert.equal(await page.locator('.type-detail .type-specimen__quote-text').textContent(),'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz');
  assert.equal(await page.locator('.type-detail .type-specimen__quote-caption').count(),0,'alphabet mode hides attribution');
  assert.equal(await size(alphabet),original,'toggling keeps the text size');
  assert.equal(await page.getByRole('button',{name:'Show quote',exact:true}).getAttribute('aria-pressed'),'true');
  await aligned();
  await alphabet.focus();await alphabet.press('ArrowUp');assert.equal(await size(alphabet),original+1);
  await alphabet.press('ArrowDown');
  await page.getByRole('button',{name:'Show quote',exact:true}).press('Space');
  assert.equal(await page.locator('.type-detail .type-specimen__quote-text').textContent(),originalText);
  assert.equal(await captionSize(),captionOriginal);
  assert.equal(await size(quote),original);
  await quote.scrollIntoViewIfNeeded();
  const bounds=await quote.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x,y+20,{steps:8});
  await page.waitForFunction(expected=>Number(document.querySelector('[aria-label="Quote size"]').getAttribute('aria-valuenow'))===expected,original+20);
  // Capture keeps the interaction alive when the pointer leaves the text horizontally.
  await page.mouse.move(x+bounds.width,y+35,{steps:5});await page.mouse.up();
  assert.equal(await size(quote),original+35);
  assert.equal(await captionSize(),captionOriginal,'the attribution keeps its fixed caption size');
  assert.equal(await page.locator('.type-line.is-resizing').count(),0);
  await quote.focus();await quote.press('ArrowUp');assert.equal(await size(quote),original+36);
  await quote.press('Shift+ArrowUp');assert.equal(await size(quote),original+44);
  await quote.press('Home');assert.equal(await size(quote),14);
  await quote.press('ArrowDown');assert.equal(await size(quote),14);
  await quote.press('End');assert.equal(await size(quote),192);
  await quote.press('ArrowUp');assert.equal(await size(quote),192);
  await aligned();
  await page.getByRole('tab',{name:'Saved',exact:true}).click();
  await page.getByRole('tab',{name:'Edit',exact:true}).click();
  assert.equal(await size(quote),192);assert.equal(await captionSize(),captionOriginal);
  await explore();
  assert.equal(await exploreSize('google-fonts:dm-serif-display'),192,'Explore reflects the manually edited size');
  assert.equal(await exploreSize('google-fonts:inter'),28,'unedited typefaces stay at 28px');
  await page.getByRole('button',{name:'Preview Inter',exact:true}).click();
  await page.locator('.type-detail[data-font-status="loaded"]').waitFor();
  assert.notEqual(await size(quote),192,'other typefaces keep independent sizes');
  assert.equal(await weightButton().isEnabled(),true);
  assert.equal(await renderedWeight(),400);
  for(const expected of [500,600,700,800,900,100,200,300,400]){
    await weightButton().press('Space');
    assert.equal(await renderedWeight(),expected,'cycle only through supported weights and wrap to the start');
    assert.ok((await weightButton().getAttribute('aria-label')).includes(`(${expected})`),'the current weight is accessible');
    await aligned();
  }
  await page.getByRole('button',{name:'Show alphabet',exact:true}).click();
  await weightButton().click();assert.equal(await renderedWeight(),500,'weight changes also apply to alphabet mode');
  await aligned();assert.equal(await size(alphabet),28,'changing weight keeps the text size');
  await page.getByRole('button',{name:'Show quote',exact:true}).click();assert.equal(await renderedWeight(),500);
  await explore();
  assert.equal(await page.locator('#types-explore-panel [data-font-id="google-fonts:inter"] .type-specimen__quote-text').evaluate(el=>Number(getComputedStyle(el).fontWeight)),500,'Explore reflects the edited weight');
  await page.getByRole('button',{name:'Preview Inter',exact:true}).click();
  assert.equal(await renderedWeight(),500,'weight selection survives view changes');
  await explore();await page.getByRole('button',{name:'Preview DM Serif Display',exact:true}).click();
  assert.equal(await renderedWeight(),400,'weight settings are independent for each typeface');
  assert.equal(await size(quote),192);assert.equal(await captionSize(),captionOriginal);
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});
    await quote.focus();await quote.press('End');assert.equal(await size(quote),192);
    await aligned();
    assert.equal(await captionSize(),captionOriginal);
    await page.getByRole('button',{name:'Show alphabet',exact:true}).click();
    await aligned();assert.equal(await size(alphabet),192);
    assert.equal(await page.locator('.type-detail .type-specimen__quote-caption').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'alphabet must wrap within the specimen');
    await page.getByRole('button',{name:'Show quote',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'large text must wrap without page overflow');
    assert.ok(await page.locator('#types-edit-panel').evaluate(stage=>{
      const actions=stage.querySelector('.composition-actions'),specimen=stage.querySelector('.type-specimen');
      return actions.getBoundingClientRect().top>=specimen.getBoundingClientRect().bottom-1 && getComputedStyle(stage).backgroundImage.includes('linear-gradient');
    }),'actions stay below the specimen inside the gradient');
    await page.screenshot({path:`${artifacts}/baseline-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS quote/alphabet toggle and caption visibility, baseline alignment, captured dragging, independent fonts, size limits, keyboard controls, view persistence and responsive wrapping');
}catch(error){console.error(errors);await page.screenshot({path:`${artifacts}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
