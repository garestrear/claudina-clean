import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import chromiumConfig from '@sparticuz/chromium';
const result=await build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Equipo from './src/FeriaEquipoDocente.jsx';function App(){const[v,s]=useState(['a']);return <Equipo value={v} onChange={s} integrantes={[{id:'a',nombre:'Ana',grado:6}]}/>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',plugins:[{name:'mock',setup(b){b.onResolve({filter:/lib\/supabase$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const supabase={rpc:async()=>({data:[{id:'b',nombre:'Bruno',grado:7}],error:null})}` ,loader:'js'}))}}]});
const browser=await chromium.launch({executablePath:await chromiumConfig.executablePath(),args:chromiumConfig.args,headless:true});
try{
 const page=await browser.newPage();await page.setContent('<div id="root"></div>');await page.addScriptTag({content:result.outputFiles[0].text});
 await page.getByLabel('Grado para agregar integrante').selectOption('7');await page.getByRole('option',{name:'Bruno',exact:true}).waitFor({state:'attached'});
 await page.getByLabel('Agregar integrante',{exact:true}).selectOption('b');await page.getByRole('button',{name:'Quitar a Bruno',exact:true}).waitFor();
 assert.equal(await page.getByRole('option',{name:'Bruno',exact:true}).count(),0);
 await page.getByRole('button',{name:'Quitar a Ana',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Quitar a Ana',exact:true}).count(),0);
 await page.getByRole('button',{name:'Quitar a Bruno',exact:true}).click();await page.getByRole('option',{name:'Bruno',exact:true}).waitFor({state:'attached'});
 console.log('PASS selector docente: agregar entre grados, sin duplicados, quitar y volver a agregar');
}finally{await browser.close()}
