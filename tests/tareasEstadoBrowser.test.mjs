import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {crearDbTareasEstado,id} from './fixtures/tareasEstadoDb.mjs';
import {lanzarNavegador} from '../lib/master2000/consulta.js';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const dir=await mkdtemp(join(tmpdir(),'tareas-estado-'));
const db=await crearDbTareasEstado();let browser;
try{
 await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{TareasEstudiante}from'./src/Tareas.jsx';import './src/styles.css';const cuenta=new URLSearchParams(location.search).get('cuenta')||'1';createRoot(document.getElementById('root')).render(<main><TareasEstudiante ficha={{id:cuenta,grado:6}}/></main>);`,resolveDir:root,loader:'jsx'},bundle:true,format:'iife',outfile:join(dir,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'db',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`const cuenta=new URLSearchParams(location.search).get('cuenta')||'1';export const supabase={rpc:async(nombre,args)=>{const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({nombre,args,cuenta})});return r.json()},from(){const q={select(){return q},eq(){return q},order(){return q},then(ok,bad){return fetch('/tareas?cuenta='+cuenta).then(r=>r.json()).then(ok,bad)}};return q}};`}));}}]});
 const js=await readFile(join(dir,'app.js')),css=await readFile(join(dir,'app.css'));
 browser=await lanzarNavegador();const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let failMark=false,failList=false;
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/app.js')return route.fulfill({contentType:'application/javascript',body:js});
  if(u.pathname==='/app.css')return route.fulfill({contentType:'text/css',body:css});
  if(u.pathname==='/tareas'){
   const rows=(await db.query("select * from avisos where publicado and tipo='tarea' and (grado=6 or grado is null) order by fecha_evento asc nulls last")).rows;
   return route.fulfill({json:{data:rows,error:null}});
  }
  if(u.pathname==='/rpc'){
   const{nombre,args,cuenta}=route.request().postDataJSON();
   if(nombre==='tareas_propuestas_listar')return route.fulfill({json:{data:[],error:null}});
   if((failMark&&nombre==='tarea_marcar_hecha')||(failList&&nombre==='tareas_estado_listar'))return route.fulfill({json:{data:null,error:{message:'Sin conexión'}}});
   try{
    const data=await db.transaction(async tx=>{
     await tx.query("select set_config('test.uid',$1,false)",[id(Number(cuenta))]);
     const query=nombre==='tareas_estado_listar'?'select tareas_estado_listar() data':'select tarea_marcar_hecha($1,$2) data';
     return (await tx.query(query,nombre==='tareas_estado_listar'?[]:[args.tarea,args.hecha])).rows[0].data;
    });return route.fulfill({json:{data,error:null}});
   }catch(e){return route.fulfill({json:{data:null,error:{message:e.message}}})}
  }
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
 });
 await page.goto('https://tareas.claudina.test/');
 await page.getByRole('button',{name:'Pendientes (2)',exact:true}).waitFor();
 assert.deepEqual(await page.locator('.avisoCard h4').allTextContents(),['Tarea 2','Tarea 1']);
 await page.getByRole('button',{name:'Ya la hice: Tarea 2',exact:true}).click();
 await page.getByRole('button',{name:'Pendientes (1)',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Tarea 2',exact:true}).count(),0);
 await page.getByRole('button',{name:'Ya las hice (1)',exact:true}).click();
 await page.getByRole('heading',{name:'Tarea 2',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Ya las hice (1)',exact:true}).click();
 await page.getByRole('button',{name:'Volver a pendientes: Tarea 2',exact:true}).click();
 await page.getByRole('button',{name:'Ya las hice (0)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Pendientes (2)',exact:true}).click();
 failMark=true;await page.getByRole('button',{name:'Ya la hice: Tarea 2',exact:true}).click();
 await page.getByText(/No se pudo guardar el cambio/).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Tarea 2',exact:true}).count(),1);
 assert.equal((await db.query('select count(*)::int n from tareas_estado_estudiante')).rows[0].n,0);
 failMark=false;await page.getByRole('button',{name:'Ya la hice: Tarea 2',exact:true}).click();
 await page.getByRole('button',{name:'Ya las hice (1)',exact:true}).waitFor();
 await page.goto('https://tareas.claudina.test/?cuenta=2');await page.getByRole('button',{name:'Pendientes (2)',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Ya las hice (0)',exact:true}).count(),1,'otra cuenta no hereda tareas hechas');
 failList=true;await page.reload();await page.getByRole('alert').filter({hasText:/No se pudo cargar tu organización/}).waitFor();
 assert.ok(await page.getByRole('button',{name:'Ya la hice: Tarea 2',exact:true}).isDisabled());
 assert.equal(await page.getByRole('heading',{name:'Tarea 2',exact:true}).count(),1,'fallar el estado no oculta tareas publicadas');
 failList=false;await page.getByRole('button',{name:'Actualizar estado',exact:true}).click();await page.getByRole('button',{name:'Pendientes (2)',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde en móvil');
 await page.screenshot({path:'/tmp/tareas-estado-estudiante-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: navegador móvil → SQL, orden de entrega, contadores, mover/restaurar, recarga, otra cuenta, fallo de guardado y recuperación de conexión');
}finally{await browser?.close();await db.close();await rm(dir,{recursive:true,force:true})}
