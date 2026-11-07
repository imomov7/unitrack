import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === 'https://imomov7.github.io' || /^http:\/\/localhost(?::\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://imomov7.github.io',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: string, status: number, headers: Record<string, string>) {
  return new Response(body, { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return jsonResponse(JSON.stringify({ error: 'Method not allowed.' }), 405, headers);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse(JSON.stringify({ error: 'Sign in is required.' }), 401, headers);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return jsonResponse(JSON.stringify({ error: 'Account deletion is not configured.' }), 503, headers);
  }

  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return jsonResponse(JSON.stringify({ error: 'Your session is invalid. Sign in again.' }), 401, headers);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return jsonResponse(JSON.stringify({ error: 'Account deletion failed. Your data has not been removed.' }), 500, headers);
  return jsonResponse(JSON.stringify({ deleted: true }), 200, headers);
});
