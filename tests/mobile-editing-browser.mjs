import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.NUANCE_BASE_URL||'http://127.0.0.1:5176';
const artifacts='/private/tmp/nuance-mobile-editing-review';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
async function makePage(mobile){
 const context=await browser.newContext({viewport:{width:mobile?390:1280,height:844},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  // Deliberate test double: headless Chromium cannot open an iOS software keyboard.
  const viewport=new EventTarget();
  let testHeight;
  Object.defineProperty(viewport,'height',{get:()=>testHeight??innerHeight,set:value=>{testHeight=value;}});
  Object.assign(viewport,{offsetTop:0,offsetLeft:0,scale:1});
  Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
  window.testKeyboard=(height,offsetTop=0)=>{
   viewport.height=height;viewport.offsetTop=offsetTop;
   viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));
  };
 });
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.getByRole('heading',{name:'Color',exact:true}).waitFor();
 return page;
}
async function setKeyboard(page,height,top=0){await page.evaluate(({height,top})=>window.testKeyboard(height,top),{height,top});await page.evaluate(()=>new Promise(requestAnimationFrame));}
async function assertVisibleAboveKeyboard(page,locator){
 const rect=await locator.boundingBox();assert.ok(rect);
 const {height,offsetTop}=await page.evaluate(()=>({height:visualViewport.height,offsetTop:visualViewport.offsetTop}));
 assert.ok(rect.y>=offsetTop-1,`top ${rect.y} must be >= ${offsetTop}`);
 assert.ok(rect.y+rect.height<=offsetTop+height+1,`bottom ${rect.y+rect.height} must be <= ${offsetTop+height}`);
}
try{
 const page=await makePage(true),nav=page.getByRole('navigation',{name:'Design exploration'});
 await page.locator('.palette-card').first().click();
 await page.locator('.color-region__select').first().click();
 const dialog=page.getByRole('dialog',{name:'Adjust selected color'}),hex=page.getByLabel('HEX',{exact:true});
 assert.equal(await hex.evaluate(el=>el===document.activeElement),false,'opening color editor must not focus HEX on mobile');
 assert.equal(await dialog.evaluate(el=>el.parentElement.classList.contains('nuance-app')),true,'mobile editor is outside the clipped artwork');
 assert.equal(await nav.isVisible(),true);
 await hex.click();await setKeyboard(page,390);
 assert.equal(await nav.isVisible(),false);
 await assertVisibleAboveKeyboard(page,dialog);
 await assertVisibleAboveKeyboard(page,dialog.getByRole('button',{name:'Done',exact:true}));
 await hex.fill('#123456');
 await page.screenshot({path:`${artifacts}/color-keyboard.png`,clip:{x:0,y:0,width:390,height:390}});
 await dialog.getByRole('button',{name:'Done',exact:true}).tap();
 await dialog.waitFor({state:'hidden'});await setKeyboard(page,844);
 await nav.waitFor({state:'visible'});
 assert.ok((await page.locator('.color-region').evaluateAll(nodes=>nodes.map(node=>node.dataset.hex))).includes('#123456'));
 await nav.getByRole('button',{name:'Types',exact:true}).click();
 await page.getByRole('button',{name:'Preview PT Serif',exact:true}).click();
 await page.getByRole('button',{name:'Show alphabet',exact:true}).click();
 await page.getByRole('button',{name:'Edit text',exact:true}).click();
 const text=page.getByRole('textbox',{name:'Specimen text',exact:true}),done=page.locator('.type-specimen__finish-editing');
 await setKeyboard(page,360);
 assert.equal(await nav.isVisible(),false);
 await text.fill('A long editable specimen.\n'.repeat(35));
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 await assertVisibleAboveKeyboard(page,text);await assertVisibleAboveKeyboard(page,done);
 assert.ok(await text.evaluate(el=>el.scrollHeight>el.clientHeight),'long text scrolls inside available editing space');
 await text.press('Control+End');await text.press('ArrowRight');await text.press('x');
 assert.ok(await text.evaluate(el=>el.scrollTop+el.clientHeight>=el.scrollHeight-2),'typing at the end keeps the last line visible');
 await page.screenshot({path:`${artifacts}/text-keyboard.png`,clip:{x:0,y:0,width:390,height:360}});
 await setKeyboard(page,360,80);
 await assertVisibleAboveKeyboard(page,done);
 // Native keyboard dismissal may leave the field focused.
 await setKeyboard(page,844);await nav.waitFor({state:'visible'});
 assert.equal(await text.evaluate(el=>el===document.activeElement),true);
 await setKeyboard(page,360);await done.waitFor({state:'visible'});
 await done.tap();await text.waitFor({state:'hidden'});await setKeyboard(page,844);await nav.waitFor({state:'visible'});
 assert.ok((await page.getByRole('button',{name:'Edit custom text',exact:true}).textContent()).includes('A long editable specimen.'));
 console.log('PASS mobile color editor without autofocus, keyboard clearance, live HEX editing, long text scrolling, Done, viewport panning and navigation restoration');
 const desktop=await makePage(false);
 await desktop.locator('.palette-card').first().click();await desktop.locator('.color-region__select').first().click();
 assert.equal(await desktop.getByLabel('HEX',{exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.equal(await desktop.locator('.color-editor').evaluate(el=>getComputedStyle(el).position),'absolute');
 assert.equal(await desktop.getByRole('navigation',{name:'Design exploration'}).isVisible(),true);
 await desktop.getByRole('button',{name:'Close color editor',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('PASS desktop popover and keyboard focus preserved; no browser exceptions');
}catch(error){console.error(errors);throw error;}
finally{await browser.close();}
