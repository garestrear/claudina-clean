import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {endpointConocido} from '../lib/push.js';
assert.equal(endpointConocido('https://fcm.googleapis.com/abc'),true);
for(const url of ['http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://user@web.push.apple.com/a','https://127.0.0.1/a'])assert.equal(endpointConocido(url),false);
const events={},shown=[];
vm.runInNewContext(fs.readFileSync('src/sw.js','utf8').replace(/^import .*$/gm,'').replace('precacheAndRoute(self.__WB_MANIFEST);',''),{clientsClaim(){},self:{addEventListener(n,f){events[n]=f},registration:{showNotification(...args){shown.push(args);return Promise.resolve()}}},Date,Number,encodeURIComponent});
const push=d=>events.push({data:{json:()=>d},waitUntil(){}});
push({type:'aviso',id:'test',title:'Feria',body:'Bienvenidos',sentAt:Date.now()});
assert.equal(shown.length,1);assert.equal(shown[0][0],'Feria');assert.equal(shown[0][1].data.url,'/?aviso=test');
push({type:'aviso',title:'Viejo',body:'x',sentAt:Date.now()-86400001});
push({type:'aviso',title:'Sin fecha',body:'x'});assert.equal(shown.length,1);
push({type:'evacuacion',id:'a',modo:'real',sentAt:Date.now()});assert.equal(shown[1][0],'ALERTA ROJA · EVACUAR');
const source=fs.readFileSync('api/aviso-notificacion.js','utf8').replace(/^import .*$/gm,'').replace('export default async function handler','async function handler')+'\nglobalThis.handler=handler';
async function run({method='POST',role='profesor',token='ok',grado=null,published=true,failQuery=false}={}){
 const sent=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},from(table){const query={select(){return query},eq(){return query},async single(){return table==='perfiles'?{data:{rol:role}}:{data:{id:'a',titulo:'Feria',contenido:'Hola',publicado:published,grado}}},async range(){return failQuery?{error:true}:{data:[{endpoint:'https://fcm.googleapis.com/a',p256dh:'p',auth:'a'}]}}};return query}};
 const ctx={process:{env:{SUPABASE_URL:'u',SUPABASE_SERVICE_ROLE_KEY:'k',VAPID_PUBLIC_KEY:'p',VAPID_PRIVATE_KEY:'v',VAPID_SUBJECT:'s'}},createClient:()=>db,webpush:{setVapidDetails(){},async sendNotification(...args){sent.push(args)}},endpointConocido};vm.runInNewContext(source,ctx);
 const res={code:0,status(n){this.code=n;return this},json(d){this.body=d;return this},setHeader(){}};
 await ctx.handler({method,headers:{authorization:token?'Bearer '+token:undefined},body:{avisoId:'12345678-1234-1234-1234-123456789abc'}},res);return{res,sent};
}
for(const [opts,code] of [[{method:'GET'},405],[{token:null},401],[{role:'estudiante'},403],[{grado:6},400],[{published:false},400],[{failQuery:true},503]]){const{res,sent}=await run(opts);assert.equal(res.code,code);assert.equal(sent.length,0)}
const {res,sent}=await run();assert.equal(res.code,200);assert.equal(res.body.enviados,1);assert.equal(JSON.parse(sent[0][1]).type,'aviso');
console.log('Avisos push: autorización, alcance, envío, enlace y alertas verificados.');
