const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0 || process.env.VITE_REQUIRE_AUTH !== 'true') {
  throw new Error(`Vercel production thiếu cấu hình bắt buộc: ${[...missingEnv, ...(process.env.VITE_REQUIRE_AUTH === 'true' ? [] : ['VITE_REQUIRE_AUTH=true'])].join(', ')}`);
}

const checks = [
  ['trip_memberships', 'revoked_at'],
  ['saved_places', 'source_notebook_place_id'],
  ['activities', 'place_id'],
  ['expenses', 'activity_id,place_id'],
  ['photos', 'activity_id,place_id'],
  ['notebooks', 'id,name,type,created_by'],
  ['notebook_memberships', 'id,notebook_id,user_id,role'],
  ['notebook_places', 'id,notebook_id,updated_at'],
  ['notebook_invitations', 'id,notebook_id,status'],
  ['user_preferences', 'theme_mode'],
  ['trip_notification_preferences', 'use_defaults'],
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
