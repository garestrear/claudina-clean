import React from 'react';import {create,act} from 'react-test-renderer';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=await mkdtemp(new URL('../.puentes-ui-',import.meta.url).pathname);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copiado='',compartido=null,cerrado=0,escape=null,seleccionado=false;
const navegador={clipboard:{writeText:async t=>copiado=t},share:async d=>compartido=d};Object.defineProperty(globalThis,'navigator',{value:navegador,configurable:true});
globalThis.document={activeElement:{focus(){}},addEventListener:(e,fn)=>escape=fn,removeEventListener:()=>escape=null};
globalThis.window={open:()=>{throw Error('No debe abrir WhatsApp durante la prueba')}};
const datos={ahora:'2026-11-04T00:30:00Z',puentes:[{id:'a',titulo:'Infantil',grado_turno:2,categoria:'puentes_infantil',estado:'pendiente'},{id:'b',titulo:'Juvenil',grado_turno:8,categoria:'puentes_juvenil',estado:'pendiente'}],rondas:[]};
try{
 await build({entryPoints:['src/InformePuentes.jsx'],bundle:true,platform:'node',format:'esm',outfile:dir+'/app.mjs',external:['react']});const {default:Panel}=await import(dir+'/app.mjs');let tree;
 await act(async()=>tree=create(React.createElement(Panel,{datos,onCerrar:()=>cerrado++}),{createNodeMock:e=>e.type==='textarea'?{focus(){},select(){seleccionado=true}}:{querySelector(){return{focus(){}}}}}));
 const btn=t=>tree.root.findAllByType('button').find(b=>b.children.join('')===t);
 const preview=()=>tree.root.findByType('textarea').props.value;
 assert(preview().includes('Infantil · 2°'));assert(preview().includes('Juvenil · 8°'));
 await act(async()=>tree.root.findByType('select').props.onChange({target:{value:'puentes_juvenil'}}));assert(!preview().includes('Infantil · 2°'));
 await act(async()=>btn('Copiar informe').props.onClick());assert.equal(copiado,preview());
 await act(async()=>btn('Compartir por WhatsApp').props.onClick());assert.equal(compartido.text,preview());
 navegador.share=async()=>{throw Object.assign(Error('Cancelado'),{name:'AbortError'})};await act(async()=>btn('Compartir por WhatsApp').props.onClick());assert(!tree.root.findByProps({role:'status'}).children.join('').includes('No se pudo'));
 navegador.clipboard.writeText=async()=>{throw Error('Sin permiso')};await act(async()=>btn('Copiar informe').props.onClick());assert.equal(seleccionado,true);assert(tree.root.findByProps({role:'status'}).children.join('').includes('Selecciona y copia'));
 await act(async()=>escape({key:'Escape',preventDefault(){}}));assert.equal(cerrado,1);await act(async()=>tree.unmount());assert.equal(escape,null);
 console.log('PASS informe UI: vista previa, selección de categoría, copia, compartir nativo, cancelación, selección manual y cierre accesible');
}finally{delete globalThis.document;delete globalThis.window;if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;await rm(dir,{recursive:true,force:true})}
