import assert from 'node:assert/strict';
import {crearHandlerJurado} from '../api/jurado.js';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const jurado={id:id(10),nombre:'Jurado externo',correo:'externo@ejemplo.co',habilitado:true,cuenta_id:null,usuario:null};
const users=new Map([[id(1),{id:id(1),email:'profe@ejemplo.co',password:'Docente-Intacta'}]]);let crea=0,envios=0,pending=true,borrados=0,intentos=true;
const api={auth:{getUser:async token=>({data:{user:token==='docente'?users.get(id(1)):token==='jurado'?users.get(id(50)):null},error:null}),admin:{createUser:async d=>{crea++;assert(d.email_confirm);assert.equal(d.user_metadata.tipo_cuenta,'jurado');const user={id:id(50),...d};users.set(user.id,user);return {data:{user},error:null}},deleteUser:async()=>{borrados++},getUserById:async key=>({data:{user:users.get(key)}}),updateUserById:async(key,d)=>{Object.assign(users.get(key),d);return {error:null}}}},from:table=>({select:()=>{const filtros={};const q={eq:(k,v)=>{filtros[k]=v;return q},maybeSingle:async()=>{if(table==='perfiles')return {data:filtros.id===id(1)?{rol:'profesor'}:null};return {data:Object.entries(filtros).every(([k,v])=>jurado[k]===v)?{...jurado}:null}}};return q}}),rpc:async(name,args)=>{
 if(name==='feria_jurado_intento')return {data:intentos};
 if(name==='feria_jurado_cuenta_vincular'){jurado.cuenta_id=args.cuenta;jurado.usuario=args.usuario_nuevo;pending=true;return {error:null}}
 if(name==='feria_jurado_password_cambiada')pending=false;if(name==='feria_jurado_password_requerida')pending=true;return {error:null};
}};
const auth={auth:{signInWithPassword:async({email,password})=>{const u=[...users.values()].find(u=>u.email===email&&u.password===password);return u?{data:{user:u,session:{access_token:'token-jurado',refresh_token:'refresh-jurado'}}}:{data:{},error:{message:'incorrecto'}}},signInWithOtp:()=>{envios++;throw Error('No enviar correo')}}};
const handler=crearHandlerJurado((url,key)=>key==='service-secret'?api:auth,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret',SUPABASE_ANON_KEY:'anon'});
async function req(body,token,method='POST'){let result;const res={setHeader:(k,v)=>assert.equal(v,'no-store'),status(n){this.code=n;return this},json(d){result={code:this.code,data:d};return this}};await handler({method,body,headers:token?{authorization:'Bearer '+token}:{}},res);return result}
assert.equal((await req({accion:'crear'},null)).code,401);
assert.equal((await req({accion:'crear'},'jurado')).code,401);
const datos={accion:'crear',persona:jurado.id,usuario:'jurado.01',password:'Inicial-Jurado-2026'};
assert.equal((await req({...datos,password:'123'},'docente')).code,400);
let r=await req(datos,'docente');assert.equal(r.code,200);assert.equal(r.data.usuario,'jurado.01');assert.equal(r.data.password,undefined);assert.equal(crea,1);assert.equal(users.get(id(1)).password,'Docente-Intacta');
assert.equal((await req(datos,'docente')).code,409);
assert.equal((await req({accion:'ingresar',usuario:'jurado.01',password:'mala'})).code,401);
r=await req({accion:'ingresar',usuario:'JURADO.01',password:datos.password});assert.equal(r.code,200);assert(r.data.access_token);
assert.equal((await req({accion:'cambiar-password',actual:datos.password,password:datos.password},'jurado')).code,400);
assert.equal((await req({accion:'cambiar-password',actual:'incorrecta',password:'Personal-Jurado-2026'},'jurado')).code,401);
assert.equal((await req({accion:'cambiar-password',actual:datos.password,password:'Personal-Jurado-2026'},'jurado')).code,200);assert.equal(pending,false);
assert.equal((await req({accion:'restablecer',persona:jurado.id,password:'Otra-Inicial-2026'},'jurado')).code,403);
assert.equal((await req({accion:'restablecer',persona:jurado.id,password:'Otra-Inicial-2026'},'docente')).code,200);assert(pending);assert.equal(users.get(id(1)).password,'Docente-Intacta');
assert.equal((await req({accion:'ingresar',usuario:'jurado.01',password:'Personal-Jurado-2026'})).code,401);
intentos=false;assert.equal((await req({accion:'ingresar',usuario:'jurado.01',password:'Otra-Inicial-2026'})).code,429);intentos=true;
jurado.habilitado=false;assert.equal((await req({accion:'ingresar',usuario:'jurado.01',password:'Otra-Inicial-2026'})).code,401);
assert.equal((await req({},null,'GET')).code,405);assert.equal(envios,0);assert.equal(borrados,0);
console.log('PASS API: cuentas sin correo, permisos, usuario/contraseña, cambio inicial, restablecimiento, rate limit, docente intacto y datos de credenciales sin persistencia');
