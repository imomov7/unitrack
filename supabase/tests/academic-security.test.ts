import {Engine,validSubscription,safeEqual} from '../functions/_shared/academic.ts';
function check(value:unknown,message='Assertion failed'){if(!value)throw new Error(message);}
Deno.test('push subscription endpoints reject SSRF, credentials, invalid keys and unsupported destinations',()=>{
 const bytes=new Uint8Array(65);bytes[0]=4;const key=btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),auth=btoa('1234567890123456').replace(/=/g,'');
 const sample={endpoint:'https://web.push.apple.com/example',keys:{p256dh:key,auth}};
 check(validSubscription(sample));for(const endpoint of ['http://web.push.apple.com/example','https://127.0.0.1/admin','https://fcm.googleapis.com.evil.test/x','https://user:password@web.push.apple.com/x','https://web.push.apple.com:444/x'])check(!validSubscription({...sample,endpoint}),endpoint);
 check(!validSubscription({...sample,keys:{p256dh:'bad',auth}}));
});
Deno.test('cron secrets use full-length comparison and are not accepted by prefixes',()=>{check(safeEqual('private-secret','private-secret'));check(!safeEqual('private-secret','private-secrex'));check(!safeEqual('private-secret','private'));});
Deno.test('server and browser use the same timezone-aware rule engine',()=>{check(Engine.wallTime('2026-11-16','10:00','Asia/Dubai')===Date.parse('2026-11-16T06:00:00Z'));check(Engine.wallTime('2026-03-08','02:30','America/New_York')===null);});
