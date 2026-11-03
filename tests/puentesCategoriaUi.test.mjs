import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const memo=new Map();globalThis.localStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,v),removeItem:k=>memo.delete(k)};
const puentes=[{id:'z',titulo:'Zeta',grado_turno:6},{id:'b',titulo:'Brisa',grado_turno:6},{id:'p',titulo:'Primaria',grado_turno:2}].map(p=>({...p,version:1,integrantes:'Equipo',estado:'pendiente',categoria:p.id==='z'?'puentes_juvenil':'puentes_infantil'}));
let ctx={modalidad:'tres_intentos',orden_turnos:true,usuario:'docente',ahora:new Date().toISOString(),config:[{categoria:'puentes_infantil',inicial:1,incremento:1,limite:20,separacion:50}],mesa:{version:1,puente_id:'p',operador:'docente'},puentes,rondas:[]};
const ins={docente:true,usuario:'docente',ficha:null,companeros:[],puentes};
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{
 if(nombre==='feria_puentes_contexto')return {data:ctx};if(nombre==='feria_puentes_inscripcion_contexto')return {data:ins};
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
 const filtro=()=>tree.root.findByProps({'aria-label':'Filtrar categoría de puentes'});
 const option=selector().findAllByType('option').find(o=>o.props.value==='p');assert(option.children.join('').startsWith('Primaria · 2°'));
 await act(async()=>filtro().props.onChange({target:{value:'puentes_juvenil'}}));
 const turno=()=>tree.root.findAllByType('select').find(n=>n.parent.children[0]==='Puente en turno');
 assert.deepEqual(turno().findAllByType('option').filter(n=>n.props.value).map(n=>n.props.value),['z']);
 assert.deepEqual(cards(),['Zeta · 6°']);
 assert.equal(tree.root.findAllByType('table').length,2,'El historial conserva su tabla además de la categoría visible');
 assert.equal(ctx.mesa.puente_id,'p','Filtrar no cambia la mesa');
 await act(async()=>filtro().props.onChange({target:{value:'puentes_infantil'}}));
 assert.deepEqual(turno().findAllByType('option').filter(n=>n.props.value).map(n=>n.props.value),['p','b']);assert.deepEqual(cards(),['Primaria · 2°','Brisa · 6°']);
 await act(async()=>filtro().props.onChange({target:{value:''}}));assert.deepEqual(cards(),['Primaria · 2°','Brisa · 6°','Zeta · 6°']);
 await act(async()=>tree.unmount());
 console.log('PASS categoría UI: grado al final del nombre, Todas/Juvenil/Infantil, selector y fichas filtrados, orden y mesa conservados');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase}
