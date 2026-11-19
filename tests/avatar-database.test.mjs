import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private avatar migration restricts all operations to the exact owner path', async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text references storage.buckets, name text, metadata jsonb, primary key (bucket_id, name));
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    await db.exec(await readFile('supabase/migrations/202611190001_private_avatars.sql', 'utf8'));
    const bucket = (await db.query('select * from storage.buckets')).rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 2097152);
    assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    async function asUser(id, role = 'authenticated') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec(`set role ${role}`);
    }
    await asUser(alice);
    await db.query("insert into storage.objects values ('avatars', $1, '{}')", [`${alice}/avatar`]);
    await db.query("update storage.objects set metadata = '{\"version\":2}' where name = $1", [`${alice}/avatar`]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await assert.rejects(db.query("insert into storage.objects values ('avatars', $1, '{}')", [`${alice}/other`]), /row-level security/);
    await asUser(bob);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects values ('avatars', $1, '{}')", [`${alice}/avatar2`]), /row-level security/);
    assert.equal((await db.query("update storage.objects set metadata = '{}' where name = $1 returning *", [`${alice}/avatar`])).rows.length, 0);
    assert.equal((await db.query('delete from storage.objects where name = $1 returning *', [`${alice}/avatar`])).rows.length, 0);
    await db.query("insert into storage.objects values ('avatars', $1, '{}')", [`${bob}/avatar`]);
    await assert.rejects(db.query('update storage.objects set name = $1 where name = $2', [`${alice}/avatar`, `${bob}/avatar`]), /row-level security/);
    await asUser('', 'anon');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects values ('avatars', $1, '{}')", [`${alice}/avatar`]), /row-level security/);
    await asUser(alice);
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 1);
    await asUser(bob);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
  } finally { await db.close(); }
});
