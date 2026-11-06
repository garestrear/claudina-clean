import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=await mkdtemp(new URL('../.final-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={confirm:()=>true,prompt:()=> 'Longitud inferior al requisito'};
const p={id:'original',version:1,categoria:'puentes_infantil',titulo:'Puente A',masa_g:80,integrantes:'Equipo',estado:'finalizado'};
let ctx={fases:true,fase:'eliminatoria',final_preparada:false,modalidad:'tres_intentos',usuario:'docente',ahora:new Date().toISOString(),config:[{categoria:'puentes_infantil',inicial:1,incremento:1,limite:100,separacion:10,duracion_segundos:10}],mesa:{version:1},puentes:[p],rondas:[]};
let calls=[];
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{if(nombre==='feria_puentes_contexto')return {data:ctx};calls.push({rpc:nombre,...args});if(nombre==='feria_puentes_descalificar'){ctx={...ctx,mesa:{...ctx.mesa,version:ctx.mesa.version+1},puentes:ctx.puentes.map(p=>({...p,estado:'descalificado'}))};return {data:{}}}if(args.accion==='seleccionar'){ctx={...ctx,mesa:{...ctx.mesa,version:ctx.mesa.version+1,puente_id:args.datos.puente_id,operador:'docente'}};return {data:ctx}}const fase=args.accion==='preparar-final'?'final':args.datos.fase;ctx={...ctx,fase,final_preparada:true,mesa:{version:ctx.mesa.version+1},puentes:fase==='final'?[{...p,id:'finalista',estado:'pendiente'}]:[p]};return {data:ctx}}};
try{
 await build({entryPoints:['src/FeriaPuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty','.ttf':'text'},plugins:[{name:'mocks',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}));b.onLoad({filter:/PuentesInscripcion.jsx$/},()=>({contents:'export default function Inscripcion(){return null};export function FotoPuente(){return null}'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,10));
 const btn=t=>tree.root.findAllByType('button').find(b=>b.children.join('')===t);
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});
 await act(async()=>{btn('Preparar gran final · 5 juveniles y 6 infantiles').props.onClick();await tick()});
 assert.equal(calls[0].accion,'preparar-final');assert(btn('Gran final').props['aria-pressed']);
 await act(async()=>{tree.root.findByProps({'aria-label':'Seleccionar Puente A · Grado por registrar para la siguiente prueba'}).props.onClick();await tick()});
 assert.equal(tree.root.findByProps({'aria-label':'Carga elegida en kg'}).props.value,'');
 await act(async()=>{btn('Consultar eliminatoria').props.onClick();await tick()});
 assert.equal(calls.at(-1).datos.fase,'eliminatoria');
 assert(tree.root.findAllByType('button').filter(b=>b.props.className==='bridgeSelectTurn').every(b=>b.props.disabled),'Eliminatoria en consulta');
 assert(tree.root.findAllByProps({className:'bridgeSelectTurn'}).length>0,'Los finalizados se ven en el archivo');
 await act(async()=>{btn('Descalificar y recalcular · Puente A').props.onClick();await tick()});
 assert.equal(calls.at(-1).rpc,'feria_puentes_descalificar');assert.equal(calls.at(-1).puente,'original');assert.equal(calls.at(-1).version_esperada,1);assert.equal(calls.at(-1).motivo,'Longitud inferior al requisito');assert(!btn('Descalificar y recalcular · Puente A'),'no ofrece descalificar otra vez');
 await act(async()=>tree.unmount());console.log('PASS reclasificación UI: corrección desde archivo, motivo, confirmación, versión y recarga de clasificación');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase;delete globalThis.window}
