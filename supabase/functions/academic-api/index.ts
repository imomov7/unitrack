import {database,Engine,vapid,validSubscription,originHeaders} from '../_shared/academic.ts';
Deno.serve(async request=>{
 const headers=originHeaders(request),reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!token)return reply({error:'Authentication required'},401);
  const db=database();
  const {data:identity,error:authError}=await db.auth.getUser(token);if(authError||!identity.user)return reply({error:'Authentication required'},401);
  const userId=identity.user.id,body=await request.json();
  if(body.action==='status'){
   const {data:runtime,error}=await db.from('acadely_push_runtime').select('last_tick,last_success').eq('id','dispatcher').maybeSingle();
   const keys=vapid(),scheduler=!!runtime?.last_success&&Date.now()-Date.parse(runtime.last_success)<180000;
   return reply({configured:keys.ready&&!error&&scheduler,publicKey:keys.ready?keys.publicKey:null,keysReady:keys.ready,schemaReady:!error,schedulerReady:scheduler,lastSuccess:runtime?.last_success||null,reason:error?'Database setup required':!keys.ready?'Server push keys required':!scheduler?'Scheduler is not running':'Push server connected'});
  }
  if(body.action==='subscribe'){
   if(!validSubscription(body.subscription)||!Engine.validZone(body.timezone))return reply({error:'Invalid push subscription or timezone'},400);
   const s=body.subscription;
   const {data:existing}=await db.from('acadely_push_subscriptions').select('id,subscription,timezone,enabled').eq('user_id',userId).eq('endpoint',s.endpoint).maybeSingle();
   if(existing?.enabled===true&&existing.timezone===body.timezone&&existing.subscription?.endpoint===s.endpoint&&existing.subscription?.keys?.p256dh===s.keys.p256dh&&existing.subscription?.keys?.auth===s.keys.auth)return reply({ok:true});
   if(!existing){const {count}=await db.from('acadely_push_subscriptions').select('id',{count:'exact',head:true}).eq('user_id',userId);if((count||0)>=10)return reply({error:'This account already has ten push devices. Pause or remove an old device first.'},429);}
   const {error}=await db.from('acadely_push_subscriptions').upsert({user_id:userId,endpoint:s.endpoint,subscription:{endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}},timezone:body.timezone,enabled:true,updated_at:new Date().toISOString()},{onConflict:'user_id,endpoint'});if(error)throw error;return reply({ok:true});
  }
  if(body.action==='pause'){
   const {error}=await db.from('acadely_push_subscriptions').update({enabled:false}).eq('user_id',userId).eq('endpoint',String(body.endpoint));if(error)throw error;return reply({ok:true});
  }
  if(body.action==='history'){
   const {data,error}=await db.from('acadely_notifications').select('dedupe_key,payload,created_at,read_at,removed_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(200);if(error)throw error;
   return reply({notifications:(data||[]).map(row=>({...row.payload,id:row.dedupe_key,createdAt:row.created_at,read:!!row.read_at,removed:!!row.removed_at}))});
  }
  if(body.action==='read'||body.action==='remove'){
   let query=db.from('acadely_notifications').update(body.action==='remove'?{removed_at:new Date().toISOString(),read_at:new Date().toISOString()}:{read_at:new Date().toISOString()}).eq('user_id',userId);
   if(body.all!==true||body.action==='remove')query=query.eq('dedupe_key',String(body.id));const {error}=await query;if(error)throw error;return reply({ok:true});
  }
  if(body.action==='test'){
   const now=Date.now(),job={id:'test:'+Math.floor(now/60000),category:'test',title:'Acadely — Test notification',body:'Server Web Push is reaching this device. You can now close Acadely and test a scheduled reminder.',route:'attendance',dueAt:now,expiresAt:now+600000};
   const {error}=await db.rpc('acadely_schedule_reminders',{p_user_id:userId,p_jobs:[job]});if(error)throw error;return reply({queued:true});
  }
  return reply({error:'Unknown action'},400);
 }catch{return reply({error:'Academic notification service unavailable. Check server setup.'},503);}
});
