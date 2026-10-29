import assert from 'node:assert/strict';
import {normalizarCorreoIngreso} from '../lib/correoIngreso.js';
import {crearHandlerEstudiante} from '../api/estudiante.js';
assert.equal(normalizarCorreoIngreso('deinerarboledaa'),'deinerarboledaa@claudinamunera.edu.co');
assert.equal(normalizarCorreoIngreso('deinerarboledaa@claudinamunera.edu.co'),'deinerarboledaa@claudinamunera.edu.co');
assert.equal(normalizarCorreoIngreso('  DEINERARBOLEDAA  '),'deinerarboledaa@claudinamunera.edu.co');
assert.equal(normalizarCorreoIngreso('Profe@Otro.edu.co'),'profe@otro.edu.co');
for(const valor of ['',null,undefined,{}])assert.equal(normalizarCorreoIngreso(valor),'');
async function ingresar(email){
 const calls=[];
 const admin={rpc:async(name,args)=>{calls.push([name,args]);return{data:name==='acudiente_registrar_intento'?true:{id:'student',email:'deinerarboledaa@claudinamunera.edu.co',crear:false,inicializar_password:false}}}};
 const auth={auth:{signInWithPassword:async args=>{calls.push(['signin',args]);return{data:{session:{access_token:'a',refresh_token:'r'}}}}}};
 const handler=crearHandlerEstudiante((url,key)=>key==='secret'?admin:auth,{SUPABASE_URL:'url',SUPABASE_SERVICE_ROLE_KEY:'secret',SUPABASE_ANON_KEY:'anon'});
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'POST',body:{email,password:'00123456'}},res);
 assert.equal(res.code,200);return calls;
}
const corto=await ingresar('deinerarboledaa'),completo=await ingresar('deinerarboledaa@claudinamunera.edu.co');
assert.deepEqual(corto,completo,'Ambas formas usan la misma identidad, límite de intentos y contraseña');
assert.equal(corto.find(([name])=>name==='signin')[1].password,'00123456');
console.log('PASS: usuario corto/correo completo equivalentes, normalización, otros dominios y contraseña intacta');
