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

test('collaboration migration enforces same-trip links and role-dependent viewer actions', () => {
  const sql = readSql('add_collaboration_offline_sharing.sql');
  const schema = readSql('schema.sql');
  for (const table of ['trip_tasks', 'trip_polls', 'trip_poll_options', 'trip_poll_votes', 'trip_comments', 'trip_notifications', 'trip_public_shares']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /task activity must belong to the same trip/);
  assert.match(sql, /poll option must belong to the same trip/);
  assert.match(sql, /comment target must belong to the same trip/);
  assert.match(sql, /mentioned user must be an active trip member/);
  assert.match(sql, /viewer_can_update_assigned_tasks/);
  assert.match(sql, /s\.trip_id = trip_poll_votes\.trip_id/);
  assert.match(sql, /s\.trip_id = trip_comments\.trip_id/);
  assert.match(sql, /only trip managers can reopen a poll/);
  assert.match(sql, /only trip managers can delete a poll that has votes/);
});

test('public sharing only exposes an allowlisted security-definer RPC', () => {
  const sql = readSql('add_collaboration_offline_sharing.sql');
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /encode\(digest\(p_token, 'sha256'\), 'hex'\)/);
  assert.match(sql, /returns jsonb language plpgsql security definer/);
  assert.match(sql, /revoke all on function public\.get_public_trip_share\(text\) from public/);
  assert.match(sql, /grant execute on function public\.get_public_trip_share\(text\) to anon, authenticated/);
  assert.doesNotMatch(sql, /create policy[^;]+on public\.trip_public_shares[^;]+to anon/);
  for (const forbidden of ['expenses', 'memberships', 'trip_tasks', 'trip_comments', 'trip_notifications']) {
    const rpc = sql.slice(sql.indexOf('create or replace function public.get_public_trip_share'));
    assert.doesNotMatch(rpc, new RegExp(`from public\\.${forbidden}\\b`));
  }
});

test('target deletion removes only the matching comment thread', () => {
  const sql = readSql('add_collaboration_offline_sharing.sql');
  assert.match(sql, /delete from public\.trip_comments\s+where target_type = tg_argv\[0\] and target_id = old\.id/);
  for (const target of ['activities', 'expenses', 'saved_places', 'photos', 'trip_tasks', 'trip_polls']) {
    assert.match(sql, new RegExp(`create trigger ${target}_delete_comments`));
  }
});
