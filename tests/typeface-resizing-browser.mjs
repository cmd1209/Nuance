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
const headline=page.getByRole('slider',{name:'Headline size',exact:true});
const subheadline=page.getByRole('slider',{name:'Subheadline size',exact:true});
const size=handle=>handle.getAttribute('aria-valuenow').then(Number);
const explore=()=>page.getByRole('tab',{name:'Explore',exact:true}).click();
async function aligned(){
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
  await page.getByRole('button',{name:'Preview DM Serif Display',exact:true}).click();
  await page.locator('.type-detail[data-font-status="loaded"]').waitFor();
  await aligned();
  const original=await size(headline),subOriginal=await size(subheadline);
  await headline.scrollIntoViewIfNeeded();
  const bounds=await headline.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x,y+20,{steps:8});
  await page.waitForFunction(expected=>Number(document.querySelector('[aria-label="Headline size"]').getAttribute('aria-valuenow'))===expected,original+20);
  // Capture keeps the interaction alive when the pointer leaves the text horizontally.
  await page.mouse.move(x+bounds.width,y+35,{steps:5});await page.mouse.up();
  assert.equal(await size(headline),original+35);
  assert.equal(await size(subheadline),subOriginal,'resizing the headline must leave the subheadline unchanged');
  assert.equal(await page.locator('.type-line.is-resizing').count(),0);
  await subheadline.focus();await subheadline.press('ArrowUp');assert.equal(await size(subheadline),subOriginal+1);
  await subheadline.press('Shift+ArrowUp');assert.equal(await size(subheadline),subOriginal+9);
  await subheadline.press('Home');assert.equal(await size(subheadline),14);
  await subheadline.press('ArrowDown');assert.equal(await size(subheadline),14);
  await subheadline.press('End');assert.equal(await size(subheadline),96);
  await subheadline.press('ArrowUp');assert.equal(await size(subheadline),96);
  await aligned();
  await page.getByRole('tab',{name:'Saved',exact:true}).click();
  await page.getByRole('tab',{name:'Edit',exact:true}).click();
  assert.equal(await size(headline),original+35);assert.equal(await size(subheadline),96);
  await explore();await page.getByRole('button',{name:'Preview Inter',exact:true}).click();
  assert.notEqual(await size(subheadline),96,'other typefaces keep independent sizes');
  await explore();await page.getByRole('button',{name:'Preview DM Serif Display',exact:true}).click();
  assert.equal(await size(headline),original+35);assert.equal(await size(subheadline),96);
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});
    await headline.focus();await headline.press('End');assert.equal(await size(headline),192);
    await aligned();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'large text must wrap without page overflow');
    assert.ok(await page.locator('#types-edit-panel').evaluate(stage=>{
      const actions=stage.querySelector('.composition-actions'),specimen=stage.querySelector('.type-specimen');
      return actions.getBoundingClientRect().top>=specimen.getBoundingClientRect().bottom-1 && getComputedStyle(stage).backgroundImage.includes('linear-gradient');
    }),'actions stay below the specimen inside the gradient');
    await page.screenshot({path:`${artifacts}/baseline-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS baseline alignment, captured dragging, independent lines/fonts, size limits, keyboard controls, view persistence and responsive wrapping');
}catch(error){console.error(errors);await page.screenshot({path:`${artifacts}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
