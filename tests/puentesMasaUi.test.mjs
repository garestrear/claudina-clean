import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const puente={id:'a',categoria:'puentes_infantil',titulo:'Puente A',masa_g:80,integrantes:'Equipo',estado:'pendiente'};
let ctx={modalidad:'tres_intentos',usuario:'docente',ahora:new Date().toISOString(),config:[{categoria:'puentes_infantil',inicial:5,incremento:1,limite:20,separacion:50,duracion_segundos:10}],mesa:{version:1,puente_id:'a',operador:'docente'},puentes:[puente],rondas:[]};
let calls=[];
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{if(nombre==='feria_puentes_contexto')return {data:ctx};calls.push(args);return {data:ctx}}};
try{
 await build({entryPoints:['src/FeriaPuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty','.ttf':'dataurl'},plugins:[{name:'mocks',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}));b.onLoad({filter:/PuentesInscripcion.jsx$/},()=>({contents:'export default function Inscripcion(){return null};export function FotoPuente(){return null}'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,15));
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});
 const seleccionar=()=>tree.root.findAllByType('select').find(n=>n.parent.type==='label'&&n.parent.children[0]==='Puente inscrito');
 const revisar=async(estado,rondas)=>{
  await act(async()=>{tree.unmount()});
  ctx={...ctx,ahora:new Date().toISOString(),puentes:[{...puente,estado}],rondas};
  await act(async()=>{tree=create(React.createElement(Panel));await tick()});
  await act(async()=>seleccionar().props.onChange({target:{value:'a'}}));
  return tree.root.findByProps({name:'masa_g'});
 };
 for(const estado of ['finalizado','descalificado']){
  const masa=await revisar(estado,[]);
  assert.equal(masa.props.disabled,false);
  assert.equal(tree.root.findByProps({name:'largo_cm'}).props.disabled,true);
  const form=seleccionar().parent.parent;
  const Original=globalThis.FormData;
  globalThis.FormData=class{*[Symbol.iterator](){yield ['masa_g','120']}};
  try{await act(async()=>{form.props.onSubmit({preventDefault(){},currentTarget:{}});await tick()})}finally{globalThis.FormData=Original}
  assert.equal(calls.at(-1).accion,'masa');
  assert.deepEqual(calls.at(-1).datos,{masa_g:'120',puente_id:'a'});
 }
 const masa=await revisar('en_prueba',[{id:'r',puente_id:'a',resultado:'pendiente'}]);
 assert.equal(masa.parent.parent.parent.props.disabled,true);
 await act(async()=>tree.unmount());
 console.log('PASS UI: masa editable en finalizados/descalificados, payload exclusivo y bloqueo durante el intento');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase}
