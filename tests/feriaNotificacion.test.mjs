import assert from 'node:assert/strict';
import {crearHandlerFeriaNotificacion} from '../api/feria-notificacion.js';
import {htmlListaEstudiantes} from '../src/listaEstudiantes.js';
import fs from 'node:fs';
import vm from 'node:vm';
const solicitud='12345678-1234-1234-1234-123456789012',proyecto='10000000-0000-0000-0000-000000000001';
const env={SUPABASE_URL:'u',SUPABASE_SERVICE_ROLE_KEY:'k',VAPID_PUBLIC_KEY:'p',VAPID_PRIVATE_KEY:'s',VAPID_SUBJECT:'mailto:test@example.com'};
async function run(opts={}){
 const sent=[],queries=[],deleted=[];
 const tables={perfiles:[{id:'teacher',rol:opts.role||'profesor'}],feria_correcciones_docentes:[{id:'c',solicitud,origen:opts.external?'invitados':'claudina',docente_id:opts.other?'other':'teacher',proyecto_id:proyecto,creado_en:new Date(Date.now()-(opts.old?7200000:0)).toISOString()}],feria_proyectos:[{id:proyecto,estudiante_id:'s1',integrantes_ids:['s1','s2'],titulo:'Proyecto'}],estudiantes:[{id:'s1',auth_user_id:'student1',activo:true},{id:'s2',auth_user_id:'student2',activo:true},{id:'s3',auth_user_id:'stranger',activo:true}],acudientes:[{estudiante_id:'s1',auth_user_id:'guardian1'},{estudiante_id:'s2',auth_user_id:'guardian2'},{estudiante_id:'s3',auth_user_id:'guardian3'}],suscripciones_push:['student1','student2','guardian1','guardian2','stranger','guardian3','teacher'].map(u=>({usuario_id:u,endpoint:'https://fcm.googleapis.com/'+u,p256dh:'p',auth:'a'}))};
 const db={auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},from(table){let rows=[...(tables[table]||[])];const query={select(){return query},eq(k,v){rows=rows.filter(r=>r[k]===v);queries.push([table,k,v]);return query},in(k,values){rows=rows.filter(r=>values.includes(r[k]));queries.push([table,k,values]);return query},maybeSingle:async()=>({data:rows[0]||null}),range:async(a,b)=>({data:opts.noSubs&&table==='suscripciones_push'?[]:rows.slice(a,b+1)}),insert:async()=>({error:opts.duplicate?{code:'23505'}:opts.migration?{code:'42P01'}:null}),delete(){deleted.push(table);return query},then(resolve){resolve({data:rows})}};return query}};
 const push={setVapidDetails(){},async sendNotification(s,p){sent.push([s,JSON.parse(p)]);if(opts.expired)throw{statusCode:410}}};
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await crearHandlerFeriaNotificacion(()=>db,push,env)({method:'POST',headers:opts.anonymous?{}:{authorization:'Bearer token'},body:{tipo:'correccion',solicitud,...opts.body}},res);
 return{res,sent,queries,deleted};
}
const ok=await run();assert.equal(ok.res.code,200);assert.equal(ok.res.data.enviados,4);assert.deepEqual(ok.sent.map(([s])=>s.endpoint.split('/').pop()).sort(),['guardian1','guardian2','student1','student2']);assert.equal(ok.sent[0][1].id,proyecto);assert.equal(ok.sent[0][1].type,'feria-actualizada');
for(const[opts,status]of [[{anonymous:true},401],[{role:'estudiante'},403],[{other:true},404],[{external:true},404],[{old:true},400],[{body:{solicitud:'bad'}},400],[{migration:true},503]]){const r=await run(opts);assert.equal(r.res.code,status);assert.equal(r.sent.length,0)}
for(const opts of [{noSubs:true},{duplicate:true}]){const r=await run(opts);assert.equal(r.res.code,200);assert.equal(r.sent.length,0)}
const expired=await run({expired:true});assert.equal(expired.res.data.fallidos,4);assert.equal(expired.deleted.length,4);
const injected=await run({body:{usuarios:['stranger'],proyecto:'other',contenido:'spoof'}});assert.equal(injected.res.data.enviados,4);assert(!injected.sent.some(([s])=>s.endpoint.endsWith('/stranger')));
const html=htmlListaEstudiantes([{nombre:'Zeta',grado:8,email:null,documento:'001234',activo:true},{nombre:'<script>alert(1)</script>',grado:6,email:'uno@example.edu',documento:null,activo:false}]);assert.equal((html.match(/<section>/g)||[]).length,2);assert(html.indexOf('6°')<html.indexOf('8°'));assert(html.includes('001234'));assert(html.includes('Sin registrar'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('Correo registrado'));assert(html.includes('Documento registrado'));
const events={},shown=[];
vm.runInNewContext(fs.readFileSync('src/sw.js','utf8').replace(/^import .*$/gm,'').replace('precacheAndRoute(self.__WB_MANIFEST);',''),{clientsClaim(){},self:{addEventListener(n,f){events[n]=f},registration:{showNotification(...args){shown.push(args);return Promise.resolve()}}},Date,Number,Math,encodeURIComponent});
events.push({data:{json:()=>({type:'feria-actualizada',id:proyecto,title:'Revisión',sentAt:Date.now()})},waitUntil(){}});assert.equal(shown[0][1].data.url,'/?proyectoFeria='+proyecto);
console.log('PASS: push solo a equipo/acudientes, permisos, autoría, caducidad, deduplicación, dispositivos expirados, enlace y listado escapado por grado');
