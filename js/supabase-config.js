/* Public Supabase browser settings. The publishable/anon key is designed for
   client use; database security comes from the SQL policies, never this file.
   Fill these values only after creating the Supabase project. Never add a
   service-role key here.
*/
const acadelySupabaseUrl = 'https://qmbxadvkvrvkrtansink.supabase.co';
const acadelySupabasePublishableKey = 'sb_publishable_ZJQ_QNUV0CREQRQbS3bChw_6R_jUx8Q';
function acadelyIsPublicSupabaseKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (/^(sb_secret_|service_role)/i.test(value)) return false;
  const payload = String(value || '').split('.')[1];
  if (!payload || typeof atob !== 'function') return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).role === 'anon';
  } catch { return false; }
}
window.ACADELY_SUPABASE_CONFIG = Object.freeze({
  url: acadelySupabaseUrl,
  publishableKey: acadelySupabasePublishableKey,
  configured: /^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(acadelySupabaseUrl) && acadelyIsPublicSupabaseKey(acadelySupabasePublishableKey),
});
