import React from 'react';import {create,act} from 'react-test-renderer';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const listeners=new Map(),clases=new Set();let timer=null,intervalos=0;
const si=globalThis.setInterval,ci=globalThis.clearInterval;
globalThis.setInterval=(fn,ms)=>{assert.equal(ms,8000);timer=fn;return ++intervalos};globalThis.clearInterval=()=>{timer=null};
globalThis.window={innerWidth:1280,innerHeight:720,addEventListener:(e,fn)=>listeners.set(e,fn),removeEventListener:e=>listeners.delete(e)};
globalThis.document={body:{classList:{add:c=>clases.add(c),remove:c=>clases.delete(c)}}};
const puentes=Array.from({length:25},(_,i)=>({id:String(i),titulo:'Puente '+i,grado_turno:6,categoria:'puentes_juvenil',estado:i===0?'en_prueba':'pendiente',masa_g:80,integrantes:'Ana y Bruno'}));
const datos={puentes,rondas:[{id:'r',puente_id:'0',carga_kg:8.5,resultado:'pendiente',cuenta_intento:true,fin:new Date(5000).toISOString()}],mesa:{puente_id:'0',ronda_id:'r'}};
try{
 await build({entryPoints:['src/PuentesProyeccion.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty'},plugins:[{name:'mock',setup(b){b.onLoad({filter:/PuentesInscripcion.jsx$/},()=>({contents:'export function FotoPuente(){return null}'}))}}]});
 const {default:Panel,filasProyeccion}=await import(dir+'/app.mjs');let tree,cat='puentes_juvenil';const props=()=>({datos,categoria:cat,onCategoria:v=>cat=v,ahora:2000,error:'',fresco:true,onActualizar:()=>{}});
 await act(async()=>{tree=create(React.createElement(Panel,props()))});
 const rows=()=>tree.root.findByType('tbody').findAllByType('tr');
 assert.equal(rows().length,filasProyeccion(1280,720));assert.equal(rows().length,10);
 assert.equal(tree.root.findByProps({role:'timer'}).findByType('strong').children.join(''),'3');
 assert(clases.has('bridgeProjectionActive'));
 const ids=()=>rows().map(r=>r.findAllByType('td')[1].props.title);
 const antes=ids();await act(async()=>timer());assert.notDeepEqual(ids(),antes,'Rotación automática muestra otros puentes');
 const btn=t=>tree.root.findAllByType('button').find(b=>b.children.join('')===t);
 await act(async()=>btn('Pausar rotación').props.onClick());assert.equal(timer,null);
 await act(async()=>tree.root.findByProps({'aria-label':'Página siguiente'}).props.onClick());assert(rows().length<=10);
 window.innerWidth=390;window.innerHeight=844;await act(async()=>listeners.get('resize')());assert(rows().length<=filasProyeccion(390,844));
 await act(async()=>btn('Infantil').props.onClick());await act(async()=>tree.update(React.createElement(Panel,props())));assert.equal(rows().length,0);assert(tree.root.findAllByProps({className:'bridgeShowEmpty'}).length);
 await act(async()=>tree.update(React.createElement(Panel,{...props(),datos:null,error:'Error de conexión',fresco:false})));assert(tree.root.findAllByProps({role:'alert'}).length);
 await act(async()=>tree.unmount());assert(!clases.has('bridgeProjectionActive'));assert.equal(listeners.size,0);
 console.log('PASS proyección UI: cuenta regresiva, páginas adaptables, rotación automática, pausa, navegación, cambio de categoría, estado vacío y limpieza');
}finally{globalThis.setInterval=si;globalThis.clearInterval=ci;delete globalThis.window;delete globalThis.document;await rm(dir,{recursive:true,force:true})}
