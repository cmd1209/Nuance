// Verifies separate static-weight files and new classifications in a real browser.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.NUANCE_BASE_URL||'http://127.0.0.1:5176';
const fonts=JSON.parse(await readFile('src/nuance/data/typefaces/v1/registry.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const requests=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin!==new URL(base).origin)return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(url.pathname.endsWith('.woff2'))requests.push(url.pathname);
 return route.continue();
});
try{
 await page.goto(base);
 await page.getByRole('navigation',{name:'Design exploration'}).getByRole('button',{name:'Types',exact:true}).click();
 assert.equal(await page.locator('#types-explore-panel .type-specimen').count(),30);
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 for(const font of fonts.filter(font=>font.loading.additionalFaces?.length)){
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await page.getByRole('button',{name:`Preview ${font.family}`,exact:true}).click();
  const original=new Set();
  for(let step=0;step<=font.availableWeights.length;step++){
   const weights=font.availableWeights,weight=weights[(weights.indexOf(400)+step)%weights.length];
   if(step)await page.getByRole('button',{name:/^Font weight:/}).click();
   await page.waitForFunction(({family,weight})=>[...document.fonts].some(face=>face.family.replace(/^"|"$/g,'')===family&&face.weight===String(weight)&&face.status==='loaded'),{family:font.loading.family,weight});
   const {root}=await cdp.send('DOM.getDocument');
   const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.type-detail .type-specimen__quote-text'});
   const used=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   const actual=used.fonts.find(face=>face.isCustomFont&&face.glyphCount>0);
   assert.ok(actual,`${font.family} ${weight} must use custom glyphs`);
   original.add(actual.postScriptName);
   assert.equal(await page.locator('.type-detail__artwork').evaluate(el=>Number(getComputedStyle(el).fontWeight)),weight);
  }
  assert.equal(original.size,font.availableWeights.length,`${font.family} weights must render from distinct real faces`);
  for(const asset of font.loading.additionalFaces)assert.equal(requests.filter(url=>url===asset.url).length,1);
  console.log(`PASS ${font.family}: all ${font.availableWeights.length} real weights, fetched once each`);
 }
 for(const id of ['inconsolata','source-code-pro','comfortaa','archivo-black']){
  const font=fonts.find(font=>font.id===`google-fonts:${id}`);
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await page.getByRole('button',{name:`Preview ${font.family}`,exact:true}).click();
  await page.locator('.type-detail[data-font-status="loaded"]').waitFor();
  const label=font.classification==='monospace'?'Monospace':font.classification==='display'?'Display':'Sans-serif';
  assert.ok((await page.locator('.type-detail .type-specimen__metadata').textContent()).includes(label));
  if(id==='archivo-black')assert.equal(await page.getByRole('button',{name:/^Font weight:/}).isEnabled(),false);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS Monospace/Display labels, single-weight controls and mobile wrapping');
}finally{await browser.close();}
