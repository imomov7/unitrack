import {database,Engine,vapid,sendPush,safeEqual} from '../_shared/academic.ts';
Deno.serve(async request=>{
 const secret=Deno.env.get('ACADELY_CRON_SECRET')||'';
 if(request.method!=='POST'||secret.length<32||!safeEqual(request.headers.get('x-acadely-cron')||'',secret))return new Response('Unauthorized',{status:401});
 const db=database(),now=Date.now(),tick=new Date(now).toISOString(),lease=crypto.randomUUID();let sent=0,cancelled=0,retried=0;
 try{
  const {error:heartbeatError}=await db.from('acadely_push_runtime').update({last_tick:tick}).eq('id','dispatcher');if(heartbeatError)throw heartbeatError;
  // Generate from current workspace data every minute, including recurring classes.
  // No private academic records are copied into a public/shared browser cache.
  for(let offset=0;offset<1000;offset+=100){
   const {data:workspaces,error}=await db.from('student_workspaces').select('user_id,data').eq('data->settings->notificationPrefs->>enabled','true').range(offset,offset+99);if(error)throw error;
   for(const row of workspaces||[]){try{const jobs=Engine.reminderJobs(row.data,row.data.settings?.notificationPrefs,now).slice(0,3000);if(jobs.length){const {error:insertError}=await db.rpc('acadely_schedule_reminders',{p_user_id:row.user_id,p_jobs:jobs});if(insertError)continue;}}catch{/* One malformed private workspace must not block other students. */}}
   if(!workspaces||workspaces.length<100||Date.now()-now>20000)break;
  }
  const {data:jobs,error:claimError}=await db.rpc('acadely_claim_reminders',{p_token:lease,p_limit:10});if(claimError)throw claimError;
  for(const job of jobs||[]){
   const finish=async(patch:Record<string,unknown>)=>{const {error}=await db.from('acadely_reminder_jobs').update({...patch,locked_until:null}).eq('id',job.id).eq('lease_token',lease);if(error)throw error;};
   try{
    const {data:workspace,error:readError}=await db.from('student_workspaces').select('data').eq('user_id',job.user_id).maybeSingle();if(readError)throw readError;
    const prefs=Engine.preferences(workspace?.data?.settings?.notificationPrefs,workspace?.data?.studentProfile?.timezone||'UTC'),current=Date.now();
    const candidate=job.payload.category==='test'?job.payload:workspace?Engine.reminderJobs(workspace.data,prefs,current).find((j:any)=>j.id===job.dedupe_key):null;
    if(!candidate||candidate.expiresAt<current||(!prefs.enabled&&candidate.category!=='test')){await finish({status:'cancelled'});cancelled++;continue;}
    if(candidate.dueAt>current+1000){await finish({status:'pending',due_at:new Date(candidate.dueAt).toISOString(),next_attempt_at:new Date(candidate.dueAt).toISOString(),payload:candidate});continue;}
    const payload={...candidate,userId:job.user_id,language:prefs.language};
    const {error:historyError}=await db.from('acadely_notifications').upsert({user_id:job.user_id,dedupe_key:job.dedupe_key,payload,created_at:new Date(candidate.dueAt).toISOString()},{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});if(historyError)throw historyError;
    if(Engine.quietAt(current,prefs)&&candidate.category!=='test'){await finish({status:'muted'});continue;}
    if(!vapid().ready){await finish({status:'retry',next_attempt_at:new Date(current+60000).toISOString(),last_error:'Server keys not configured'});continue;}
    const {data:subscriptions,error:subError}=await db.from('acadely_push_subscriptions').select('id,subscription').eq('user_id',job.user_id).eq('enabled',true);if(subError)throw subError;
    if(!subscriptions?.length){await finish({status:'inapp'});continue;}
    // One receipt read per job, rather than one read per device.
    const {data:receipts,error:receiptReadError}=await db.from('acadely_push_deliveries').select('subscription_id').eq('job_id',job.id).eq('user_id',job.user_id);if(receiptReadError)throw receiptReadError;
    const delivered=new Set((receipts||[]).map(row=>row.subscription_id));
    let needsRetry=false;
    for(let offset=0;offset<subscriptions.length;offset+=5){
     await Promise.all(subscriptions.slice(offset,offset+5).map(async sub=>{
     if(delivered.has(sub.id))return;
     try{await sendPush(sub.subscription,payload);const {error:receiptError}=await db.from('acadely_push_deliveries').upsert({job_id:job.id,subscription_id:sub.id,user_id:job.user_id},{onConflict:'job_id,subscription_id'});if(receiptError)throw receiptError;sent++;}
     catch(error){const status=Number((error as any)?.statusCode);if(status===404||status===410){await db.from('acadely_push_subscriptions').delete().eq('id',sub.id).eq('user_id',job.user_id);}else needsRetry=true;}
     }));
    }
    if(needsRetry&&job.attempts<5){await finish({status:'retry',next_attempt_at:new Date(current+Math.min(16,2**(job.attempts-1))*60000).toISOString(),last_error:'Push delivery will retry'});retried++;}else await finish({status:needsRetry?'failed':'sent',last_error:needsRetry?'Delivery failed after retries':null});
   }catch{await finish({status:job.attempts<5?'retry':'failed',next_attempt_at:new Date(Date.now()+60000).toISOString(),last_error:'Temporary dispatch error'});retried++;}
  }
  await db.from('acadely_push_runtime').update({last_success:new Date().toISOString()}).eq('id','dispatcher');
  return Response.json({ok:true,sent,cancelled,retried});
 }catch{return Response.json({error:'Dispatcher failed; inspect database and configuration.'},{status:503});}
});
