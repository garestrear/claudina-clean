import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const memo=new Map();globalThis.localStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,v),removeItem:k=>memo.delete(k)};
const puentes=[{id:'z',titulo:'Zeta',grado_turno:6},{id:'b',titulo:'Brisa',grado_turno:6},{id:'p',titulo:'Primaria',grado_turno:2}].map(p=>({...p,version:1,integrantes:'Equipo',estado:'pendiente',categoria:'puentes_infantil'}));
let ctx={modalidad:'tres_intentos',orden_turnos:true,usuario:'docente',ahora:new Date().toISOString(),config:[{categoria:'puentes_infantil',inicial:1,incremento:1,limite:20,separacion:50,duracion_segundos:10}],mesa:{version:1,puente_id:'p',operador:'docente'},puentes,rondas:[]};
const ins={docente:true,usuario:'docente',ficha:null,companeros:[],puentes};
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{
 if(nombre==='feria_puentes_contexto')return {data:ctx};if(nombre==='feria_puentes_inscripcion_contexto')return {data:ins};
 if(args.accion==='seleccionar'){ctx={...ctx,mesa:{...ctx.mesa,version:ctx.mesa.version+1,puente_id:args.datos.puente_id,ronda_id:null}};return {data:ctx}}
 if(args.accion==='duracion'){ctx={...ctx,mesa:{...ctx.mesa,version:ctx.mesa.version+1},config:ctx.config.map(c=>({...c,duracion_segundos:args.datos.segundos}))};return {data:ctx}}
 if(args.accion==='iniciar'){ctx={...ctx,mesa:{...ctx.mesa,version:2,ronda_id:'r'},rondas:[{id:'r',puente_id:'p',carga_kg:5,resultado:'pendiente',cuenta_intento:true,fin:new Date(Date.now()+5000).toISOString()}]};return {data:ctx}}
 if(args.accion==='fallo'){ctx={...ctx,mesa:{...ctx.mesa,version:3},rondas:ctx.rondas.map(r=>({...r,resultado:'fallo'}))};return {data:ctx}}
 throw Error('RPC inesperada');
}};
try{
 await build({entryPoints:['src/FeriaPuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty'},plugins:[{name:'mocks',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,15));
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});
 const select=()=>tree.root.findByProps({'aria-label':'Seleccionar Brisa · 6° para la siguiente prueba'});
 assert.equal(select().props.disabled,false);
 const content=JSON.stringify(tree.toJSON());
 assert(content.indexOf('Panel de control de prueba')<content.indexOf('bridgeRankings'));
 assert(content.indexOf('bridgeRankings')<content.indexOf('Puentes inscritos e inscripción'));
 const {seccionDe,seccionesDocente}=await import('../src/navegacionProfesor.js');
 assert.equal(seccionDe('puentes'),'actividades');
 assert(seccionesDocente.find(s=>s.id==='actividades').paginas.includes('puentes'));
 await act(async()=>{select().props.onClick();await tick()});
 assert.equal(ctx.mesa.puente_id,'b');assert.equal(select().props['aria-pressed'],true);
 assert.equal(tree.root.findAllByType('select').find(n=>n.parent.children[0]==='Puente en turno').props.value,'b');
 const input=()=>tree.root.findByProps({'aria-label':'Carga elegida en kg'});
 await act(async()=>input().props.onChange({target:{value:'5'}}));
 await act(async()=>{input().parent.parent.props.onSubmit({preventDefault(){}});await tick()});
 assert.equal(select().props.disabled,true,'No permite cambiar la mesa durante un intento pendiente');
 await act(async()=>tree.unmount());
 console.log('PASS Actividades, orden del panel, inscripción desplegable, selección desde clasificación y bloqueo durante intento');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase}
