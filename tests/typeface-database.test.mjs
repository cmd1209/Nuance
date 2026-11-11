import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('typeface favorites enforce private, independent eight-item quotas without changing color records',async()=>{
 const db=new PGlite(),alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated;insert into auth.users values('${alice}'),('${bob}');`);
  for(const file of ['202611020001_accounts.sql','202611030001_composition_limit_and_delete.sql','202611090001_eight_saved_compositions.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  async function asUser(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
  await asUser(alice);
  for(let i=0;i<8;i++){const id=crypto.randomUUID();await db.query('insert into public.compositions(owner_id,id,document)values($1,$2,$3)',[alice,id,JSON.stringify({id,schemaVersion:1,name:`Color ${i}`})]);}
  const colorsBefore=(await db.query('select id,document from public.compositions order by id')).rows;
  await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202611090002_typeface_favorites.sql','utf8'));await asUser(alice);
  assert.deepEqual((await db.query('select id,document from public.compositions order by id')).rows,colorsBefore);
  assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,0);
  const save=async(owner,font='google-fonts:inter')=>db.query(`insert into public.typeface_favorites(owner_id,font_id,source,registry_version)values($1,$2,'google-fonts',1)
   on conflict(owner_id,font_id)do update set source=excluded.source,registry_version=excluded.registry_version returning font_id,updated_at`,[owner,font]);
  await save(alice);await save(alice);assert.equal((await db.query('select * from public.typeface_favorites')).rows.length,1);
  for(let i=1;i<8;i++)await save(alice,`google-fonts:test-${i}`);
  await assert.rejects(save(alice,'google-fonts:ninth'),/up to eight typefaces/);
  await save(alice);assert.equal((await db.query('select saved_typeface_count,saved_composition_count from public.profiles')).rows[0].saved_typeface_count,8);
  await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202611100001_typeface_specimen_settings.sql','utf8'));await asUser(alice);
  await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202611110001_typeface_custom_text.sql','utf8'));await asUser(alice);
  const customDefaults=(await db.query('select custom,custom_text from public.typeface_favorites')).rows;
  assert.ok(customDefaults.every(row=>row.custom===false && row.custom_text===null));
  await db.query("update public.typeface_favorites set custom=true,custom_text=$1 where font_id='google-fonts:inter'",['Custom specimen\nSecond line']);
  assert.deepEqual((await db.query("select custom,custom_text from public.typeface_favorites where font_id='google-fonts:inter'")).rows,[{custom:true,custom_text:'Custom specimen\nSecond line'}]);
  await assert.rejects(db.query('update public.typeface_favorites set custom_text=$1',['x'.repeat(2001)]),/check constraint/);
  await assert.rejects(db.query('update public.typeface_favorites set custom=null'),/not-null constraint/);
  const legacy=(await db.query('select font_weight,alphabet from public.typeface_favorites')).rows;
  assert.equal(legacy.length,8);assert.ok(legacy.every(row=>row.font_weight===400 && row.alphabet===false));
  await db.query("update public.typeface_favorites set font_weight=600,alphabet=true where font_id='google-fonts:inter'");
  assert.deepEqual((await db.query("select font_weight,alphabet from public.typeface_favorites where font_id='google-fonts:inter'")).rows,[{font_weight:600,alphabet:true}]);
  assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,8,'editing settings at capacity does not consume another slot');
  await assert.rejects(db.query('update public.typeface_favorites set font_weight=450'),/check constraint/);
  await assert.rejects(db.query('update public.typeface_favorites set alphabet=null'),/not-null constraint/);
  assert.equal((await db.query('select saved_composition_count from public.profiles')).rows[0].saved_composition_count,8);
  await assert.rejects(db.query('update public.profiles set saved_typeface_count=0'),/permission denied/);
  await assert.rejects(db.query('select public.nuance_typeface_quota()'),/permission denied/);
  await db.query("delete from public.typeface_favorites where font_id='google-fonts:test-7'");await save(alice,'google-fonts:replacement');
  await assert.rejects(save(alice,'google-fonts:ninth'),/up to eight typefaces/);
  await asUser(bob);assert.equal((await db.query('select * from public.typeface_favorites')).rows.length,0);
  await assert.rejects(save(alice),/row-level security/);assert.equal((await db.query('delete from public.typeface_favorites returning font_id')).rows.length,0);
  await save(bob);assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,1);
  await assert.rejects(db.query('update public.typeface_favorites set owner_id=$1',[alice]),/row-level security/);
  await assert.rejects(db.query("insert into public.typeface_favorites(owner_id,font_id,source,registry_version) values($1,'bad-font','google-fonts',1)",[bob]),/check constraint/);
  await db.query('delete from public.typeface_favorites');assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,0);
  await asUser(alice);assert.equal((await db.query('select * from public.typeface_favorites')).rows.length,8);assert.deepEqual((await db.query('select id,document from public.compositions order by id')).rows,colorsBefore);
  await db.exec('reset role;set role anon');for(const action of ['select * from','delete from'])await assert.rejects(db.query(action+' public.typeface_favorites'),/permission denied/);
 }finally{await db.close();}
});
