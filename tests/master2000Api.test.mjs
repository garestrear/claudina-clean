import assert from 'node:assert/strict';
import {crearHandlerMaster} from '../api/master2000.js';
import {ErrorMaster} from '../lib/master2000/consulta.js';
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'secret'};
async function caso(options={},body={periodo:3,apellido:'Prueba'}){
 const calls=[],filters=[];
 const admin={auth:{getUser:async()=>options.expired?{error:{}}:{data:{user:{id:'own-user',user_metadata:options.metadata||{}}}},admin:{updateUserById:async(id,value)=>{calls.push(['save',id,value]);return{}}}},from(table){return{select(){return this},eq(k,v){filters.push([table,k,v]);return this},maybeSingle:async()=>({data:table==='perfiles'?{rol:options.rol||'estudiante'}:options.noStudent?null:{id:'own-student',activo:!options.inactive,nombre:'Persona Prueba Uno',documento:'1234567'}})}},rpc:async(name,args)=>{calls.push(['limit',name,args]);return options.limitError?{error:{}}:{data:!options.limited}}};
 const handler=crearHandlerMaster(()=>admin,async args=>{calls.push(['consult',args]);args.onProgress?.({codigo:'SELECTOR',mensaje:'Seleccionando Estudiante'});if(options.masterError)throw options.masterError;return {periodo:3,ano:2026,materias:[],consultado_en:'2026-10-16T01:00:00Z'}},env);
 const res={chunks:[],write(c){this.chunks.push(c)},end(){this.ended=true},headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(d){this.data=d;return this}};
 await handler({method:options.method||'POST',headers:options.noToken?{}:{authorization:'Bearer valid',...(options.stream?{accept:'application/x-ndjson'}:{})},body},res);return{...res,calls,filters};
}
let r=await caso();assert.equal(r.code,200);const consult=r.calls.find(c=>c[0]==='consult')[1];assert.equal(consult.documento,'1234567');assert.equal(consult.password,'1234567P');assert(r.filters.some(f=>f[1]==='auth_user_id'&&f[2]==='own-user'));assert.equal(r.headers['Cache-Control'],'private, no-store');assert(!JSON.stringify(r.data).includes('1234567'));assert(!JSON.stringify(r.calls.find(c=>c[0]==='save')).includes('1234567P'));
for(const o of [{noToken:true},{expired:true}])assert.equal((await caso(o)).code,401);
for(const o of [{rol:'profesor'},{rol:'acudiente'},{noStudent:true},{inactive:true}]){r=await caso(o);assert.equal(r.code,403);assert(!r.calls.some(c=>c[0]==='consult'))}
for(const b of [{periodo:0},{periodo:5},{periodo:3,documento:'other'},{periodo:3,estudiante:'other'},{periodo:3,url:'https://evil.invalid'},{periodo:3,materia:'../bad'},{periodo:3,password:'x',apellido:'x'.repeat(61)}])assert.equal((await caso({},b)).code,400);
assert.equal((await caso({limited:true})).code,429);assert.equal((await caso({limitError:true})).code,503);
r=await caso({metadata:{master2000_apellido:'Prueba'}},{periodo:3,materia:'072'});assert.equal(r.code,200);assert.equal(r.calls.find(c=>c[0]==='consult')[1].materia,'072');
r=await caso({},{periodo:3,password:'custom-password'});assert.equal(r.code,200);assert.equal(r.calls.find(c=>c[0]==='consult')[1].password,'custom-password');assert(!r.calls.some(c=>c[0]==='save'));
r=await caso({masterError:new Error('secret credential leaked')});assert.equal(r.code,503);assert(!JSON.stringify(r.data).includes('secret credential'));
r=await caso({masterError:new ErrorMaster('PERIODO_CERRADO','Período cerrado',409)});assert.equal(r.code,409);assert.equal(r.data.codigo,'PERIODO_CERRADO');
console.log('PASS Master API: sesión, ficha propia activa, roles, sin documentos arbitrarios, límites, clave inicial, clave actual, sin secretos en respuesta ni persistencia y errores.');

r=await caso({stream:true});let events=r.chunks.join('').trim().split('\n').map(JSON.parse);assert.deepEqual(events.map(e=>e.tipo),['progreso','progreso','resultado']);assert.equal(events[1].codigo,'SELECTOR');assert(r.ended);assert(!r.chunks.join('').includes('1234567P'));
r=await caso({stream:true,masterError:new ErrorMaster('MASTER_SELECTOR','No se mostró el selector')});events=r.chunks.join('').trim().split('\n').map(JSON.parse);assert.equal(events.at(-1).tipo,'error');assert.equal(events.at(-1).codigo,'MASTER_SELECTOR');assert(r.ended);
