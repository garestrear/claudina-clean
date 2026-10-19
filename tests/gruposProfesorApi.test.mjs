import assert from 'node:assert/strict';
import {crearHandlerGrupos} from '../api/grupos-profesor.js';
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
async function caso(body={accion:'guardar',profesorId:target,grupos:['0','6']},options={}){
 const writes=[],reads=[];let selected;
 const db={auth:{getUser:async()=>options.badAuth?{error:{}}:{data:{user:{id:actor}}},admin:{getUserById:async id=>{reads.push(id);return{data:{user:{id,user_metadata:{otro_dato:'conservar',grupos_interes:['6']}}}}},updateUserById:async(id,payload)=>{writes.push({id,payload});return options.fail?{error:{}}:{}}}},from(table){return{select(){return this},eq(_k,id){selected=id;return this},async maybeSingle(){if(table==='administradores_docentes')return{data:options.nonAdmin?null:{id:actor}};return{data:{id:selected,rol:selected===actor?(options.role||'profesor'):(options.targetRole||'profesor')}}}}}};
 const handler=crearHandlerGrupos(()=>db,{SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'});const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:options.method||'POST',headers:options.noToken?{}:{authorization:'Bearer test'},body},res);return{...res,writes,reads};
}
let r=await caso();assert.equal(r.code,200);assert.deepEqual(r.data.grupos,['0','6']);assert.equal(r.writes[0].id,target);assert.deepEqual(r.writes[0].payload,{user_metadata:{otro_dato:'conservar',grupos_interes:['0','6']}});
r=await caso({accion:'consultar',profesorId:target});assert.equal(r.code,200);assert.deepEqual(r.data.grupos,['6']);assert.equal(r.writes.length,0);
for(const role of ['estudiante','acudiente']){r=await caso(undefined,{role});assert.equal(r.code,403);assert.equal(r.reads.length,0);assert.equal(r.writes.length,0)}
r=await caso(undefined,{targetRole:'estudiante'});assert.equal(r.code,404);assert.equal(r.writes.length,0);
for(const grupos of [[],['9'],['7'],[0],['0','0'],null]){r=await caso({accion:'guardar',profesorId:target,grupos});assert.equal(r.code,400);assert.equal(r.writes.length,0)}
assert.equal((await caso(undefined,{noToken:true})).code,401);assert.equal((await caso(undefined,{badAuth:true})).code,401);assert.equal((await caso(undefined,{method:'GET'})).code,405);assert.equal((await caso(undefined,{fail:true})).code,503);
r=await caso(undefined,{nonAdmin:true});assert.equal(r.code,403);assert.equal(r.writes.length,0);
console.log('PASS: asignación de grupos de otro profesor y grado 0; consulta sin cambios; validación de grupos; solo administradores; solo cuenta docente; metadatos conservados; errores sin éxito falso');
