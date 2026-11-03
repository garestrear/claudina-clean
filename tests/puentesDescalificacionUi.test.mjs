import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const memo=new Map();globalThis.localStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,v),removeItem:k=>memo.delete(k)};
const p={id:'a',version:1,titulo:'Puente A',estado:'pendiente',categoria:'puentes_infantil',integrantes:'Ana',bloqueado:false};
let ctx={usuario:'docente',docente:true,ficha:null,companeros:[],puentes:[p]},calls=[],perder=true,updates=0;
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{
 if(nombre==='feria_puentes_inscripcion_contexto')return {data:ctx};
 calls.push({nombre,args});if(perder){perder=false;throw Error('Respuesta perdida')}
 ctx={...ctx,puentes:[{...p,version:2,estado:'descalificado',bloqueado:true,motivo_fin:args.motivo}]};return {data:ctx};
}};
try{
 await build({entryPoints:['src/PuentesInscripcion.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty'},plugins:[{name:'mock',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,15));
 await act(async()=>{tree=create(React.createElement(Panel,{onGuardar:()=>updates++}));await tick()});
 const btn=()=>tree.root.findAllByType('button').find(b=>b.props['aria-label']==='Descalificar puente Puente A');
 globalThis.window={prompt:()=>null,confirm:()=>true};
 await act(async()=>{await btn().props.onClick()});assert.equal(calls.length,0);
 window.prompt=()=> 'No cumple las medidas';window.confirm=()=>false;
 await act(async()=>{await btn().props.onClick()});assert.equal(calls.length,0);
 window.confirm=()=>true;
 await act(async()=>{await btn().props.onClick();await tick()});assert.equal(calls.length,1);
 await act(async()=>{await btn().props.onClick();await tick()});assert.deepEqual(calls[0],calls[1]);
 assert.equal(calls[1].nombre,'feria_puentes_descalificar');assert.equal(calls[1].args.motivo,'No cumple las medidas');
 assert.equal(btn(),undefined);assert.equal(updates,1);
 assert(tree.root.findAllByProps({role:'status'}).some(n=>n.children.includes('No cumple las medidas')));
 assert(!tree.root.findAllByType('button').some(b=>b.children.join('')==='Editar inscripción'));
 await act(async()=>tree.unmount());
 ctx={...ctx,docente:false,usuario:'estudiante'};
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});assert.equal(btn(),undefined);
 await act(async()=>tree.unmount());
 console.log('PASS descalificación UI: cancelación, confirmación, reintento idéntico, motivo visible, actualización de tablero y permisos');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase;delete globalThis.window}
