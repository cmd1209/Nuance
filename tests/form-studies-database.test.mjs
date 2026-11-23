import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Form studies enforce private per-component quotas, atomic replacements and stable identities', async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated; insert into auth.users values('${alice}'),('${bob}');`);
    await db.exec(await readFile('supabase/migrations/202611020001_accounts.sql', 'utf8'));
    async function asUser(owner) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
      await db.exec('set role authenticated');
    }
    await asUser(alice);
    const colorId = crypto.randomUUID();
    await db.query('insert into public.compositions(owner_id,id,document) values($1,$2,$3)', [alice, colorId, JSON.stringify({ schemaVersion: 1, id: colorId, name: 'Untouched color' })]);
    const colorsBefore = (await db.query('select id,document from public.compositions')).rows;
    await db.exec('reset role');
    await db.exec(await readFile('supabase/migrations/202611230001_form_studies.sql', 'utf8'));
    await asUser(alice);
    const make = (setting = 'sizing', name = 'Sizing study') => ({ schemaVersion: 1, id: crypto.randomUUID(), setting, name,
      generatorVersion: 'monotone-cubic-v1', values: { maxSize: 128 }, resolvedTokens: [] });
    const insert = (owner, doc) => db.query('insert into public.form_studies(owner_id,id,setting,document) values($1,$2,$3,$4)', [owner, doc.id, doc.setting, JSON.stringify(doc)]);
    const studies = [make(), make(), make()];
    for (const study of studies) await insert(alice, study);
    await assert.rejects(insert(alice, make()), /up to three studies/);
    const updated = { ...studies[0], name: 'Replacement', values: { maxSize: 256 } };
    await db.query('update public.form_studies set document=$1 where id=$2', [JSON.stringify(updated), updated.id]);
    assert.deepEqual((await db.query('select document from public.form_studies where id=$1', [updated.id])).rows[0].document, updated);
    assert.equal((await db.query('select * from public.form_studies')).rows.length, 3);
    await insert(alice, make('radii', 'Radius'));
    await insert(alice, make('shadows', 'Shadow'));
    await assert.rejects(db.query('select * from public.form_study_quotas'), /permission denied/);
    await assert.rejects(db.query("update public.form_study_quotas set saved_count=0"), /permission denied/);
    await assert.rejects(db.query('select public.nuance_form_study_quota()'), /permission denied/);
    await assert.rejects(db.query('update public.form_studies set owner_id=$1', [bob]), /permission denied/);
    await assert.rejects(db.query("update public.form_studies set setting='radii'"), /permission denied/);
    await assert.rejects(db.query('update public.form_studies set document=$1 where id=$2', [JSON.stringify({ ...updated, id: crypto.randomUUID() }), updated.id]), /check constraint/);
    await db.query('delete from public.form_studies where id=$1', [studies[2].id]);
    await insert(alice, make());
    await assert.rejects(insert(alice, make()), /up to three studies/);
    await assert.rejects(insert(alice, { ...make('spacing'), name: '' }), /check constraint/);
    await asUser(bob);
    assert.equal((await db.query('select * from public.form_studies')).rows.length, 0);
    await assert.rejects(insert(alice, make()), /row-level security/);
    assert.equal((await db.query('delete from public.form_studies returning id')).rows.length, 0);
    for (let i = 0; i < 3; i++) await insert(bob, make());
    await assert.rejects(insert(bob, make()), /up to three studies/);
    assert.equal((await db.query('update public.form_studies set document=$1 where owner_id=$2 returning id', [JSON.stringify(updated), alice])).rows.length, 0);
    await asUser(alice);
    assert.deepEqual((await db.query('select id,document from public.compositions')).rows, colorsBefore);
    await db.exec('reset role');
    const quotas = (await db.query('select setting,saved_count from public.form_study_quotas where owner_id=$1 order by setting', [alice])).rows;
    assert.deepEqual(quotas, [{ setting: 'radii', saved_count: 1 }, { setting: 'shadows', saved_count: 1 }, { setting: 'sizing', saved_count: 3 }]);
    await db.query('delete from auth.users where id=$1', [bob]);
    assert.equal((await db.query('select * from public.form_studies where owner_id=$1', [bob])).rows.length, 0);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.form_studies'), /permission denied/);
    await assert.rejects(db.query('delete from public.form_studies'), /permission denied/);
  } finally { await db.close(); }
});
