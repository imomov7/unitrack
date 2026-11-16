import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import webpush from 'npm:web-push@3.6.7';
import '../../../js/attendance-core.js';
export const Engine=(globalThis as any).AcadelyAttendance;
export function database(){return createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});}
export function vapid(){const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'',privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||'',subject=Deno.env.get('VAPID_SUBJECT')||'https://myacadely.vercel.app/';return {publicKey,privateKey,subject,ready:/^[A-Za-z0-9_-]{87}$/.test(publicKey)&&/^[A-Za-z0-9_-]{43}$/.test(privateKey)&&/^(mailto:|https:\/\/)/.test(subject)};}
export function validSubscription(value:any){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>2048)return false;
 let u;try{u=new URL(value.endpoint);}catch{return false;}
 const h=u.hostname,allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(h)||h.endsWith('.push.services.mozilla.com')||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com');
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!allowed)return false;
 const decode=(s:string)=>{try{return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{return new Uint8Array();}};
 const p=decode(String(value.keys?.p256dh||'')),a=decode(String(value.keys?.auth||''));return p.length===65&&p[0]===4&&a.length===16;
}
export async function sendPush(subscription:any,payload:any){const keys=vapid();if(!keys.ready)throw new Error('VAPID_NOT_CONFIGURED');return await webpush.sendNotification(subscription,JSON.stringify(payload),{vapidDetails:{subject:keys.subject,publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:Math.max(0,Math.min(3600,Math.floor((payload.expiresAt-Date.now())/1000))),urgency:'normal',timeout:5000});}
export function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function originHeaders(request:Request){const origin=request.headers.get('origin')||'',allowed=(Deno.env.get('ACADELY_ORIGINS')||'https://myacadely.vercel.app,https://imomov7.github.io').split(',').map(x=>x.trim());return {'Content-Type':'application/json','Vary':'Origin',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};}
