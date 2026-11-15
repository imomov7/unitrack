import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('index.html'),app=file('js/app.js');
function functionSource(name){const start=app.indexOf('function '+name+'(');const tail=app.slice(start);const next=tail.slice(1).search(/^(?:async )?function \w+\(/m);return next<0?tail:tail.slice(0,next+1);}
test('workspace cannot paint before CSS or authentication finishes loading',()=>{
 assert.match(html,/<div class="app-shell" hidden>/);assert.match(html,/<main id="auth-screen"[^>]* hidden/);assert.match(html,/<section id="app-boot"/);
 assert.ok(html.indexOf('[hidden]{display:none!important}')<html.indexOf('rel="stylesheet"'));assert.match(html,/<noscript>/);
 const shell={hidden:true},boot={hidden:false,setAttribute(n){if(n==='hidden')this.hidden=true;}},auth={hidden:true,innerHTML:''};
 const c=vm.createContext({document:{querySelector:s=>s==='.app-shell'?shell:s==='#app-boot'?boot:null},authScreen:auth,authMarkup:()=>'<h1>Connecting</h1>',syncTheme(){},pauseAcademicContext(){}});vm.runInContext(functionSource('showAuth'),c);vm.runInContext(functionSource('showAcadelyApp'),c);
 c.showAuth('loading');assert.equal(shell.hidden,true);assert.equal(auth.hidden,false);assert.equal(boot.hidden,true);
 c.showAuth('login');assert.equal(shell.hidden,true);
 c.showAcadelyApp();assert.equal(shell.hidden,false);assert.equal(auth.hidden,true);
});
test('the top Dashboard is an internal route link and the duplicate label is hidden on home',()=>{
 assert.match(html,/<a class="breadcrumb-home" href="#dashboard">Dashboard<\/a>/);
 assert.match(app,/const anchor = event.target.closest\('a\[href\^="#"\]'\)/);assert.match(app,/event.preventDefault\(\); navigateTo\(route\)/);
 assert.match(app,/querySelector\('\.breadcrumb strong'\).hidden=currentPage==='dashboard'/);
});
test('Russian covers every existing translated interface key without translating official records',()=>{
 const c={window:{}};vm.runInNewContext(file('locales/ar.js'),c);vm.runInNewContext(file('locales/ru.js'),c);
 for(const key of Object.keys(c.window.ACADELY_AR))assert.ok(c.window.ACADELY_RU[key],key);
 const store=new Map([['acadely-language-v1','ru']]);const root={document:{readyState:'loading',addEventListener(){},documentElement:{}},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},CustomEvent:class{},dispatchEvent(){},...c.window};root.window=root;vm.createContext(root);vm.runInContext(file('js/i18n.js'),root);
 assert.equal(root.AcadelyI18n.language,'ru');assert.equal(root.AcadelyI18n.locale,'ru');assert.equal(root.AcadelyI18n.t('Settings'),'Настройки');assert.equal(root.AcadelyI18n.t('3 credits'),'3 кредитов');assert.equal(root.AcadelyI18n.t('GCIS-123'),'GCIS-123');assert.equal(root.AcadelyI18n.t('Rochester Institute of Technology'),'Rochester Institute of Technology');
 root.AcadelyI18n.set('ar');assert.equal(root.document.documentElement.dir,'rtl');root.AcadelyI18n.set('ru');assert.equal(root.document.documentElement.dir,'ltr');assert.equal(store.get('acadely-language-v1'),'ru');root.AcadelyI18n.set('en');assert.equal(root.AcadelyI18n.t('Settings'),'Settings');
});
test('static assets use fresh code online, cached code offline, and never cache account APIs',async()=>{
 const handlers=new Map();let offline=false,putBody='',intercepted;
 const c=vm.createContext({URL,Request,Response,importScripts(){},self:{registration:{scope:'https://example.test/unitrack/'},location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers.set(name,fn)},caches:{open:async()=>({match:async()=>new Response('cached app'),put:async(_,response)=>{putBody=await response.text();}})},fetch:async()=>{if(offline)throw Error('offline');return new Response('fresh app');}});
 vm.runInContext(file('service-worker.js'),c);
 const event=()=>({request:new Request('https://example.test/unitrack/js/app.js?v=new'),respondWith:p=>{intercepted=p;}});
 handlers.get('fetch')(event());assert.equal(await(await intercepted).text(),'fresh app');assert.equal(putBody,'fresh app');offline=true;handlers.get('fetch')(event());assert.equal(await(await intercepted).text(),'cached app');
 let privateIntercepted=false;handlers.get('fetch')({request:new Request('https://private.supabase.co/rest/v1/student_workspaces'),respondWith:()=>{privateIntercepted=true;}});assert.equal(privateIntercepted,false);
});
test('language icon shares existing controls and its three choices start collapsed',()=>{
 assert.doesNotMatch(html,/class="language-bar"|--language-bar-height/);
 assert.match(html,/id="theme-toggle" data-theme-toggle[\s\S]*?id="header-language-control"[\s\S]*?class="top-avatar"/);
 const c=vm.createContext({window:{AcadelyI18n:{language:'ru'}},esc:v=>String(v)});vm.runInContext(functionSource('languagePickerMarkup'),c);const markup=c.languagePickerMarkup('test-language-menu');
 assert.match(markup,/aria-expanded="false"/);assert.match(markup,/data-language-menu[^>]* hidden/);
 for(const label of ['English','العربية','Русский'])assert.ok(markup.includes(label));
 assert.match(app,/class="auth-utilities"[\s\S]*?languagePickerMarkup\('auth-language-menu'\)/);
});
test('global language buttons and the Settings selector share the saved preference',()=>{
 const buttons=['en','ar','ru'].map(language=>({dataset:{language},setAttribute(name,value){this[name]=value;}}));const select={value:'en'};const saved=new Map();
 const root={document:{readyState:'loading',addEventListener(){},documentElement:{},querySelectorAll:()=>buttons,querySelector:s=>s==='#interface-language'?select:null},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},CustomEvent:class{},dispatchEvent(){}};root.window=root;vm.createContext(root);vm.runInContext(file('js/i18n.js'),root);
 for(const lang of ['ru','ar','en']){root.AcadelyI18n.set(lang);assert.equal(select.value,lang);assert.equal(saved.get('acadely-language-v1'),lang);assert.equal(buttons.filter(b=>b['aria-pressed']==='true').length,1);assert.equal(buttons.find(b=>b['aria-pressed']==='true').dataset.language,lang);}
});
test('language changes refresh view dates while keeping editable forms intact',()=>{
 let renders=0,hasForm=false;const shell={hidden:true};const c=vm.createContext({window:{AcadelyI18n:{locale:'ru'}},document:{querySelector:()=>null},appShell:shell,content:{querySelector:()=>hasForm?{}:null},render:()=>{renders++;}});
 vm.runInContext(functionSource('refreshLanguageView'),c);c.refreshLanguageView();assert.equal(renders,0);shell.hidden=false;c.refreshLanguageView();assert.equal(renders,1);hasForm=true;c.refreshLanguageView();assert.equal(renders,1);
});
