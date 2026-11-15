-- Run only after the functions and private server secrets are configured.
-- Supabase Vault must contain these two secrets, entered via its secure UI:
-- acadely_dispatch_url = https://<project-ref>.supabase.co/functions/v1/academic-dispatch
-- acadely_cron_secret = the same random ACADELY_CRON_SECRET used by the function.
-- Set academic-dispatch Verify JWT OFF only after its private header-secret auth
-- is configured. academic-api retains its authenticated user-session check.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from vault.secrets where name='acadely_dispatch_url') or
    not exists(select 1 from vault.secrets where name='acadely_cron_secret') then
  raise exception 'Configure the named Vault secrets before activating this scheduler';
 end if;
end$$;
select cron.schedule('acadely-academic-reminders','* * * * *',
 $job$select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='acadely_dispatch_url' limit 1),
  headers:=jsonb_build_object('Content-Type','application/json','x-acadely-cron',(select decrypted_secret from vault.decrypted_secrets where name='acadely_cron_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=50000
 );$job$);
