// Optional isolated browser validation; see docs/types-discovery.md.
import assert from 'node:assert/strict';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.NUANCE_BASE_URL || 'http://127.0.0.1:5176';
const artifacts=process.env.NUANCE_ARTIFACTS || '/private/tmp/nuance-types-review';
const fonts=JSON.parse(await readFile('src/nuance/data/typefaces/v1/registry.json','utf8'));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:820},reducedMotion:'reduce'});
const requested=[],external=[],errors=[];let hold=true;const releases=[];
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==new URL(base).origin){external.push(url.origin);return route.fulfill({status:200,contentType:'application/json',body:'[]'});}
 if(url.pathname.includes('/fonts/specimens/')&&url.pathname.endsWith('.woff2')){requested.push(url.pathname);if(hold)await new Promise(resolve=>releases.push(resolve));}
 return route.continue();
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const nav=page.getByRole('navigation',{name:'Design exploration'}),cards=page.locator('.type-specimen');
const types=()=>nav.getByRole('button',{name:'Types',exact:true}).click();
const columns=()=>page.locator('#types-explore-panel .palette-slider__page').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
async function layout(label){
 const result=await page.evaluate(()=>{
  const root=document.documentElement,main=document.querySelector('.nuance-main');
  return {width:root.clientWidth,scroll:root.scrollWidth,scrolling:document.scrollingElement.tagName,nav:getComputedStyle(document.querySelector('.nuance-navigation')).position,
   nested:[main,...main.querySelectorAll('*')].filter(el=>['auto','scroll'].includes(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+2).length,
   ui:getComputedStyle(document.querySelector('.nuance-navigation button')).fontFamily};
 });
 assert.ok(result.scroll<=result.width+1,label);assert.equal(result.scrolling,'HTML',label);assert.equal(result.nav,'fixed',label);assert.equal(result.nested,0,label);assert.match(result.ui,/Clarity City/,label);
}
const colorState=()=>page.locator('.composition-artwork').evaluate(el=>({colors:[...el.querySelectorAll('.color-region')].map(el=>({id:el.dataset.colorId,hex:el.dataset.hex,left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height}))}));
try{
 await page.goto(base);await page.getByRole('heading',{name:'Color',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(requested.length,0,'Types fonts must not load while Colors is active');
 await page.locator('.palette-card').first().click();await page.locator('.color-region__select').first().click();await page.getByLabel('HEX',{exact:true}).fill('#123456');await page.getByRole('button',{name:'Close color editor',exact:true}).click();
 const editedColor=await colorState();await types();
 await page.waitForFunction(()=>[...document.querySelectorAll('.type-specimen')].some(el=>el.dataset.fontStatus==='loading'));
 assert.ok(requested.length>0&&requested.length<8,'visible specimens load on demand');assert.equal(await cards.count(),8);assert.equal(await columns(),3);
 assert.equal(await page.getByRole('tab',{name:'Edit',exact:true}).count(),0);
 const before=await cards.evaluateAll(nodes=>nodes.map(node=>({x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,height:node.getBoundingClientRect().height})));
 hold=false;releases.splice(0).forEach(resolve=>resolve());
 await page.waitForFunction(()=>[...document.querySelectorAll('.type-specimen')].every(el=>el.dataset.fontStatus!=='loading'));
 const after=await cards.evaluateAll(nodes=>nodes.map(node=>({x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,height:node.getBoundingClientRect().height})));
 assert.deepEqual(after,before,'font arrival must not move gallery cards');
 const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 for(const font of fonts){
  const card=page.locator(`.type-specimen[data-font-id="${font.id}"]`);await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(id=>document.querySelector(`.type-specimen[data-font-id="${id}"]`).dataset.fontStatus==='loaded',font.id);
  assert.match(await card.locator('.type-specimen__artwork').evaluate(el=>getComputedStyle(el).fontFamily),new RegExp(font.loading.family));
  assert.match(await card.locator('.type-specimen__metadata').evaluate(el=>getComputedStyle(el).fontFamily),/Clarity City/);
  const {root}=await cdp.send('DOM.getDocument'),{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:`.type-specimen[data-font-id="${font.id}"] .type-specimen__quote-text`});
  const used=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
  assert.ok(used.fonts.some(face=>face.isCustomFont&&face.glyphCount>0&&face.familyName.toLowerCase().replace(/[^a-z]/g,'').includes(font.family.toLowerCase().replace(/[^a-z]/g,''))),`${font.family} must render from its real custom font`);
 }
 assert.equal(requested.length,8);assert.equal(new Set(requested).size,8);assert.ok(!external.some(origin=>/googleapis|gstatic|fontsource|jsdelivr/.test(origin)));
 console.log('PASS eight real custom fonts, accurate specimens, on-demand local files, no font-arrival layout shift, unchanged UI typography');
 const viewport=page.locator('#types-explore-panel .palette-slider__viewport');
 await page.getByRole('button',{name:'Previous typefaces',exact:true}).click();
 await viewport.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
 await page.getByRole('button',{name:'Next typefaces',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#types-explore-panel .palette-slider__viewport').scrollLeft>0);
 const position=await viewport.evaluate(el=>el.scrollLeft);
 await nav.getByRole('button',{name:'Spaces',exact:true}).click();await types();
 await page.waitForFunction(position=>Math.abs(document.querySelector('#types-explore-panel .palette-slider__viewport').scrollLeft-position)<1,position);
 await viewport.focus();await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>document.querySelector('#types-explore-panel .palette-slider__viewport').scrollLeft<1);
 await page.getByRole('tab',{name:'Explore',selected:true,exact:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Preview DM Serif Display',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 await page.keyboard.press('Enter');await page.getByRole('tab',{name:'Edit',selected:true,exact:true}).waitFor();
 assert.equal(await page.locator('#types-detail-heading').textContent(),'DM Serif Display');assert.equal(await page.locator('#types-detail-heading').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.locator('.type-detail').getAttribute('data-font-status'),'loaded');
 await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('Sign in to see your saved typefaces.',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();assert.equal(await page.locator('#types-detail-heading').textContent(),'DM Serif Display');
 await nav.getByRole('button',{name:'Colors',exact:true}).click();assert.deepEqual(await colorState(),editedColor);
 await types();assert.equal(await page.getByRole('tab',{name:'Edit',selected:true,exact:true}).count(),1);assert.equal(await page.locator('#types-detail-heading').textContent(),'DM Serif Display');
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Preview Inter',exact:true}).click();assert.equal(await page.locator('#types-detail-heading').textContent(),'Inter');
 assert.equal(requested.length,8,'detail and return visits reuse loaded fonts');
 console.log('PASS keyboard selection, contextual Edit, local/main navigation preservation, independent unsaved Color workspace, and no duplicate font requests');
 for(const width of [1280,900,390,320])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:844});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} theme`,exact:true}).click();
  await page.getByRole('tab',{name:'Explore',exact:true}).click();await layout(`gallery-${width}-${theme}`);assert.equal(await columns(),width>1024?3:width>700?2:1);
  await page.screenshot({path:join(artifacts,`gallery-${width}-${theme}.png`),fullPage:true});
  await page.getByRole('tab',{name:'Edit',exact:true}).click();await layout(`detail-${width}-${theme}`);
  await page.screenshot({path:join(artifacts,`detail-${width}-${theme}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1280,height:1000});await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await page.evaluate(()=>document.documentElement.style.zoom='2');await layout('gallery-200%-zoom');
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await layout('detail-200%-zoom');await page.evaluate(()=>document.documentElement.style.zoom='');
 assert.equal(await page.getByRole('slider').count(),1);assert.equal(await page.getByRole('combobox').count(),0);assert.equal(await page.getByRole('button',{name:'Save typeface',exact:true}).isEnabled(),true);
 console.log('PASS shared three/two/one-card slider layouts, themes, mobile, 200% zoom, one document scroll and fixed navigation');
 const failedContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await failedContext.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==new URL(base).origin)return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  return url.pathname.includes('/fonts/specimens/')&&url.pathname.endsWith('.woff2')?route.abort('failed'):route.continue();
 });
 const failed=await failedContext.newPage();failed.on('pageerror',error=>errors.push(error.message));await failed.goto(base);
 await failed.getByRole('navigation',{name:'Design exploration'}).getByRole('button',{name:'Types',exact:true}).click();
 await failed.locator('.type-specimen[data-font-status="unavailable"]').first().waitFor();
 assert.ok(await failed.getByText('Font unavailable. Showing a serif fallback.',{exact:true}).first().isVisible());
 await failed.getByRole('button',{name:'Preview DM Serif Display',exact:true}).click();await failed.locator('.type-detail[data-font-status="unavailable"]').waitFor();assert.equal(await failed.locator('#types-detail-heading').textContent(),'DM Serif Display');
 assert.ok(await failed.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await failed.screenshot({path:join(artifacts,'fallback-mobile.png'),fullPage:true});await failedContext.close();
 assert.deepEqual(errors,[]);await rm(join(artifacts,'failure.png'),{force:true});
 console.log(`PASS graceful font failure and accessible fallback preview, no browser exceptions; screenshots: ${artifacts}`);
} catch(error){await page.screenshot({path:join(artifacts,'failure.png'),fullPage:true});throw error;}
finally{await browser.close();}
