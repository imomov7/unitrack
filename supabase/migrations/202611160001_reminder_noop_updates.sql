-- CPU/IO optimization only. Existing table definitions, RLS, grants and records are unchanged.
-- CREATE OR REPLACE retains the existing function signature, owner and EXECUTE privileges.
begin;
create or replace function public.acadely_schedule_reminders(p_user_id uuid,p_jobs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>3000 then raise exception 'Invalid job batch';end if;
 for item in select value from jsonb_array_elements(p_jobs) loop
  insert into public.acadely_reminder_jobs(user_id,dedupe_key,due_at,expires_at,payload,next_attempt_at)
  values(p_user_id,item->>'id',to_timestamp((item->>'dueAt')::double precision/1000),to_timestamp((item->>'expiresAt')::double precision/1000),item,to_timestamp((item->>'dueAt')::double precision/1000))
  on conflict(user_id,dedupe_key) do update set next_attempt_at=case when acadely_reminder_jobs.due_at is distinct from excluded.due_at then excluded.due_at else acadely_reminder_jobs.next_attempt_at end,due_at=excluded.due_at,expires_at=excluded.expires_at,payload=excluded.payload
   where acadely_reminder_jobs.status in ('pending','retry')
   and (acadely_reminder_jobs.due_at is distinct from excluded.due_at
     or acadely_reminder_jobs.expires_at is distinct from excluded.expires_at
     or acadely_reminder_jobs.payload is distinct from excluded.payload);
 end loop;
end;$$;
commit;
