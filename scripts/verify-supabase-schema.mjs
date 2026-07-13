const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0 || process.env.VITE_REQUIRE_AUTH !== 'true') {
  throw new Error(`Vercel production thiếu cấu hình bắt buộc: ${[...missingEnv, ...(process.env.VITE_REQUIRE_AUTH === 'true' ? [] : ['VITE_REQUIRE_AUTH=true'])].join(', ')}`);
}

const checks = [
  ['trip_memberships', 'revoked_at'],
  ['saved_places', 'source_notebook_place_id'],
  ['activities', 'place_id,duration_minutes,travel_minutes_after'],
  ['expenses', 'activity_id,place_id'],
  ['photos', 'activity_id,place_id,content_hash,perceptual_hash,hash_version'],
  ['notebooks', 'id,name,type,created_by'],
  ['notebook_memberships', 'id,notebook_id,user_id,role'],
  ['notebook_places', 'id,notebook_id,updated_at'],
  ['notebook_invitations', 'id,notebook_id,status'],
  ['user_preferences', 'theme_mode,background_source,background_photo_id,background_image_url,background_provider_public_id'],
  ['trip_notification_preferences', 'use_defaults'],
  ['trip_collaboration_settings', 'trip_id,viewer_can_vote,viewer_can_comment,viewer_can_update_assigned_tasks'],
  ['trip_tasks', 'id,trip_id,status,assignee_id,updated_at'],
  ['trip_polls', 'id,trip_id,status,selection_mode,updated_at'],
  ['trip_poll_options', 'id,poll_id,trip_id'],
  ['trip_poll_votes', 'id,poll_id,option_id,user_id'],
  ['trip_comments', 'id,trip_id,target_type,target_id,deleted_at,updated_at'],
  ['trip_notifications', 'id,recipient_id,event_key,read_at'],
  ['trip_public_shares', 'id,trip_id,token_hash,scopes,expires_at,revoked_at'],
];

const failures = [];

for (const [table, select] of checks) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?select=${select}&limit=0`, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    failures.push(`${table} (${response.status}): ${detail}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Supabase schema preflight phát hiện ${failures.length} hạng mục chưa tương thích:\n${failures.join('\n')}`);
}

console.log('Supabase schema preflight passed.');
