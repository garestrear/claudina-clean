import assert from 'node:assert/strict';
import {crearHandlerJurado} from '../api/jurado.js';
const reservas=new Map(),users=new Map();let creadas=0,borradas=0,fallar=false;
const api={auth:{getUser:async token=>({data:{user:token?{id:token}:null}}),admin:{createUser:async datos=>{assert.equal(datos.password,'Inicial-Test-2026');assert.equal(datos.email_confirm,true);assert(!datos.options);if([...users.values()].some(u=>u.email===datos.email))return {data:{},error:{}};const user={id:String(++creadas),...datos};users.set(user.id,user);return {data:{user}}},deleteUser:async id=>{borradas++;users.delete(id)}}},from:table=>({select:()=>{let filtro;return {eq(k,v){filtro=v;return this},async maybeSingle(){return {data:table==='perfiles'?(filtro==='profesor'?{rol:'profesor'}:null):reservas.get(filtro)}}}}}),rpc:async(name,args)=>{assert.equal(name,'feria_jurado_banco_registrar');if(fallar)return {error:{}};reservas.set(args.usuario_nuevo,{usuario:args.usuario_nuevo,cuenta_id:args.cuenta});return {error:null}}};
const h=crearHandlerJurado(()=>api,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'secret'});
async function req(numero,token='profesor'){let salida;const res={setHeader(){},status(code){this.code=code;return this},json(data){salida={code:this.code,data};return this}};await h({method:'POST',body:{accion:'preparar-cuenta',numero,password:'Inicial-Test-2026'},headers:token?{authorization:'Bearer '+token}:{}},res);return salida}
assert.equal((await req(1,null)).code,401);assert.equal((await req(1,'jurado')).code,403);
for(const n of [0,21,1.5,'1'])assert.equal((await req(n)).code,400);
for(let n=1;n<=20;n++)assert.equal((await req(n)).code,200);
assert.equal(creadas,20);assert.equal(reservas.size,20);
users.get('1').password='Nueva-personal-123';for(let n=1;n<=20;n++)assert.equal((await req(n)).data.existente,true);
assert.equal(creadas,20);assert.equal(users.get('1').password,'Nueva-personal-123');assert.equal(borradas,0);
reservas.delete('jurado20');assert.equal((await req(20)).code,409,'colisión no restablece cuenta existente');assert.equal(borradas,0);
users.delete('20');fallar=true;assert.equal((await req(20)).code,409);assert.equal(borradas,1,'limpia solo la cuenta recién creada que no pudo registrar');
console.log('PASS API banco: permisos, 20 cuentas sin correos, reintento sin cambiar contraseñas, colisiones y limpieza');
