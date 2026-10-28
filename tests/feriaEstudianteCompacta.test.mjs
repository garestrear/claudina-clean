import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import chromiumConfig from '@sparticuz/chromium';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const dir=await mkdtemp(join(tmpdir(),'feria-compacta-'));
const proyecto={id:'proyecto',titulo:'Mi huerta',estado:'enviado',grado:6,integrantes:'Ana y Luis',areas:['science'],actualizado_en:'2026-10-28T12:00:00Z',registrado_por:'Ana',version:1};
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/EstudiantePanel.jsx';import Feria from './src/FeriaCiencia.jsx';import './src/styles.css';createRoot(document.getElementById('root')).render(<Panel tab="feria" setTab={()=>{}} grado={6}><Feria perfil={{id:'cuenta',rol:'estudiante'}}/></Panel>);`,resolveDir:root,loader:'jsx'},bundle:true,format:'iife',outfile:dir+'/app.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.png':'dataurl','.jpg':'dataurl','.ttf':'dataurl'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/Novedades.jsx$/},()=>({contents:'export function IndicadorNovedades(){return null}'}));b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`const proyecto=${JSON.stringify(proyecto)};export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},rpc:async(nombre)=>({data:nombre==='feria_contexto'?{proyectos:[proyecto],docentes:[],companeros:[],ficha:{id:'ficha',grado:6}}:nombre==='feria_proyecto'?{proyecto,integrantes:[],revisiones:[],puede_editar:true}:null})};`}))}}]});
const js=await readFile(dir+'/app.js','utf8'),css=await readFile(dir+'/app.css','utf8');
const browser=await chromium.launch({executablePath:process.env.FERIA_TEST_CHROMIUM||await chromiumConfig.executablePath(),args:chromiumConfig.args,headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/feria-aprobados'){assert.equal(route.request().headers().authorization,'Bearer fixture');return route.fulfill({json:{presentados:27,aprobados:2,proyectos:[{titulo:'Agua limpia',integrantes:'María y Pedro',institucion:'Claudina'},{titulo:'Energía solar',integrantes:'Sara',institucion:'Colegio invitado'}]}})}return route.fulfill({contentType:path==='/app.js'?'application/javascript':path==='/app.css'?'text/css':'text/html',body:path==='/app.js'?js:path==='/app.css'?css:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'})});
 await page.goto('https://fixture.test/');
 const inscribir=page.getByRole('button',{name:'＋ Inscribir proyecto',exact:true}),editar=page.getByRole('button',{name:'Editar proyecto',exact:true});
 await editar.waitFor();await page.getByText('María y Pedro',{exact:false}).waitFor();
 const nav=page.getByRole('navigation',{name:'Secciones del estudiante'}),box=await nav.boundingBox();assert(box.y<20);assert(box.height<80);assert.equal(await nav.getByRole('button').count(),5);
 assert((await inscribir.boundingBox()).y<650);assert((await editar.boundingBox()).y<(await page.getByRole('heading',{name:'Proyectos presentados y aprobados',exact:true}).boundingBox()).y);
 assert.equal(await page.getByText('Proyectos inscritos',{exact:true}).count(),0);assert.equal(await page.locator('.fairOverview').getByText('Por revisar',{exact:true}).count(),0);assert.equal(await page.locator('.fairOverview>div').count(),2);assert.equal(await page.locator('.fairStudentFilters').getAttribute('open'),null);
 await page.getByRole('searchbox',{name:'Buscar proyecto o integrante'}).fill('Sara');assert.equal(await page.locator('.fairStudentExhibition .fairCard').count(),1);assert.equal(await page.getByText('Agua limpia',{exact:true}).count(),0);
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));assert((await nav.boundingBox()).y>=-1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await editar.click();await page.getByRole('heading',{name:'Actualizar el proyecto',exact:true}).waitFor();
 await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'← Proyectos',exact:true}).click();await inscribir.click();await page.locator('#fair-titulo').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: menú superior compacto móvil, inscripción visible, edición accesible, sólo dos totales debajo, aprobados con integrantes y búsqueda, formularios funcionales y sin desborde.');
}finally{await browser.close();await rm(dir,{recursive:true,force:true})}
