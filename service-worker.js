importScripts(new URL('./js/push-store.js', self.registration.scope).href);
/* ACADELY static shell cache. User data remains in browser LocalStorage and is
   never written to Cache Storage. Keep this worker and manifest under /unitrack/.
*/
const CACHE_NAME = 'acadely-shell-v23';
const BASE_URL = new URL('./', self.registration.scope);
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/grade-math.js',
  './js/academic-planning.js',
  './js/academic-ui.js',
  './js/ux.js',
  './js/academic-automation.js',
  './js/i18n.js',
  './locales/ar.js',
  './locales/ru.js',
  './assets/data/universities.js',
  './assets/data/course-catalogues.js',
  './js/startup.js',
  './assets/data/majors.js',
  './js/app.js',
  './js/calendar-time.js',
  './js/attendance-core.js',
  './js/attendance-ui.js',
  './js/push-store.js',
  './js/push-config.js',
  './js/account-cloud.js',
  './js/supabase-config.js',
  './assets/branding/favicon.svg',
  './assets/branding/favicon-16.png',
  './assets/branding/favicon-32.png',
  './assets/branding/apple-touch-icon.png',
  './assets/branding/acadely-pwa-192.png',
  './assets/branding/acadely-pwa-512.png',
  './assets/branding/acadely-logo-white.svg',
  './assets/branding/acadely-icon-white.svg',
];
const SHELL_PATHS = new Set(SHELL_FILES.map((file) => new URL(file, BASE_URL).pathname));
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const SCRIPT_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES.map((file) => new Request(new URL(file, BASE_URL).href, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('acadely-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'ACADELY_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname === SCRIPT_HOST && url.pathname === '/npm/@supabase/supabase-js@2') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      return cached || update;
    })());
    return;
  }
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
        return response;
      });
      return cached || update;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isAppNavigation = request.mode === 'navigate' &&
    (url.pathname === BASE_URL.pathname || url.pathname === new URL('index.html', BASE_URL).pathname);
  if (isAppNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(new URL('index.html', BASE_URL), response.clone());
        return response;
      } catch {
        const client = event.clientId ? await self.clients.get(event.clientId) : null;
        client?.postMessage('ACADELY_OFFLINE_FALLBACK');
        const shell = await cache.match(new URL('index.html', BASE_URL).href, { ignoreSearch: true });
        if (shell) return shell;
        return new Response('Acadely is offline. Reconnect and reload to open the app.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // Network-first avoids mixing a fresh HTML shell with stale app modules.
      // Static-only offline fallback never includes account or academic records.
      try {
        const response = await fetch(request);
        if (response.ok) {
          try { await cache.put(new URL(url.pathname, url.origin).href, response.clone()); }
          catch { /* Storage limits must not discard a fresh network response. */ }
          return response;
        }
        if (response.status < 500) return response;
      } catch { /* Offline: use the installed static shell. */ }
      const cached = await cache.match(request, { ignoreSearch: true });
      return cached || new Response('Acadely asset unavailable offline. Reconnect and reload.', { status: 503 });
    })());
  }
});

// Encrypted Web Push delivery is independent of open pages and browser timers.
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let payload;try{payload=event.data?.json();}catch{payload=null;}
  const context=await self.AcadelyPushStore.get('context').catch(()=>null);
  const owned=payload&&typeof payload.userId==='string'&&context?.userId===payload.userId;
  const text=value=>String(value||'').slice(0,1500);
  const route=owned&&['attendance','assignments','calendar','exams'].includes(payload.route)?payload.route:'attendance';
  const language=owned?payload.language:'en';
  const labels={ar:['حاضر','غائب'],ru:['Присутствовал','Отсутствовал'],en:['Present','Absent']}[language]||['Present','Absent'];
  const options={body:owned?text(payload.body):'Open Acadely to review your academic reminders.',icon:new URL('assets/branding/acadely-pwa-192.png',BASE_URL).href,badge:new URL('assets/branding/favicon-32.png',BASE_URL).href,tag:owned?'acadely:'+text(payload.id):'acadely-private-reminder',renotify:false,data:owned?{id:text(payload.id),userId:payload.userId,route,occurrenceKey:text(payload.occurrenceKey),start:text(payload.start),date:text(payload.date),assignmentId:text(payload.assignmentId),examId:text(payload.examId),eventId:text(payload.eventId),createdAt:Date.now() }:{route:'attendance'}};
  if(owned&&payload.category==='attendance')options.actions=[{action:'present',title:labels[0]},{action:'absent',title:labels[1]}];
  // Always show a visible notification: Safari rejects silent Web Push. Signed-out
  // devices get a generic notice with no other account's academic information.
  try{await self.registration.showNotification(owned?text(payload.title):'Acadely',options);}catch(error){if(!options.actions)throw error;delete options.actions;await self.registration.showNotification(owned?text(payload.title):'Acadely',options);}
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'ACADELY_PUSH_RECEIVED'});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const payload=event.notification.data||{},context=await self.AcadelyPushStore.get('context').catch(()=>null);
  const owned=payload.userId&&payload.userId===context?.userId;
  const route=owned&&['attendance','assignments','calendar','exams'].includes(payload.route)?payload.route:'attendance';
  if(owned)await self.AcadelyPushStore.queueIntent({id:String(payload.id||payload.occurrenceKey||'notice')+':'+(event.action||'open'),userId:payload.userId,route,occurrenceKey:payload.occurrenceKey||'',start:payload.start||'',date:payload.date||'',assignmentId:payload.assignmentId||'',examId:payload.examId||'',eventId:payload.eventId||'',status:['present','absent'].includes(event.action)?event.action:'',createdAt:Date.now()}).catch(()=>{});
  const url=new URL('./',BASE_URL);url.hash=route;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(c=>new URL(c.url).origin===url.origin&&new URL(c.url).pathname.startsWith(BASE_URL.pathname));
  if(existing){await existing.focus();existing.postMessage({type:'ACADELY_PUSH_RECEIVED'});}else await self.clients.openWindow(url.href);
 })());
});
