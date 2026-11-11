import assert from 'node:assert/strict';
import {readFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
const {chromium}=await import(process.env.NUANCE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.NUANCE_BASE_URL||'http://127.0.0.1:5176',artifacts='/private/tmp/nuance-typeface-favorites-review';await mkdir(artifacts,{recursive:true});
const fonts=JSON.parse(await readFile('src/nuance/data/typefaces/v1/registry.json','utf8'));
const makeUser=(id,name)=>({id,aud:'authenticated',role:'authenticated',email:`${name.toLowerCase()}@example.com`,app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:name},identities:[],created_at:new Date().toISOString()});
const alice=makeUser('11111111-1111-4111-8111-111111111111','Alice'),bob=makeUser('22222222-2222-4222-8222-222222222222','Bob');
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session=user=>({access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.test`,refresh_token:`refresh-${user.id}`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user});
const browser=await chromium.launch({executablePath:process.env.NUANCE_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[],libraries=new Map([[alice.id,[]],[bob.id,[]]]);let posts=0,colorPosts=0,failSave=false,failDelete=false,failLoad=false,holdOwner=null,releaseRead;
page.on('pageerror',error=>errors.push(error.message));
function principal(request){try{return JSON.parse(Buffer.from(request.headers().authorization.split(' ')[1].split('.')[1],'base64url').toString()).sub;}catch{return null;}}
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());if(url.origin===new URL(base).origin)return route.continue();
 const owner=principal(request),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 const reply=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(url.pathname.endsWith('/token')){const body=request.postDataJSON();return reply(session(body.email===bob.email?bob:alice));}
 if(url.pathname.endsWith('/user'))return reply(owner===bob.id?bob:alice);
 if(url.pathname.endsWith('/logout'))return route.fulfill({status:204,headers});
 if(url.pathname.endsWith('/profiles'))return reply([{id:owner,display_name:owner===bob.id?'Bob':'Alice'}]);
 if(url.pathname.endsWith('/compositions')){if(request.method()==='POST')colorPosts++;return reply([]);}
 if(url.pathname.endsWith('/typeface_favorites')){
  assert.ok(owner,'all font-library operations require an authenticated owner');
  if(request.method()==='POST'){
   posts++;if(failSave){failSave=false;return reply({message:'Temporary typeface save failure'},500);}
   const row=request.postDataJSON();assert.equal(row.owner_id,owner);
   const existing=libraries.get(owner);if(existing.length>=8&&!existing.some(item=>item.font_id===row.font_id))return reply({message:'You can save up to eight typefaces.'},400);
   const record={...row,updated_at:new Date().toISOString()};libraries.set(owner,[record,...existing.filter(item=>item.font_id!==row.font_id)]);return reply(record);
  }
  assert.equal(url.searchParams.get('owner_id'),`eq.${owner}`);
  if(request.method()==='DELETE'){
   if(failDelete){failDelete=false;return reply({message:'Temporary typeface delete failure'},500);}
   const id=url.searchParams.get('font_id').slice(3);libraries.set(owner,libraries.get(owner).filter(item=>item.font_id!==id));return reply({});
  }
  if(failLoad)return reply({message:'Temporary typeface library failure'},500);
  const snapshot=structuredClone(libraries.get(owner));if(holdOwner===owner)await new Promise(resolve=>{releaseRead=resolve;});return reply(snapshot);
 }
 return route.abort();
});
const nav=()=>page.getByRole('navigation',{name:'Design exploration'});
const enterTypes=()=>nav().getByRole('button',{name:'Types',exact:true}).click();
async function choose(font){await page.getByRole('tab',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:`Preview ${font.family}`,exact:true}).click();}
async function save(){await page.getByRole('button',{name:'Save typeface',exact:true}).click();await page.getByText('Typeface saved to your account.',{exact:true}).waitFor();}
async function login(user,open=true){
 if(open)await page.locator('.nuance-header').getByRole('button',{name:'Sign in',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Email',{exact:true}).fill(user.email);await dialog.getByLabel('Password',{exact:true}).fill('password1234');await dialog.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Open your profile',exact:true}).waitFor();await page.keyboard.press('Escape');
}
try{
 await page.goto(base);await enterTypes();await choose(fonts[0]);await page.getByRole('button',{name:'Save typeface',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(posts,0);
 await login(alice,false);assert.equal(await page.locator('#types-detail-heading').textContent(),fonts[0].family);
 await save();assert.equal(libraries.get(alice.id).length,1);await save();assert.equal(libraries.get(alice.id).length,1);
 await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('1 / 8 saved',{exact:true}).waitFor();
 await page.locator('#types-saved-panel').getByRole('button',{name:`Preview ${fonts[0].family}`,exact:true}).click();assert.equal(await page.locator('#types-detail-heading').textContent(),fonts[0].family);
 await page.reload();await enterTypes();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('1 / 8 saved',{exact:true}).waitFor();
 const inter=fonts.find(font=>font.id==='google-fonts:inter');
 await choose(inter);await page.getByRole('button',{name:/^Font weight:/}).click();await page.getByRole('button',{name:'Show alphabet',exact:true}).click();
 await save();assert.equal(libraries.get(alice.id).find(row=>row.font_id===inter.id).font_weight,500);assert.equal(libraries.get(alice.id).find(row=>row.font_id===inter.id).alphabet,true);
 await page.reload();await enterTypes();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('2 / 8 saved',{exact:true}).waitFor();
 const savedInter=page.locator(`#types-saved-panel [data-font-id="${inter.id}"]`);
 assert.equal(await savedInter.locator('.type-specimen__quote-caption').count(),0);
 assert.match(await savedInter.locator('.type-specimen__quote-text').textContent(),/^AaBbCcDd/);
 assert.equal(await savedInter.locator('.type-specimen__quote-text').evaluate(el=>Number(getComputedStyle(el).fontWeight)),500);
 await savedInter.getByRole('button',{name:`Preview ${inter.family}`,exact:true}).click();
 assert.equal(await page.getByRole('slider',{name:'Alphabet size',exact:true}).count(),1);
 assert.match(await page.getByRole('button',{name:/^Font weight:/}).getAttribute('aria-label'),/Medium \(500\)/);
 await page.getByRole('button',{name:'Edit text',exact:true}).click();
 await page.getByRole('textbox',{name:'Specimen text',exact:true}).fill('Custom <type> specimen\nSecond line');
 assert.equal(await page.locator('#types-edit-panel .type-specimen__quote-caption').count(),0);
 await save();
 const customRow=libraries.get(alice.id).find(row=>row.font_id===inter.id);
 assert.equal(customRow.custom,true);assert.equal(customRow.custom_text,'Custom <type> specimen\nSecond line');
 await page.reload();await enterTypes();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('2 / 8 saved',{exact:true}).waitFor();
 assert.equal(await savedInter.locator('.type-specimen__quote-text').textContent(),'Custom <type> specimen\nSecond line');
 assert.equal(await savedInter.locator('.type-specimen__quote-caption').count(),0);
 await savedInter.getByRole('button',{name:`Preview ${inter.family}`,exact:true}).click();
 await page.getByRole('button',{name:'Edit custom text',exact:true}).press('Enter');
 await page.getByRole('textbox',{name:'Specimen text',exact:true}).press('Control+Enter');
 assert.equal(await page.getByRole('slider',{name:'Custom text size',exact:true}).count(),1);
 assert.equal(await page.locator('#types-edit-panel .type-specimen__quote-text').evaluate(el=>getComputedStyle(el).letterSpacing),'1px');
 await page.getByRole('button',{name:'Show quote',exact:true}).click();await page.getByRole('button',{name:/^Font weight:/}).click();
 await save();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('2 / 8 saved',{exact:true}).waitFor();
 assert.equal(libraries.get(alice.id).find(row=>row.font_id===inter.id).font_weight,600);assert.equal(libraries.get(alice.id).find(row=>row.font_id===inter.id).alphabet,false);
 assert.equal(await savedInter.locator('.type-specimen__quote-caption').count(),1);
 console.log('PASS saved weight and alphabet settings survive reload, render in Saved, restore in Edit, and update without duplicates');
 for(const font of fonts.slice(1,8)){await choose(font);await save();}
 assert.equal(libraries.get(alice.id).length,8);await save();assert.equal(libraries.get(alice.id).length,8);
 await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('8 / 8 saved',{exact:true}).waitFor();assert.equal(await page.locator('#types-saved-panel [data-delete-typeface]').count(),8);
 const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));assert.equal(new Set(ids).size,ids.length,'classification IDs remain unique between Explore and Saved');
 console.log('PASS guest sign-in retains selection, real account saves, duplicate upserts, eight favorites, reopening and reload persistence');
 page.on('dialog',dialog=>dialog.accept());failDelete=true;
 await page.locator('#types-saved-panel [data-delete-typeface]').first().click();await page.getByRole('alert').filter({hasText:'Temporary typeface delete failure'}).waitFor();assert.equal(libraries.get(alice.id).length,8);
 const deleted=await page.locator('#types-saved-panel [data-delete-typeface]').first().getAttribute('data-delete-typeface');await page.locator('#types-saved-panel [data-delete-typeface]').first().click();await page.getByText('7 / 8 saved',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#types-saved-panel [data-delete-typeface]')===document.activeElement);
 await choose(fonts.find(font=>font.id===deleted));failSave=true;await page.getByRole('button',{name:'Save typeface',exact:true}).click();await page.getByText('Temporary typeface save failure',{exact:true}).waitFor();assert.equal(libraries.get(alice.id).length,7);
 await save();assert.equal(libraries.get(alice.id).length,8);assert.equal(colorPosts,0);
 await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('8 / 8 saved',{exact:true}).waitFor();
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const sizing=await page.locator('#types-saved-panel .saved-gallery__item').evaluateAll(items=>items.map(item=>({cell:item.getBoundingClientRect().width,specimen:item.querySelector('.type-specimen').getBoundingClientRect().width,quoteWidth:item.querySelector('.type-specimen__quote-text').getBoundingClientRect().width})));
  for(const item of sizing){assert.ok(Math.abs(item.cell-item.specimen)<1,'saved typeface must fill its grid cell');assert.ok(item.quoteWidth<=item.specimen+1,'the quote must fit within its specimen');}await page.screenshot({path:join(artifacts,`saved-${width}.png`),fullPage:true});}
 console.log('PASS delete/save failures preserve records, retry works, deletion frees a slot and restores focus, responsive saved gallery, Color storage untouched');
 // Hold an old account's request while signing out and into another account.
 holdOwner=alice.id;await page.reload();await page.getByRole('button',{name:'Open your profile',exact:true}).waitFor();
 await page.getByRole('button',{name:'Open your profile',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('.nuance-header').getByRole('button',{name:'Sign in',exact:true}).waitFor();await page.keyboard.press('Escape');
 await enterTypes();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('Sign in to see your saved typefaces.',{exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Edit',exact:true}).count(),0);
 await login(bob);await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('0 / 8 saved',{exact:true}).waitFor();
 holdOwner=null;releaseRead?.();await choose(fonts[1]);await save();assert.equal(libraries.get(bob.id).length,1);assert.equal(libraries.get(alice.id).length,8);
 await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByText('1 / 8 saved',{exact:true}).waitFor();assert.equal(await page.locator('#types-saved-panel .saved-gallery__item').count(),1);
 failLoad=true;await page.reload();await page.getByRole('heading',{name:'Color',exact:true}).waitFor();assert.ok(await page.locator('.palette-card').count()>0);await enterTypes();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByRole('alert').filter({hasText:'Temporary typeface library failure'}).waitFor();
 failLoad=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('1 / 8 saved',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);await rm(join(artifacts,'failure.png'),{force:true});console.log('PASS sign-out/account isolation, stale-response protection and font-load failure isolation from Colors; no browser exceptions');
}catch(error){await page.screenshot({path:join(artifacts,'failure.png'),fullPage:true});throw error;}
finally{releaseRead?.();await browser.close();}
