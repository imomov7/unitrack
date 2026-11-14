import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const adapterSource = await readFile(new URL('../js/account-cloud.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

function profileMergeFunction() {
  const match = appSource.match(/function mergedAccountStudentProfile\([\s\S]*?^\}/m);
  assert.ok(match, 'account profile merge helper exists');
  const sandbox = {
    defaults: () => ({ studentProfile: { fullName: '', studentId: '', university: '', major: '', academicYear: '', semester: '', email: '', profilePicture: '' } }),
  };
  return vm.runInNewContext(`(${match[0]})`, sandbox);
}

function createAccountHarness(initialUser = { id: 'student-1', email: 'student@example.com', user_metadata: { full_name: 'Jordan Student' } }) {
  const profiles = new Map();
  let authUser = structuredClone(initialUser);
  const authCallbacks = [];
  const client = {
    auth: {
      async getSession() { return { data: { session: { user: structuredClone(authUser) } }, error: null }; },
      async getUser() { return { data: { user: structuredClone(authUser) }, error: null }; },
      onAuthStateChange(callback) { authCallbacks.push(callback); return { data: { subscription: { unsubscribe() {} } } }; },
      async updateUser(attributes) {
        authUser = { ...authUser, user_metadata: { ...authUser.user_metadata, ...(attributes.data || {}) } };
        for (const callback of authCallbacks) callback('USER_UPDATED', { user: structuredClone(authUser) });
        return { data: { user: structuredClone(authUser) }, error: null };
      },
    },
    from(table) {
      let values = null;
      let filter = null;
      let ignoreDuplicates = false;
      let isUpdate = false;
      const builder = {
        select() { return builder; },
        eq(column, value) { filter = [column, value]; return builder; },
        upsert(record, options = {}) { values = structuredClone(record); ignoreDuplicates = options.ignoreDuplicates === true; return builder; },
        update(record) { values = structuredClone(record); isUpdate = true; return builder; },
        maybeSingle() { return Promise.resolve({ data: profiles.get(filter?.[1]) || null, error: null }); },
        single() { return Promise.resolve({ data: execute(), error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: execute(), error: null }).then(resolve, reject); },
      };
      function execute() {
        if (table !== 'acadely_profiles') return null;
        const id = filter?.[1] || values?.user_id;
        const existing = profiles.get(id);
        if (isUpdate && existing) {
          const updated = { ...existing, ...values };
          profiles.set(id, updated);
          return updated;
        }
        if (!existing || !ignoreDuplicates) profiles.set(id, { ...existing, ...values });
        return profiles.get(id);
      }
      return builder;
    },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    async removeAllChannels() {},
  };
  const sandbox = {
    window: { ACADELY_SUPABASE_CONFIG: { configured: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }, supabase: { createClient: () => client } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {}, queueMicrotask,
  };
  vm.runInNewContext(adapterSource, sandbox);
  return { service: sandbox.window.AcadelyCloudService, profiles, getAuthUser: () => authUser };
}

test('creates one profile from authenticated name and email and does not duplicate it', async () => {
  const { service, profiles, getAuthUser } = createAccountHarness();
  await service.initialize(() => {});
  const user = getAuthUser();
  const first = await service.getOrCreateProfile(user);
  const second = await service.getOrCreateProfile(user);
  assert.equal(first.user_id, 'student-1');
  assert.equal(first.full_name, 'Jordan Student');
  assert.equal(first.email, 'student@example.com');
  assert.equal(second.full_name, 'Jordan Student');
  assert.equal(profiles.size, 1);
});

test('preserves a saved name while refreshing email from authenticated user information', async () => {
  const { service, profiles, getAuthUser } = createAccountHarness({ id: 'student-2', email: 'new@example.com', user_metadata: { full_name: 'New Auth Name' } });
  profiles.set('student-2', { user_id: 'student-2', full_name: 'Saved Profile Name', email: 'old@example.com', student_data: { major: 'Physics' } });
  await service.initialize(() => {});
  const profile = await service.getOrCreateProfile(getAuthUser());
  assert.equal(profile.full_name, 'Saved Profile Name');
  assert.equal(profile.email, 'new@example.com');
  assert.equal(profile.student_data.major, 'Physics');
  assert.equal(profiles.size, 1);
});

test('profile edits update Auth metadata and the same user profile record', async () => {
  const { service, profiles, getAuthUser } = createAccountHarness();
  await service.initialize(() => {});
  await service.getOrCreateProfile(getAuthUser());
  const result = await service.saveStudentProfile('student-1', {
    fullName: 'Jordan S.', studentId: 'UID-7', university: 'Example University', campus: 'Main campus', major: 'Math',
    academicYear: 'Second year', semester: 'Spring', profilePicture: 'data:image/jpeg;base64,AAAA',
  });
  assert.equal(result.user.user_metadata.full_name, 'Jordan S.');
  assert.equal(result.profile.full_name, 'Jordan S.');
  assert.equal(result.profile.email, 'student@example.com');
  assert.equal(result.profile.student_data.studentId, 'UID-7');
  assert.equal(result.profile.student_data.major,'Math');
  assert.equal(result.profile.student_data.campus,'Main campus');
  assert.equal(result.profile.student_data.profilePicture, 'data:image/jpeg;base64,AAAA');
  await assert.rejects(() => service.saveStudentProfile('someone-else', { fullName: 'Nope' }), /account changed/);
  assert.equal(getAuthUser().user_metadata.full_name,'Jordan S.');
});

test('profile table schema is protected by user-scoped RLS policies and has one row per user', async () => {
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(schema, /alter table public\.acadely_profiles enable row level security/i);
  assert.match(schema, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(schema, /add column if not exists email text not null default ''/i);
  assert.match(schema, /add column if not exists student_data jsonb not null default '\{\}'::jsonb/i);
});

test('registration name and authenticated email automatically populate the student profile', () => {
  const mergeProfile = profileMergeFunction();
  const profile = mergeProfile(
    { id: 'student-3', email: 'new@example.com', user_metadata: { full_name: 'Taylor Student' } },
    { full_name: 'Taylor Student', email: 'new@example.com', student_data: {} },
    { fullName: '', email: '', studentId: '', university: '', major: '', academicYear: '', semester: '' },
  );
  assert.equal(profile.fullName, 'Taylor Student');
  assert.equal(profile.email, 'new@example.com');
});

test('existing profile names and optional student details are retained on login', () => {
  const mergeProfile = profileMergeFunction();
  const profile = mergeProfile(
    { id: 'student-4', email: 'verified@example.com', user_metadata: { full_name: 'Changed Auth Name' } },
    { full_name: 'Saved Profile Name', email: 'verified@example.com', student_data: { university: 'Example U', major: 'Chemistry' } },
    { fullName: 'Old workspace name', email: 'old@example.com', university: '', major: '', studentId: '', academicYear: '', semester: '' },
  );
  assert.equal(profile.fullName, 'Saved Profile Name');
  assert.equal(profile.email, 'verified@example.com');
  assert.equal(profile.university, 'Example U');
  assert.equal(profile.major, 'Chemistry');
});
