import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import chromiumArgs from '@sparticuz/chromium';
import {crearFeriaDb} from './fixtures/feriaDb.mjs';
const {db,identity}=await crearFeriaDb();await db.exec(await readFile('supabase/feria-jurados.sql','utf8'));
for(let n=1;n<=32;n++)await db.query('insert into feria_jurados(nombre,institucion,profesion,correo,telefono,creado_en) values($1,$2,$3,$4,$5,$6)',['Candidato '+n,'Corantioquia','Educador ambiental',`jurado${n}@ejemplo.edu`,'3185377167',new Date(Date.UTC(2026,9,1,n)).toISOString()]);
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');const dir=await mkdtemp(join(tmpdir(),'jurados-browser-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Feria from './src/FeriaCiencia.jsx';import './src/styles.css';const actor=Number(new URLSearchParams(location.search).get('actor')||1);createRoot(document.getElementById('root')).render(React.createElement('main',null,React.createElement(Feria,{perfil:{id:'cuenta-'+actor,rol:actor===1?'profesor':'estudiante'}})));`,resolveDir:root,loader:'jsx'},bundle:true,loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'},format:'iife',outfile:dir+'/app.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-db',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`export const supabase={rpc:async()=>({data:{proyectos:[],docentes:[],companeros:[],ficha:{nombre:'Estudiante',grado:6}}}),from:tabla=>({select:()=>({order:()=>({order:()=>({range:async(desde,hasta)=>{const r=await fetch('/jurados?desde='+desde+'&hasta='+hasta+'&actor='+new URLSearchParams(location.search).get('actor'));return r.json()}})})})})};`}))}}]});
const js=await readFile(dir+'/app.js','utf8'),css=await readFile(dir+'/app.css','utf8');
const browser=await chromium.launch({executablePath:process.env.FERIA_TEST_CHROMIUM,args:chromiumArgs.args,headless:true});const errores=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/jurados'){
  await identity(Number(url.searchParams.get('actor')));await db.exec('set role authenticated');
  try{const desde=Number(url.searchParams.get('desde')),hasta=Number(url.searchParams.get('hasta'));const data=(await db.query('select id,nombre,institucion,profesion,correo,telefono,creado_en from feria_jurados order by creado_en desc,id limit $1 offset $2',[hasta-desde+1,desde])).rows;const count=(await db.query('select count(*)::int n from feria_jurados')).rows[0].n;return await route.fulfill({json:{data,count,error:null}})}finally{await db.exec('reset role')}
 }if(url.pathname==='/app.js')return route.fulfill({contentType:'application/javascript',body:js});if(url.pathname==='/app.css')return route.fulfill({contentType:'text/css',body:css});return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'})});
 const page=await context.newPage();page.on('pageerror',e=>errores.push(e.message));await page.goto('https://jurados.claudina.test/?actor=1');await page.getByRole('button',{name:'Jurados inscritos',exact:true}).click();await page.getByRole('heading',{name:'Candidato 32',exact:true}).waitFor();
 assert.equal(await page.locator('.juryCard').count(),30);assert.match(await page.locator('.juryCount').innerText(),/32/);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByRole('heading',{name:'Candidato 1',exact:true}).waitFor();assert.equal(await page.locator('.juryCard').count(),2);
 const descarga=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar carta PDF para Candidato 1',exact:true}).click();const archivo=await descarga;assert.equal(archivo.suggestedFilename(),'Invitacion-Jurado-Candidato-1-Feria-STEAM-2026.pdf');await archivo.saveAs('/tmp/cartas-jurados-qa/descarga-browser.pdf');const bytes=await readFile('/tmp/cartas-jurados-qa/descarga-browser.pdf');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 await page.getByText('Carta de Candidato 1 lista para enviar.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/jurados-mobile.png',fullPage:true});
 await page.goto('https://jurados.claudina.test/?actor=3');assert.equal(await page.getByRole('button',{name:'Jurados inscritos',exact:true}).count(),0);assert.deepEqual(errores,[]);
 console.log('PASS: pestaña docente, candidatos desde PostgreSQL con RLS, paginación, descarga PDF personalizada y vista móvil sin desbordes; estudiantes sin acceso');
}finally{await browser.close();await db.close();await rm(dir,{recursive:true,force:true})}
