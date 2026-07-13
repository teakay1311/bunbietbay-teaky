import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const readSql = (name: string) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8').toLowerCase();

test('entity-link migration keeps nullable foreign keys and same-trip guards', () => {
  const sql = readSql('add_trip_entity_links.sql');
  for (const column of ['source_notebook_place_id', 'activity_id', 'place_id']) assert.match(sql, new RegExp(column));
  assert.match(sql, /on delete set null/);
  assert.match(sql, /validate_trip_entity_links/);
  assert.match(sql, /place\.trip_id = new\.trip_id/);
  assert.match(sql, /activity\.trip_id = new\.trip_id/);
  assert.match(sql, /add_library_place_to_trip/);
});

test('preference and notebook migration enforces per-user RLS and role matrix', () => {
  const sql = readSql('add_preferences_and_notebook_permissions.sql');
  const schema = readSql('schema.sql');
  assert.match(sql, /create table if not exists public\.user_preferences/);
  assert.match(sql, /create table if not exists public\.trip_notification_preferences/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /membership\.role in \('owner', 'admin'\)/);
  assert.match(sql, /role <> 'owner'/);
  assert.match(schema, /public\.is_notebook_editor/);
  assert.match(schema, /editors can manage notebook places/);
  assert.match(sql, /transfer_notebook_ownership/);
  assert.match(sql, /set role = 'owner'/);
  assert.match(sql, /validate_notebook_owner_change/);
  assert.match(sql, /ownership must be transferred with the ownership rpc/);
});

test('invitation RPC reactivates revoked trip membership without duplication', () => {
  const sql = readSql('accept_invitation_function.sql');
  assert.match(sql, /on conflict \(trip_id, user_id\)/);
  assert.match(sql, /revoked_at = null/);
  assert.match(sql, /lower\(email\) = lower/);
});

test('owner membership migration restores creators and blocks owner mutation', () => {
  const sql = readSql('protect_owner_memberships.sql');
  const schema = readSql('schema.sql');
  assert.match(sql, /on conflict \(trip_id, user_id\) do update/);
  assert.match(sql, /set role = 'owner', revoked_at = null/);
  assert.match(sql, /role <> 'owner'/);
  assert.match(sql, /membership\.user_id <> trip\.created_by/);
  assert.match(schema, /role = 'owner' and user_id = auth\.uid\(\)/);
  assert.match(schema, /role <> 'owner' and \(public\.is_notebook_manager/);
});
