import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const path=new URL('../mencion-ui-test.mjs',import.meta.url);
try{
const result=await build({stdin:{contents:"export {default} from './src/FeriaMencionHonor.jsx'",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,external:['react'],plugins:[{name:'mocks',setup(b){b.onResolve({filter:/lib\/supabase$|documentosParticipantes\.js$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.includes('supabase')?"export const supabase={rpc:(name)=>globalThis.rpc(name)}":"export const descargarMencion=(p,o)=>globalThis.descarga(p,o)"}))}}]});
await writeFile(path,result.outputFiles[0].text);const {default:Componente}=await import(path.href);
let root,downloads=[];globalThis.rpc=async name=>{assert.equal(name,'feria_firmantes_contexto');return{data:{firmantes:[{nombre:'Directora',cargo:'Directora'}]}}};globalThis.descarga=async(p,o)=>downloads.push(o);
await act(async()=>{root=create(React.createElement(Componente,{proyecto:{titulo:'Proyecto'}}))});assert.equal(root.toJSON(),null);
await act(async()=>{root.update(React.createElement(Componente,{proyecto:{titulo:'Proyecto'},docente:true}))});
await act(async()=>root.root.findByType('button').props.onClick());
const button=text=>root.root.findAllByType('button').find(b=>b.props.children===text);
assert.equal(button('Generar mención de honor PDF').props.disabled,true);
await act(async()=>button('Vista previa de la mención').props.onClick());assert.equal(downloads[0].borrador,true);
await act(async()=>root.root.findByType('input').props.onChange({target:{checked:true}}));assert.equal(button('Generar mención de honor PDF').props.disabled,false);
await act(async()=>button('Generar mención de honor PDF').props.onClick());assert.equal(downloads[1].borrador,false);
await act(async()=>root.root.findByType('textarea').props.onChange({target:{value:'Creatividad'}}));assert.equal(button('Generar mención de honor PDF').props.disabled,true);
globalThis.rpc=async()=>({error:{message:'Error de conexión'}});await act(async()=>button('Vista previa de la mención').props.onClick());assert.match(root.root.findByProps({role:'alert'}).props.children,/Error de conexión/);assert.equal(downloads.length,2);
await act(async()=>root.unmount());console.log('PASS: solo docente, vista previa, confirmación, motivo y error sin descargar.');
}finally{await unlink(path).catch(()=>{})}
