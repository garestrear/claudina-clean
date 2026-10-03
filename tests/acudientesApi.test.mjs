import assert from 'node:assert/strict';
import {crearHandlerAcudiente} from '../api/acudiente.js';
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'secret',SUPABASE_ANON_KEY:'anon'};
async function caso(options={},body={documento:'123456789',password:'123456789'}){
 const events=[];let account=options.exists?{auth_user_id:'parent'}:null;
 const admin={from(table){return{select(){return this},eq(){return this},async maybeSingle(){return{data:table==='estudiantes'?(options.noStudent?null:{id:'child',documento:'123456789',activo:true}):table==='perfiles'?{rol:options.role||'profesor'}:account}}}},async rpc(name,args){events.push(name);if(name==='acudiente_registrar_intento')return options.missing?{error:{}}:{data:!options.limited};account={auth_user_id:options.race?'winner':'parent'};return{data:account.auth_user_id}},auth:{async getUser(){return{data:{user:{id:'teacher'}}}},admin:{async createUser(data){events.push('create');assert(!data.email.includes('123456789'));assert.equal(data.password,'123456789');return{data:{user:{id:'parent'}}}},async deleteUser(id){events.push('delete:'+id)},async getUserById(id){events.push('get:'+id);return{data:{user:{email:'opaque@example.invalid'}}}},async updateUserById(id,data){events.push('reset');assert.equal(data.password,'123456789');return{}}}}};
 const anon={auth:{async signInWithPassword(data){events.push('signin');return data.password===(options.changed?'newpass':'123456789')?{data:{session:{access_token:'access',refresh_token:'refresh'}}}:{error:{},data:{}}}}};
 const handler=crearHandlerAcudiente((url,key)=>key==='secret'?admin:anon,env);const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'POST',body,headers:{authorization:'Bearer token'}},res);return{...res,events};
}
let r=await caso();assert.equal(r.code,200);assert.deepEqual(r.data,{access_token:'access',refresh_token:'refresh'});assert(r.events.indexOf('vincular_cuenta_acudiente')<r.events.indexOf('signin'));
r=await caso({exists:true,changed:true},{documento:'123456789',password:'newpass'});assert.equal(r.code,200);assert(!r.events.includes('create'));
assert.equal((await caso({exists:true,changed:true})).code,401);assert.equal((await caso({noStudent:true})).code,401);
assert.equal((await caso({},{documento:'123456789',password:'wrong'})).code,401);
assert.equal((await caso({limited:true})).code,429);assert.equal((await caso({missing:true})).code,503);
r=await caso({race:true});assert.equal(r.code,200);assert(r.events.includes('delete:parent'));assert(r.events.includes('get:winner'));
assert.equal((await caso({exists:true},{accion:'restablecer',estudiante:'child'})).code,200);assert.equal((await caso({role:'acudiente'},{accion:'restablecer',estudiante:'child'})).code,403);
console.log('PASS: ingreso inicial y contraseña cambiada; errores; límites; migración pendiente; vinculación antes de sesión; concurrencia; restablecimiento exclusivo profesor');
