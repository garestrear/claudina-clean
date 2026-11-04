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
 if(args.accion==='duracion'){ctx={...ctx,mesa:{...ctx.mesa,version:ctx.mesa.version+1},config:ctx.config.map(c=>({...c,duracion_segundos:args.datos.segundos}))};return {data:ctx}}
 if(args.accion==='iniciar'){ctx={...ctx,mesa:{...ctx.mesa,version:2,ronda_id:'r'},rondas:[{id:'r',puente_id:'p',carga_kg:5,resultado:'pendiente',cuenta_intento:true,fin:new Date(Date.now()+5000).toISOString()}]};return {data:ctx}}
 if(args.accion==='fallo'){ctx={...ctx,mesa:{...ctx.mesa,version:3},rondas:ctx.rondas.map(r=>({...r,resultado:'fallo'}))};return {data:ctx}}
 throw Error('RPC inesperada');
}};
try{
 await build({entryPoints:['src/FeriaPuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty'},plugins:[{name:'mocks',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,15));
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});
 const selector=()=>tree.root.findAllByType('select').find(n=>n.props.value==='p');
 const order=()=>selector().findAllByType('option').filter(n=>n.props.value).map(n=>n.props.value);
 const cards=()=>tree.root.findAllByType('article').map(n=>n.findByType('h3').children.join(''));
 assert.deepEqual(order(),['p','b','z']);assert.deepEqual(cards(),['Primaria · 2°','Brisa · 6°','Zeta · 6°']);
 const duracion=()=>tree.root.findByProps({'aria-label':'Duración del intento en segundos'});
 assert.equal(duracion().props.value,10);
 await act(async()=>duracion().props.onChange({target:{value:'20'}}));
 await act(async()=>{duracion().parent.parent.props.onSubmit({preventDefault(){}});await tick()});assert.equal(duracion().props.value,20);
 const input=()=>tree.root.findByProps({'aria-label':'Carga elegida en kg'});
 await act(async()=>input().props.onChange({target:{value:'5'}}));
 await act(async()=>{input().parent.parent.props.onSubmit({preventDefault(){}});await tick()});
 const fallo=tree.root.findAllByType('button').find(n=>n.children.join('')==='Falló · puede continuar');
 await act(async()=>{fallo.props.onClick();await tick()});
 const tabla=tree.root.findAllByType('table')[0];assert.deepEqual(tabla.findByType('tbody').findAllByType('tr').map(n=>n.findAllByType('td')[1].children[0]),['Primaria · 2°','Brisa · 6°','Zeta · 6°']);
 assert.deepEqual(order(),['b','z','p']);assert.deepEqual(cards(),['Brisa · 6°','Zeta · 6°','Primaria · 2°']);assert.equal(selector().props.value,'p','El orden no cambia automáticamente el puente de la mesa');
 await act(async()=>tree.unmount());
 console.log('PASS orden UI: selector y tarjetas se reordenan tras cada intento y conservan el puente seleccionado');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase}
