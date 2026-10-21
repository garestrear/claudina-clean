import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {lanzarNavegador} from '../lib/master2000/consulta.js';
const root=new URL('..',import.meta.url).pathname,dir=await mkdtemp(join(tmpdir(),'crear-cancion-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Crear from './src/CrearCancion.jsx';import './src/InglesMusica.css';createRoot(document.getElementById('root')).render(<Crear perfil={{id:'00000000-0000-0000-0000-000000000001'}} onCreada={()=>window.creada=true}/>);`,resolveDir:root,loader:'jsx'},bundle:true,format:'iife',outfile:dir+'/app.js',plugins:[{name:'mock',setup(b){b.onLoad({filter:/lib\/supabase.js$/},()=>({contents:`export const supabase={storage:{from:()=>({upload:async(path,file)=>{window.cargas=(window.cargas||0)+1;window.audioPath=path;return{error:null}}})},rpc:async(name,args)=>{window.rpcArgs=args;window.envios=(window.envios||0)+1;return window.envios===1?{error:{message:'Conexión interrumpida'}}:{data:'ok',error:null}}};`}))}}]});
const js=await readFile(dir+'/app.js','utf8'),css=await readFile(dir+'/app.css','utf8');
const browser=process.env.INGLES_TEST_CHROMIUM?await (await import('playwright-core')).chromium.launch({executablePath:process.env.INGLES_TEST_CHROMIUM,headless:true,args:['--no-sandbox']}):await lanzarNavegador();try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errores=[];page.on('pageerror',e=>errores.push(e.message));
 await page.route('**/*',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill(path==='/app.js'?{contentType:'application/javascript',body:js}:path==='/app.css'?{contentType:'text/css',body:css}:{contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>'})});
 await page.goto('https://crear.claudina.test/');await page.getByText('＋ Agregar canción',{exact:true}).click();
 await page.getByLabel('Nombre de la canción').fill('Zombie');await page.getByLabel('Artista',{exact:true}).fill('The Cranberries');
 await page.getByLabel('Audio MP3').setInputFiles(root+'/public/audio/lemon-tree.mp3');
 await page.getByLabel('Letra de la canción').fill('Your head, in your head.\nAnother child.');
 await page.getByLabel('Palabras que se deben completar').fill('head, child');await page.getByRole('button',{name:'Marcar palabras',exact:true}).click();
 assert.equal(await page.locator('[aria-pressed=true]').count(),3);
 await page.getByRole('button',{name:'head',exact:true}).first().click();
 assert.equal(await page.locator('[aria-pressed=true]').count(),2);
 assert.ok((await page.locator('.musicSelectLyrics').last().textContent()).includes('Your head, in your _____.'));
 await page.getByRole('button',{name:'Publicar canción',exact:true}).click();await page.getByText(/No se pudo completar la publicación/).waitFor();
 await page.getByRole('button',{name:'Publicar canción',exact:true}).click();await page.getByText(/¡Canción publicada!/).waitFor();
 const result=await page.evaluate(()=>({args:window.rpcArgs,cargas:window.cargas,creada:window.creada}));
 assert.equal(result.cargas,1);assert.equal(result.creada,true);assert.equal(result.args.letra_marcada,'Your head, in your [[head]].\nAnother [[child]].');assert.deepEqual(result.args.grados_destino,[6,7,8]);
 assert.equal(await page.getByLabel('Letra de la canción').inputValue(),'');assert.deepEqual(errores,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('Formulario móvil: audio, marcado por aparición, vista previa, reintento sin duplicar carga y publicación OK');
}finally{await browser.close();await rm(dir,{recursive:true,force:true})}
