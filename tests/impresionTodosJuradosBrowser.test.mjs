import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import chromiumArgs from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');const dir=await mkdtemp(join(tmpdir(),'carta-recorrido-browser-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Carta from './src/ImpresionJurados.jsx';createRoot(document.getElementById('root')).render(<Carta persona={{id:'j1',nombre:'Jurado de prueba'}}/>);`,resolveDir:root,loader:'jsx'},bundle:true,loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'},format:'iife',outfile:dir+'/app.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-db',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`export const supabase={rpc:async()=>({data:window.__ctx})};`}))}}]});
const js=await readFile(dir+'/app.js','utf8');const browser=await chromium.launch({executablePath:await chromiumArgs.executablePath(),args:chromiumArgs.args,headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.route('https://carta.test/**',route=>new URL(route.request().url()).pathname==='/app.js'?route.fulfill({contentType:'application/javascript',body:js}):route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/app.js"></script></html>'}));
 const page=await context.newPage(),errores=[];page.on('pageerror',e=>errores.push(e.message));await page.goto('https://carta.test/');
 const ctx={docente:true,config:{rubrica_version:2},jurados:[{id:'j1',nombre:'Isabel Osorio',habilitado:true,usuario:'jurado01',cuenta_id:'c1',cambiar_password:true},{id:'j2',nombre:'Jurado sin cuenta',habilitado:true}],proyectos:[{id:'p1',origen:'claudina',categoria:'stem',codigo:'STEM-1',titulo:'Experiencia científica',ubicaciones:[{fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_nombre:'Salón 1'}]}],visitas:[{jurado_id:'j1',proyecto_id:'p1',origen:'claudina',fecha:'2026-11-06',inicio:'08:00',fin:'08:10'},{jurado_id:'j2',proyecto_id:'p1',origen:'claudina',fecha:'2026-11-06',inicio:'08:11',fin:'08:21'}]};
 await page.evaluate(ctx=>window.__ctx=ctx,ctx);
 await page.getByRole('button',{name:'Preparar PDF de todos los jurados'}).click();
 await page.getByRole('button',{name:'Descargar PDF para la impresora'}).click();await page.getByRole('alert').filter({hasText:/contraseña inicial/}).waitFor();
 await page.getByLabel('Contraseña inicial común de las cuentas que aún no la han cambiado').fill('Inicial-Prueba-2026');
 const evento=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF para la impresora'}).click();const archivo=await evento;
 assert.equal(archivo.suggestedFilename(),'Impresion-Jurados-Feria-STEAM-2026.pdf');await archivo.saveAs(dir+'/paquete.pdf');assert.equal((await readFile(dir+'/paquete.pdf')).subarray(0,5).toString(),'%PDF-');await page.getByRole('status').filter({hasText:'PDF listo: 2 cartas y 2 fichas de evaluación.'}).waitFor();assert.equal(await page.locator('input[type=password]').count(),0);assert.deepEqual(errores,[]);
 console.log('PASS navegador: paquete PDF único, datos vigentes, contraseña requerida, dos jurados y claves borradas del formulario');

}finally{await browser.close();await rm(dir,{recursive:true,force:true})}
