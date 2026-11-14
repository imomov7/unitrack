import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function authRedirectUrl() {'),source.indexOf('\nasync function handleAuthSubmit'));
test('production auth links use the correct root for each verified hosting origin',()=>{
 for(const [origin,protocol,expected]of [['https://myacadely.vercel.app','https:','https://myacadely.vercel.app/'],['https://imomov7.github.io','https:','https://imomov7.github.io/unitrack/'],['https://myacadely.vercel.app.evil.test','https:','https://myacadely.vercel.app/'],['http://localhost:8765','http:','https://myacadely.vercel.app/']]){
 const c=vm.createContext({location:{origin,protocol,pathname:'/index.html'}});vm.runInContext(fn,c);assert.equal(c.authRedirectUrl(),expected);
 }
});
test('deletion CORS allows only explicit production origins and existing localhost',()=>{
 const s=fs.readFileSync(new URL('../supabase/functions/delete-account/index.ts',import.meta.url),'utf8');const body=s.slice(s.indexOf('function corsHeaders'),s.indexOf('\nfunction jsonResponse')).replace('request: Request','request');const c=vm.createContext({});vm.runInContext(body,c);
 for(const origin of ['https://myacadely.vercel.app','https://imomov7.github.io'])assert.equal(c.corsHeaders({headers:{get:()=>origin}})['Access-Control-Allow-Origin'],origin);
 const evil='https://myacadely.vercel.app.evil.test';assert.notEqual(c.corsHeaders({headers:{get:()=>evil}})['Access-Control-Allow-Origin'],evil);
});
