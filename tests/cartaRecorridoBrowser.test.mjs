import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import chromiumArgs from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');const dir=await mkdtemp(join(tmpdir(),'carta-recorrido-browser-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Carta from './src/CartaRecorridoJurado.jsx';createRoot(document.getElementById('root')).render(<Carta persona={{id:'j1',nombre:'Jurado de prueba'}}/>);`,resolveDir:root,loader:'jsx'},bundle:true,loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'},format:'iife',outfile:dir+'/app.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-db',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`export const supabase={rpc:async()=>({data:window.__ctx})};`}))}}]});
const js=await readFile(dir+'/app.js','utf8');const browser=await chromium.launch({executablePath:await chromiumArgs.executablePath(),args:chromiumArgs.args,headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.route('https://carta.test/**',route=>new URL(route.request().url()).pathname==='/app.js'?route.fulfill({contentType:'application/javascript',body:js}):route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/app.js"></script></html>'}));
 const page=await context.newPage(),errores=[];page.on('pageerror',e=>errores.push(e.message));await page.goto('https://carta.test/');
 const ctx={docente:true,config:{rubrica_version:2},jurados:[{id:'j1',nombre:'Jurado de prueba',institucion:'Institución invitada',habilitado:true,cuenta_id:'cuenta1',usuario:'jurado01',cambiar_password:true}],proyectos:[{id:'p1',origen:'claudina',categoria:'stem',titulo:'Proyecto de prueba',ubicaciones:[{fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_nombre:'Salón 1'}]}],visitas:[{jurado_id:'j1',proyecto_id:'p1',origen:'claudina',fecha:'2026-11-06',inicio:'08:00',fin:'08:10'}]};
 await page.evaluate(ctx=>window.__ctx=ctx,ctx);
 const abrir=()=>page.getByRole('button',{name:'Descargar carta de acceso y recorrido PDF'}).click();await abrir();await page.getByLabel('Contraseña inicial que asignaste a esta cuenta').fill('Inicial-Prueba-2026');
 let evento=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar carta personalizada',exact:true}).click();let descarga=await evento;assert.equal(descarga.suggestedFilename(),'Recorrido-Jurado-Jurado-de-prueba-Feria-STEAM-2026.pdf');await descarga.saveAs(dir+'/inicial.pdf');assert.equal((await readFile(dir+'/inicial.pdf')).subarray(0,5).toString(),'%PDF-');await page.getByText('Carta personalizada descargada. Entrégala individualmente al jurado.').waitFor();assert.equal(await page.locator('input[type=password]').count(),0);
 await page.evaluate(()=>window.__ctx.jurados[0].cambiar_password=false);await abrir();assert.equal(await page.locator('input[type=password]').count(),0);await page.getByText('Este jurado ya cambió su contraseña. La carta le indicará que utilice su contraseña personal.').waitFor();evento=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar carta personalizada',exact:true}).click();descarga=await evento;assert(descarga.suggestedFilename().endsWith('.pdf'));
 let papel=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar evaluación en papel PDF'}).click();const ficha=await papel;assert(ficha.suggestedFilename().startsWith('Evaluaciones-Jurado-'));await ficha.saveAs(dir+'/papel.pdf');assert.equal((await readFile(dir+'/papel.pdf')).subarray(0,5).toString(),'%PDF-');
 await page.evaluate(()=>window.__ctx.jurados[0].cuenta_id=null);await abrir();await page.getByRole('alert').filter({hasText:'Primero habilita al jurado y asígnale un usuario.'}).waitFor();assert.deepEqual(errores,[]);
 console.log('PASS navegador carta: descarga PDF real, contraseña inicial, datos vigentes, clave personal no impresa y rechazo sin usuario');
}finally{await browser.close();await rm(dir,{recursive:true,force:true})}
