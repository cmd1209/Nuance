import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("account migration enforces ownership in PostgreSQL", async t => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  const composition = "33333333-3333-4333-8333-333333333333";
  try {
    // Reproduce Supabase's auth identity boundary; the migration itself is unmodified.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      insert into auth.users values ('${alice}'), ('${bob}');
    `);
    await db.exec(await readFile("supabase/migrations/202611020001_accounts.sql", "utf8"));
    async function asUser(id) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec("set role authenticated");
    }

    await t.test("owners can create and update their profile and composition", async () => {
      await asUser(alice);
      await db.query("insert into public.profiles (id, display_name) values ($1, 'Alice')", [alice]);
      await db.query("update public.profiles set display_name = 'A' where id = $1", [alice]);
      const profile = await db.query("select display_name from public.profiles");
      assert.equal(profile.rows[0].display_name, "A");
      const document = { id: composition, schemaVersion: 1, name: "First save" };
      await db.query("insert into public.compositions (owner_id, id, document) values ($1, $2, $3)", [alice, composition, JSON.stringify(document)]);
      document.name = "Updated save";
      await db.query(`insert into public.compositions (owner_id, id, document) values ($1, $2, $3)
        on conflict (owner_id, id) do update set document = excluded.document`, [alice, composition, JSON.stringify(document)]);
      const saved = await db.query("select document from public.compositions");
      assert.equal(saved.rows.length, 1);
      assert.equal(saved.rows[0].document.name, "Updated save");
    });

    await t.test("quota migration preserves existing work and initializes its counter", async () => {
      await db.exec("reset role");
      await db.exec(await readFile("supabase/migrations/202611030001_composition_limit_and_delete.sql", "utf8"));
      const counts = await db.query("select saved_composition_count from public.profiles where id = $1", [alice]);
      assert.equal(counts.rows[0].saved_composition_count, 1);
      assert.equal((await db.query("select id from public.compositions")).rows.length, 1);
    });

    await t.test("eight-save migration preserves four existing records and their protected counter", async () => {
      await asUser(alice);
      for (let index = 0; index < 3; index++) await insertComposition(alice);
      await assert.rejects(insertComposition(alice), /up to four compositions/);
      const before = (await db.query("select id, document from public.compositions order by id")).rows;
      await db.exec("reset role");
      await db.exec(await readFile("supabase/migrations/202611090001_eight_saved_compositions.sql", "utf8"));
      await asUser(alice);
      assert.deepEqual((await db.query("select id, document from public.compositions order by id")).rows, before);
      assert.equal((await db.query("select saved_composition_count from public.profiles")).rows[0].saved_composition_count, 4);
    });

    await t.test("another account cannot read, overwrite, or impersonate the owner", async () => {
      await asUser(bob);
      assert.equal((await db.query("select * from public.profiles")).rows.length, 0);
      assert.equal((await db.query("select * from public.compositions")).rows.length, 0);
      assert.equal((await db.query("update public.profiles set display_name = 'Stolen' returning id")).rows.length, 0);
      assert.equal((await db.query("update public.compositions set document = '{}' returning id")).rows.length, 0);
      await assert.rejects(db.query("insert into public.profiles (id) values ($1)", [alice]), /row-level security/);
      await assert.rejects(db.query("insert into public.compositions (owner_id, id, document) values ($1, $2, $3)",
        [alice, composition, JSON.stringify({ id: composition, schemaVersion: 1 })]), /row-level security/);
      assert.equal((await db.query("delete from public.compositions returning id")).rows.length, 0);
      await assert.rejects(db.query("delete from public.profiles"), /permission denied/);
    });

    await t.test("owners cannot transfer records or store inconsistent documents", async () => {
      await asUser(alice);
      await assert.rejects(db.query("update public.compositions set owner_id = $1", [bob]), /row-level security/);
      await assert.rejects(db.query("update public.profiles set id = $1", [bob]), /row-level security/);
      await assert.rejects(db.query("update public.compositions set document = $1", [JSON.stringify({ id: bob, schemaVersion: 1 })]), /check constraint/);
      await assert.rejects(db.query("update public.profiles set display_name = $1", ["x".repeat(81)]), /check constraint/);
    });

    async function insertComposition(owner, id = crypto.randomUUID()) {
      await db.query("insert into public.compositions (owner_id, id, document) values ($1, $2, $3)",
        [owner, id, JSON.stringify({ id, schemaVersion: 1 })]);
      return id;
    }

    await t.test("the ninth save is denied, updates at capacity work, and deleting frees one slot", async () => {
      await asUser(alice);
      for (let index = 0; index < 4; index++) await insertComposition(alice);
      await assert.rejects(insertComposition(alice), /up to eight compositions/);
      assert.equal((await db.query("select id from public.compositions")).rows.length, 8);
      await db.query(`insert into public.compositions (owner_id, id, document) values ($1, $2, $3)
        on conflict (owner_id, id) do update set owner_id = excluded.owner_id, id = excluded.id, document = excluded.document`,
        [alice, composition, JSON.stringify({ id: composition, schemaVersion: 1, name: "Updated at capacity" })]);
      assert.equal((await db.query("select saved_composition_count from public.profiles")).rows[0].saved_composition_count, 8);
      await db.query("delete from public.compositions where id = $1", [composition]);
      assert.equal((await db.query("select saved_composition_count from public.profiles")).rows[0].saved_composition_count, 7);
      await insertComposition(alice);
      await assert.rejects(insertComposition(alice), /up to eight compositions/);
    });

    await t.test("clients cannot falsify the quota counter and profile upserts preserve it", async () => {
      await asUser(alice);
      await assert.rejects(db.query("update public.profiles set saved_composition_count = 0"), /permission denied/);
      await assert.rejects(db.query("insert into public.profiles (id, saved_composition_count) values ($1, 0)", [alice]), /permission denied/);
      await db.query(`insert into public.profiles (id, display_name) values ($1, 'Alice updated')
        on conflict (id) do update set id = excluded.id, display_name = excluded.display_name`, [alice]);
      assert.equal((await db.query("select saved_composition_count from public.profiles")).rows[0].saved_composition_count, 8);
    });

    await t.test("quotas are per account and an owner can delete all their own compositions", async () => {
      await asUser(bob);
      for (let index = 0; index < 8; index++) await insertComposition(bob);
      await assert.rejects(insertComposition(bob), /up to eight compositions/);
      assert.equal((await db.query("delete from public.compositions returning id")).rows.length, 8);
      assert.equal((await db.query("select saved_composition_count from public.profiles")).rows[0].saved_composition_count, 0);
      await asUser(alice);
      assert.equal((await db.query("select id from public.compositions")).rows.length, 8);
    });

    await t.test("signed-out requests cannot access account tables", async () => {
      await db.exec("reset role; set role anon");
      for (const table of ["profiles", "compositions"]) {
        await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
        await assert.rejects(db.query(`delete from public.${table}`), /permission denied/);
      }
    });
  } finally { await db.close(); }
});

test("quota migration refuses excess existing saves without deleting data", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      insert into auth.users values ('${owner}');`);
    await db.exec(await readFile("supabase/migrations/202611020001_accounts.sql", "utf8"));
    for (let index = 0; index < 5; index++) {
      const id = crypto.randomUUID();
      await db.query("insert into public.compositions (owner_id, id, document) values ($1, $2, $3)",
        [owner, id, JSON.stringify({ id, schemaVersion: 1 })]);
    }
    await assert.rejects(db.exec(await readFile("supabase/migrations/202611030001_composition_limit_and_delete.sql", "utf8")), /more than four compositions/);
    await db.exec("rollback");
    assert.equal((await db.query("select id from public.compositions")).rows.length, 5);
    assert.equal((await db.query("select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'saved_composition_count'")).rows.length, 0);
  } finally { await db.close(); }
});
