-- Additive migration. Does not rewrite student_workspaces or existing records.
begin;
create table if not exists public.acadely_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null check(length(endpoint)<=2048),
 subscription jsonb not null check(jsonb_typeof(subscription)='object' and pg_column_size(subscription)<8192),
 enabled boolean not null default true,
 timezone text not null default 'UTC',
 updated_at timestamptz not null default now(),
 unique(user_id,endpoint)
);
create table if not exists public.acadely_reminder_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 dedupe_key text not null check(length(dedupe_key)<=600),
 due_at timestamptz not null,
 expires_at timestamptz not null,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','retry','sent','muted','inapp','cancelled','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 locked_until timestamptz,
 last_error text,
 unique(user_id,dedupe_key)
);
create index if not exists acadely_jobs_due on public.acadely_reminder_jobs(status,next_attempt_at,due_at);
create table if not exists public.acadely_notifications (
 user_id uuid not null references auth.users(id) on delete cascade,
 dedupe_key text not null,
 payload jsonb not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 removed_at timestamptz,
 primary key(user_id,dedupe_key)
);
create index if not exists acadely_notifications_recent on public.acadely_notifications(user_id,created_at desc);
create table if not exists public.acadely_push_deliveries (
 job_id uuid not null references public.acadely_reminder_jobs(id) on delete cascade,
 subscription_id uuid not null references public.acadely_push_subscriptions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 delivered_at timestamptz not null default now(),
 primary key(job_id,subscription_id)
);
create table if not exists public.acadely_push_runtime (
 id text primary key check(id='dispatcher'),
 last_tick timestamptz,
 last_success timestamptz
);
insert into public.acadely_push_runtime(id) values('dispatcher') on conflict do nothing;

alter table public.acadely_push_subscriptions enable row level security;
alter table public.acadely_reminder_jobs enable row level security;
alter table public.acadely_notifications enable row level security;
alter table public.acadely_push_deliveries enable row level security;
alter table public.acadely_push_runtime enable row level security;
revoke all on public.acadely_push_subscriptions,public.acadely_reminder_jobs,public.acadely_notifications,public.acadely_push_deliveries,public.acadely_push_runtime from public,anon,authenticated;
-- Authenticated users can read only their own inbox. Server functions own writes,
-- subscriptions, dispatch and key material; browser clients never get service keys.
grant select on public.acadely_notifications to authenticated;
grant all on public.acadely_push_subscriptions,public.acadely_reminder_jobs,public.acadely_notifications,public.acadely_push_deliveries,public.acadely_push_runtime to service_role;
drop policy if exists "Own academic notification history" on public.acadely_notifications;
create policy "Own academic notification history" on public.acadely_notifications for select to authenticated using((select auth.uid())=user_id);

create or replace function public.acadely_schedule_reminders(p_user_id uuid,p_jobs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>3000 then raise exception 'Invalid job batch';end if;
 for item in select value from jsonb_array_elements(p_jobs) loop
  insert into public.acadely_reminder_jobs(user_id,dedupe_key,due_at,expires_at,payload,next_attempt_at)
  values(p_user_id,item->>'id',to_timestamp((item->>'dueAt')::double precision/1000),to_timestamp((item->>'expiresAt')::double precision/1000),item,to_timestamp((item->>'dueAt')::double precision/1000))
  on conflict(user_id,dedupe_key) do update set next_attempt_at=case when acadely_reminder_jobs.due_at is distinct from excluded.due_at then excluded.due_at else acadely_reminder_jobs.next_attempt_at end,due_at=excluded.due_at,expires_at=excluded.expires_at,payload=excluded.payload
   where acadely_reminder_jobs.status in ('pending','retry');
 end loop;
end;$$;
create or replace function public.acadely_claim_reminders(p_token uuid,p_limit integer default 50)
returns setof public.acadely_reminder_jobs language sql security definer set search_path='' as $$
 update public.acadely_reminder_jobs j set status='processing',lease_token=p_token,locked_until=now()+interval '5 minutes',attempts=attempts+1
 where j.id in (
  select id from public.acadely_reminder_jobs where due_at<=now() and next_attempt_at<=now()
  and ((status in ('pending','retry')) or (status='processing' and locked_until<now()))
  order by due_at for update skip locked limit least(greatest(p_limit,1),100)
 ) returning j.*;
$$;
revoke all on function public.acadely_schedule_reminders(uuid,jsonb),public.acadely_claim_reminders(uuid,integer) from public,anon,authenticated;
grant execute on function public.acadely_schedule_reminders(uuid,jsonb),public.acadely_claim_reminders(uuid,integer) to service_role;
commit;
