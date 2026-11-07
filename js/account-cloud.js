/* Supabase browser adapter. It deliberately accepts only the public
   publishable/anon key; privileged operations live in the Edge Function.
*/
(function () {
  const config = window.ACADELY_SUPABASE_CONFIG || {};
  const configured = config.configured === true;
  let client = null;
  let authSubscription = null;
  let rememberSession = true;

  try { rememberSession = localStorage.getItem('acadely-auth-persistence') !== 'session'; } catch { /* Optional preference. */ }

  const storage = {
    getItem(key) {
      try { return (rememberSession ? localStorage : sessionStorage).getItem(key); } catch { return null; }
    },
    setItem(key, value) {
      try {
        const target = rememberSession ? localStorage : sessionStorage;
        const other = rememberSession ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
      } catch { /* Auth remains active for this page; persistence may be blocked. */ }
    },
    removeItem(key) {
      try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* Ignore blocked storage. */ }
    },
  };

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Acadely could not start the account service. Reload the page and try again.'));
      script.onerror = () => reject(new Error('The account library could not load. Check your connection and try again.'));
      document.head.append(script);
    });
  }

  async function initialize(onAuthStateChange) {
    if (!configured) return { configured: false, session: null };
    const sdk = await loadSdk();
    client = sdk.createClient(config.url.replace(/\/$/, ''), config.publishableKey, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 2 } },
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const result = client.auth.onAuthStateChange((event, session) => {
      queueMicrotask(() => onAuthStateChange(event, session));
    });
    authSubscription = result.data.subscription;
    return { configured: true, session: data.session };
  }

  async function signUp({ fullName, email, password, emailRedirectTo }) {
    return client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo },
    });
  }

  async function signIn({ email, password, remember }) {
    setRemember(remember);
    return client.auth.signInWithPassword({ email, password });
  }

  function setRemember(remember) {
    rememberSession = Boolean(remember);
    try { localStorage.setItem('acadely-auth-persistence', rememberSession ? 'persistent' : 'session'); } catch { /* The choice is effective for this tab. */ }
  }

  async function sendPasswordReset(email, redirectTo) {
    return client.auth.resetPasswordForEmail(email, { redirectTo });
  }

  async function resendSignupConfirmation(email, emailRedirectTo) {
    return client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
  }

  async function updatePassword(password) {
    return client.auth.updateUser({ password });
  }

  async function updateEmail(email, emailRedirectTo) {
    return client.auth.updateUser({ email }, { emailRedirectTo });
  }

  async function signOut() {
    return client.auth.signOut({ scope: 'local' });
  }

  async function deleteAccount() {
    return client.functions.invoke('delete-account', { method: 'POST' });
  }

  async function loadWorkspace() {
    const { data, error } = await client.from('student_workspaces').select('data,revision,updated_at').maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveWorkspace(data, expectedRevision) {
    const { data: result, error } = await client.rpc('save_student_workspace', {
      p_data: data,
      p_expected_revision: expectedRevision,
    });
    if (error) throw error;
    return Array.isArray(result) ? result[0] : result;
  }

  function subscribeWorkspace(userId, onChange) {
    return client.channel(`acadely-workspace-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'student_workspaces', filter: `user_id=eq.${userId}`,
      }, onChange)
      .subscribe();
  }

  async function updateProfileName(userId, fullName) {
    const { error } = await client.from('acadely_profiles').upsert({ user_id: userId, full_name: fullName });
    if (error) throw error;
  }

  function closeRealtime() {
    if (client) client.removeAllChannels();
  }

  window.AcadelyCloudService = {
    configured, initialize, signUp, signIn, setRemember, sendPasswordReset, resendSignupConfirmation,
    updatePassword, updateEmail, signOut, deleteAccount, loadWorkspace,
    saveWorkspace, subscribeWorkspace, updateProfileName, closeRealtime,
  };
})();
