-- Acadely account and cloud workspace schema.
-- Run once in Supabase SQL Editor. Academic records keep the existing
-- unitrack-data-v1 document shape in a private JSONB workspace so every
-- existing feature and JSON import/export remains compatible.

create table if not exists public.acadely_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"courses":[],"assignments":[],"assessments":[],"classes":[],"exams":[],"sessions":[],"events":[]}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint student_workspaces_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint student_workspaces_collections_are_arrays check (
    (not (data ? 'courses') or jsonb_typeof(data->'courses') = 'array') and
    (not (data ? 'assignments') or jsonb_typeof(data->'assignments') = 'array') and
    (not (data ? 'assessments') or jsonb_typeof(data->'assessments') = 'array') and
    (not (data ? 'classes') or jsonb_typeof(data->'classes') = 'array') and
    (not (data ? 'exams') or jsonb_typeof(data->'exams') = 'array') and
    (not (data ? 'sessions') or jsonb_typeof(data->'sessions') = 'array') and
    (not (data ? 'events') or jsonb_typeof(data->'events') = 'array')
  )
);

alter table public.acadely_profiles enable row level security;
alter table public.student_workspaces enable row level security;

revoke all on public.acadely_profiles from anon, authenticated;
revoke all on public.student_workspaces from anon, authenticated;
grant select, insert, update on public.acadely_profiles to authenticated;
grant select on public.student_workspaces to authenticated;

drop policy if exists "Students read their own profile" on public.acadely_profiles;
create policy "Students read their own profile" on public.acadely_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students create their own profile" on public.acadely_profiles;
create policy "Students create their own profile" on public.acadely_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students update their own profile" on public.acadely_profiles;
create policy "Students update their own profile" on public.acadely_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Students read their own workspace" on public.student_workspaces;
create policy "Students read their own workspace" on public.student_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students create their own workspace" on public.student_workspaces;
create policy "Students create their own workspace" on public.student_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students update their own workspace" on public.student_workspaces;
create policy "Students update their own workspace" on public.student_workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.acadely_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists acadely_profiles_updated_at on public.acadely_profiles;
create trigger acadely_profiles_updated_at before update on public.acadely_profiles
for each row execute function public.acadely_set_updated_at();
drop trigger if exists student_workspaces_updated_at on public.student_workspaces;
create trigger student_workspaces_updated_at before update on public.student_workspaces
for each row execute function public.acadely_set_updated_at();

create or replace function public.acadely_create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.acadely_profiles (user_id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists acadely_auth_user_profile on auth.users;
create trigger acadely_auth_user_profile after insert on auth.users
for each row execute function public.acadely_create_profile_for_new_user();

-- Compare-and-swap revisions prevent a stale phone/laptop from overwriting
-- another device's newer edit. Conflicts are returned to the client for review.
create or replace function public.save_student_workspace(p_data jsonb, p_expected_revision bigint)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  saved_revision bigint;
  saved_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data) <> 'object' then
    raise exception 'Workspace data must be a JSON object' using errcode = '22023';
  end if;
  if pg_column_size(p_data) > 1048576 then
    raise exception 'Workspace data is larger than the 1 MiB limit' using errcode = '22023';
  end if;
  if (p_data ? 'courses' and (jsonb_typeof(p_data->'courses') <> 'array' or jsonb_array_length(p_data->'courses') > 5000)) or
     (p_data ? 'assignments' and (jsonb_typeof(p_data->'assignments') <> 'array' or jsonb_array_length(p_data->'assignments') > 5000)) or
     (p_data ? 'assessments' and (jsonb_typeof(p_data->'assessments') <> 'array' or jsonb_array_length(p_data->'assessments') > 5000)) or
     (p_data ? 'classes' and (jsonb_typeof(p_data->'classes') <> 'array' or jsonb_array_length(p_data->'classes') > 5000)) or
     (p_data ? 'exams' and (jsonb_typeof(p_data->'exams') <> 'array' or jsonb_array_length(p_data->'exams') > 5000)) or
     (p_data ? 'sessions' and (jsonb_typeof(p_data->'sessions') <> 'array' or jsonb_array_length(p_data->'sessions') > 5000)) or
     (p_data ? 'events' and (jsonb_typeof(p_data->'events') <> 'array' or jsonb_array_length(p_data->'events') > 5000)) then
    raise exception 'Workspace collections must be arrays with at most 5000 records each' using errcode = '22023';
  end if;
  insert into public.student_workspaces (user_id, data, revision)
  values (auth.uid(), p_data, 1)
  on conflict (user_id) do nothing
  returning student_workspaces.revision, student_workspaces.updated_at
  into saved_revision, saved_at;
  if found then
    return query select saved_revision, saved_at;
    return;
  end if;
  update public.student_workspaces as workspace
  set data = p_data, revision = workspace.revision + 1
  where workspace.user_id = auth.uid()
    and workspace.revision = p_expected_revision
  returning workspace.revision, workspace.updated_at into saved_revision, saved_at;
  if not found then
    raise exception 'WORKSPACE_CONFLICT' using errcode = '40001';
  end if;
  return query select saved_revision, saved_at;
end;
$$;

revoke all on function public.save_student_workspace(jsonb, bigint) from public, anon;
grant execute on function public.save_student_workspace(jsonb, bigint) to authenticated;

-- Realtime sends only this user's row to clients that already pass RLS.
alter table public.student_workspaces replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'student_workspaces'
  ) then
    alter publication supabase_realtime add table public.student_workspaces;
  end if;
end;
$$;
