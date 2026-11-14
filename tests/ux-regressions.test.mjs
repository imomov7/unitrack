import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const ux=await readFile(new URL('../js/ux.js',import.meta.url),'utf8');
function functionSource(text,name){
 const start=text.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
 assert.ok(start>=0,`${name} exists`);
 const rest=text.slice(start);const next=rest.slice(1).search(/^(?:async )?function \w+\(/m);
 return next<0?rest:rest.slice(0,next+1);
}
test('legacy university route resolves to Profile and Dashboard remains a valid route',()=>{
 const c=vm.createContext({views:{dashboard(){},profile(){},courses(){}}});
 vm.runInContext(functionSource(source,'validRoute'),c);
 assert.equal(c.validRoute('academics'),'profile');assert.equal(c.validRoute('dashboard'),'dashboard');assert.equal(c.validRoute('courses'),'courses');assert.equal(c.validRoute('nonsense'),null);
});
test('navigation changes the active page before rendering and closes menus and dialogs',()=>{
 const events=[];const c=vm.createContext({validRoute:r=>r,document:{querySelectorAll:()=>[{id:1}]},closeDialog:d=>events.push('closed'),toggleMenu:v=>events.push(v),location:{hash:'#courses'},currentPage:'courses',render:()=>events.push(c.currentPage),window:{scrollTo(){}}});
 vm.runInContext(functionSource(ux,'navigateTo'),c);c.navigateTo('dashboard');
 assert.equal(c.location.hash,'#dashboard');assert.equal(c.currentPage,'dashboard');assert.deepEqual(events,['closed',false,'dashboard']);
});
test('offline account edits are marked dirty and never replace the legacy local document',()=>{
 const saved=new Map([['unitrack-data-v1','original academic data']]);
 const c=vm.createContext({accountUser:{id:'a'},localChangeVersion:0,lastSyncedChangeVersion:0,cloudRevision:7,cloudReady:false,cloudConflict:false,KEY:'unitrack-data-v1',data:{courses:[{id:'c'}]},localStorage:{setItem:(k,v)=>saved.set(k,v)},render(){},setCloudStatus(){},scheduleCloudSync(){},storageWarningShown:false,msg(){}});
 vm.runInContext(functionSource(source,'save'),c);assert.equal(c.save(),true);
 const cache=JSON.parse(saved.get('acadely-workspace-cache-v1:a'));
 assert.equal(cache.dirty,true);assert.equal(cache.revision,7);assert.equal(cache.data.courses[0].id,'c');assert.equal(saved.get('unitrack-data-v1'),'original academic data');assert.equal(c.localChangeVersion,1);
});
test('storage events from the old local workspace cannot replace signed-in account data',()=>{
 let listener;const original={courses:[{id:'private-course'}]};const c=vm.createContext({window:{addEventListener:(name,fn)=>listener=fn},accountUser:{id:'a'},KEY:'unitrack-data-v1',data:original,load:()=>({courses:[]}),render(){},msg(){}});
 const line=source.split('\n').find(l=>l.startsWith("window.addEventListener('storage'"));vm.runInContext(line,c);listener({key:'unitrack-data-v1'});
 assert.equal(c.data,original);
});
test('a failed sign-in renders an enabled retry button',async()=>{
 const modes=[];
 class Fields {entries(){return [['email','test@example.test'],['password','invalid']] [Symbol.iterator]();}get(){return null;}}
 const form={dataset:{authForm:'login'}};
 const c=vm.createContext({FormData:Fields,accountBusy:false,cloudRememberSession:false,showAuth:(mode,message)=>modes.push({mode,message,busy:c.accountBusy}),window:{AcadelyCloudService:{signIn:async()=>({error:{message:'Invalid login credentials'}})}}});
 vm.runInContext(functionSource(source,'handleAuthSubmit'),c);await c.handleAuthSubmit({target:{closest:()=>form},preventDefault(){}});
 assert.equal(c.accountBusy,false);assert.equal(modes.at(-1).mode,'login');assert.equal(modes.at(-1).busy,false);assert.equal(modes.at(-1).message,'Invalid login credentials');
});
for (const newerCloud of [false,true]) {
 test(`unsynced cache survives login${newerCloud?' and conflicts safely with a newer cloud revision':''}`,async()=>{
  const states=[];const pending={data:{courses:[{id:'unsynced-course'}]},revision:7,dirty:true};
  const c=vm.createContext({data:{courses:[]},cloudCacheKey:id=>'acadely-workspace-cache-v1:'+id,accountUser:null,cloudReady:false,activatingAccountId:null,cloudSyncTimer:null,clearTimeout(){},cloudRevision:0,localChangeVersion:0,lastSyncedChangeVersion:0,cloudWriteSnapshot:null,cloudChannel:null,cloudProfileChannel:null,profileCloudReady:false,pendingMigrationForUserId:null,cloudConflict:false,KEY:'unitrack-data-v1',load:()=>({courses:[]}),localStorage:{getItem:()=>JSON.stringify(pending)},window:{AcadelyCloudService:{getOrCreateProfile:async()=>({}),loadWorkspace:async()=>({revision:newerCloud?8:7,data:{courses:[]}})}},withProfileIdentity:user=>user,validateImport:d=>d,showAcadelyApp(){},render(){},attachWorkspaceRealtime(){},scheduleCloudSync:()=>states.push('sync'),setCloudStatus:state=>states.push(state)});
  vm.runInContext(functionSource(source,'activateAccount'),c);await c.activateAccount({id:'a'});
  assert.equal(c.data.courses[0].id,'unsynced-course');assert.equal(c.localChangeVersion,1);assert.equal(c.cloudConflict,newerCloud);assert.equal(c.activatingAccountId,null);assert.deepEqual(states,[newerCloud?'conflict':'sync']);
 });
}
