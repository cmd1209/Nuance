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
  assert.equal((await db.query('select saved_composition_count from public.profiles')).rows[0].saved_composition_count,8);
  await assert.rejects(db.query('update public.profiles set saved_typeface_count=0'),/permission denied/);
  await assert.rejects(db.query('select public.nuance_typeface_quota()'),/permission denied/);
  await db.query("delete from public.typeface_favorites where font_id='google-fonts:test-7'");await save(alice,'google-fonts:replacement');
  await assert.rejects(save(alice,'google-fonts:ninth'),/up to eight typefaces/);
  await asUser(bob);assert.equal((await db.query('select * from public.typeface_favorites')).rows.length,0);
  await assert.rejects(save(alice),/row-level security/);assert.equal((await db.query('delete from public.typeface_favorites returning font_id')).rows.length,0);
  await save(bob);assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,1);
  await assert.rejects(db.query('update public.typeface_favorites set owner_id=$1',[alice]),/row-level security/);
  await assert.rejects(db.query("insert into public.typeface_favorites values($1,'bad-font','google-fonts',1,now(),now())",[bob]),/check constraint/);
  await db.query('delete from public.typeface_favorites');assert.equal((await db.query('select saved_typeface_count from public.profiles')).rows[0].saved_typeface_count,0);
  await asUser(alice);assert.equal((await db.query('select * from public.typeface_favorites')).rows.length,8);assert.deepEqual((await db.query('select id,document from public.compositions order by id')).rows,colorsBefore);
  await db.exec('reset role;set role anon');for(const action of ['select * from','delete from'])await assert.rejects(db.query(action+' public.typeface_favorites'),/permission denied/);
 }finally{await db.close();}
});
