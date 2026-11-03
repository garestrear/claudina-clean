import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const memo=new Map();globalThis.localStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,v),removeItem:k=>memo.delete(k)};
const puentes=[{id:'z',titulo:'Zeta',grado_turno:6},{id:'b',titulo:'Brisa',grado_turno:6},{id:'p',titulo:'Primaria',grado_turno:2}].map(p=>({...p,version:1,integrantes:'Equipo',estado:p.id==='z'?'finalizado':p.id==='b'?'descalificado':'pendiente',categoria:'puentes_infantil'}));
let ctx={modalidad:'tres_intentos',orden_turnos:true,usuario:'docente',ahora:new Date().toISOString(),config:[{categoria:'puentes_infantil',inicial:1,incremento:1,limite:20,separacion:50}],mesa:{version:1,puente_id:'p',operador:'docente'},puentes,rondas:[]};
const ins={docente:true,usuario:'docente',ficha:null,companeros:[],puentes};
globalThis.__puentesSupabase={rpc:async(nombre,args)=>{
 if(nombre==='feria_puentes_contexto')return {data:ctx};if(nombre==='feria_puentes_inscripcion_contexto')return {data:ins};
 if(args.accion==='iniciar'){ctx={...ctx,mesa:{...ctx.mesa,version:2,ronda_id:'r'},rondas:[{id:'r',puente_id:'p',carga_kg:5,resultado:'pendiente',cuenta_intento:true,fin:new Date(Date.now()+5000).toISOString()}]};return {data:ctx}}
 if(args.accion==='fallo'){ctx={...ctx,mesa:{...ctx.mesa,version:3},puentes:ctx.puentes.map(p=>p.id==='p'?{...p,estado:'finalizado'}:p),rondas:ctx.rondas.map(r=>({...r,resultado:'fallo'}))};return {data:ctx}}
 throw Error('RPC inesperada');
}};
try{
 await build({entryPoints:['src/FeriaPuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react'],loader:{'.css':'empty'},plugins:[{name:'mocks',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:'export const supabase=globalThis.__puentesSupabase;'}))}}]});
 const {default:Panel}=await import(dir+'/app.mjs');let tree;const tick=()=>new Promise(r=>setTimeout(r,15));
 await act(async()=>{tree=create(React.createElement(Panel));await tick()});
 const selector=()=>tree.root.findAllByType('select').find(n=>n.props.value==='p');
 const order=()=>selector().findAllByType('option').filter(n=>n.props.value).map(n=>n.props.value);
 const cards=()=>tree.root.findAllByType('article').map(n=>n.findByType('h3').children.join(''));
 assert.deepEqual(order(),['p']);assert.deepEqual(cards(),['Primaria']);
 const filtro=()=>tree.root.findAllByType('input').find(n=>n.props.type==='checkbox');
 assert.equal(filtro().props.checked,true);
 await act(async()=>filtro().props.onChange({target:{checked:false}}));assert.deepEqual(order(),['p','b','z']);assert.deepEqual(cards(),['Primaria','Brisa','Zeta']);
 await act(async()=>filtro().props.onChange({target:{checked:true}}));
 const input=()=>tree.root.findByProps({'aria-label':'Carga elegida en kg'});
 await act(async()=>input().props.onChange({target:{value:'5'}}));
 await act(async()=>{input().parent.parent.props.onSubmit({preventDefault(){}});await tick()});
 const fallo=tree.root.findAllByType('button').find(n=>n.children.join('')==='Falló · puede continuar');
 await act(async()=>{fallo.props.onClick();await tick()});
 assert.equal(tree.root.findAllByType('option').filter(n=>n.props.value).length,3,'Solo el selector de mediciones conserva todos los puentes');
 assert.deepEqual(cards(),[],'La ficha del puente finalizado desaparece inmediatamente');
 const turno=tree.root.findAllByType('select')[0];assert.equal(turno.props.value,'');
 assert(tree.root.findAllByProps({role:'status'}).some(n=>n.children.join('').includes('No quedan puentes en competencia')));
 await act(async()=>filtro().props.onChange({target:{checked:false}}));assert.deepEqual(cards(),['Brisa','Zeta','Primaria']);
 await act(async()=>tree.unmount());
 console.log('PASS filtro UI: activo inicialmente, oculta finalizados y descalificados, permite mostrar todos y retira al puente al finalizar sin recargar');
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.__puentesSupabase}
