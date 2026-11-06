import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import chromiumArgs from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname;
const source=process.env.JURADOS_SOURCE||root+'src/EvaluacionJurados.jsx';
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Panel from './src/EvaluacionJurados.jsx';createRoot(document.getElementById('root')).render(<Panel portal/>);`,resolveDir:root,loader:'jsx'},bundle:true,loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'},format:'iife',outfile:'/tmp/jurados-refresh.js',plugins:[{name:'fixture',setup(b){b.onLoad({filter:/EvaluacionJurados.jsx$/},async()=>({contents:await readFile(source,'utf8'),loader:'jsx',resolveDir:root+'src'}));b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`export const supabase={rpc:async()=>({data:await(await fetch('/contexto')).json()})};`}))}}]});
const browser=await chromium.launch({executablePath:await chromiumArgs.executablePath(),args:chromiumArgs.args,headless:true});
try{
const page=await browser.newPage();let visitas=[];let consultas=0;
const proyecto={id:'p1',origen:'claudina',codigo:'P1',titulo:'Nuevo proyecto reasignado',categoria:'stem',ubicaciones:[],integrantes:'Ana'};
await page.route('**/*',async r=>{const path=new URL(r.request().url()).pathname;if(path==='/contexto'){consultas++;return r.fulfill({json:{docente:false,mi_jurado:'j1',config:{rubrica_version:2,fecha:'2026-11-06',inicio:'08:00',fin:'10:00'},visitas,proyectos:[proyecto],jurados:[]}})}if(path==='/app.js')return r.fulfill({body:await readFile('/tmp/jurados-refresh.js','utf8'),contentType:'application/javascript'});return r.fulfill({body:'<div id="root"></div><script src="/app.js"></script>',contentType:'text/html'})});
await page.goto('https://jurado.test');await page.getByText('Tu cuenta está habilitada.',{exact:false}).waitFor();
visitas=[{id:'v1',jurado_id:'j1',origen:'claudina',proyecto_id:'p1',inicio:'08:00',fin:'08:10'}];
await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'P1 · Nuevo proyecto reasignado'}).waitFor();
await page.getByRole('button',{name:'Evaluar proyecto',exact:true}).click();const antes=consultas;
await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(100);assert.equal(consultas,antes);
await page.getByRole('button',{name:'← Volver al recorrido'}).click();visitas=[];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Tu cuenta está habilitada.',{exact:false}).waitFor();
console.log('PASS reasignación aparece sin recargar, retiro desaparece y editor no se interrumpe');
}finally{await browser.close()}
