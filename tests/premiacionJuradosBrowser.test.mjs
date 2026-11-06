import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import chromiumArgs from '@sparticuz/chromium';
const dir=await mkdtemp(join(tmpdir(),'premiacion-'));
const datos=Array.from({length:7},(_,i)=>({id:String(i),origen:'claudina',categoria:i===6?'arte':'stem',titulo:'Proyecto '+(i+1),integrantes:'Ana y Luis',promedio:100-i*5,evaluadas:2,borradores:i===0?1:0}));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Premiacion from './src/PremiacionJurados.jsx';import './src/EvaluacionJurados.css';createRoot(document.getElementById('root')).render(<div className="juryEvaluation"><Premiacion resultados={${JSON.stringify(datos)}}/></div>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,format:'iife',outfile:dir+'/app.js'});
const browser=await chromium.launch({executablePath:process.env.FERIA_TEST_CHROMIUM||await chromiumArgs.executablePath(),args:chromiumArgs.args,headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errores=[];page.on('pageerror',e=>errores.push(e.message));
 await page.route('https://premiacion.test/**',async r=>r.request().url().endsWith('app.js')?r.fulfill({contentType:'application/javascript',body:await readFile(dir+'/app.js','utf8')}):r.request().url().endsWith('app.css')?r.fulfill({contentType:'text/css',body:await readFile(dir+'/app.css','utf8')}):r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>'}));
 await page.goto('https://premiacion.test/');await page.getByRole('heading',{name:'Premiación por categoría'}).waitFor();
 assert.equal(await page.locator('.juryAwardCard').count(),6);
 await page.getByLabel('Categoría de premiación').selectOption('stem');assert.equal(await page.locator('.juryAwardCard').count(),5);
 assert.equal(await page.locator('.juryAwardCard h4').first().textContent(),'Proyecto 1');
 await page.getByRole('button',{name:'Leer del quinto al primero'}).click();assert.equal(await page.locator('.juryAwardCard h4').first().textContent(),'Proyecto 5');
 assert(await page.getByText('Integrantes:',{exact:true}).first().isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errores,[]);console.log('PASS navegador móvil: categorías, cinco proyectos, lectura inversa, integrantes y sin desbordamiento');
}finally{await browser.close();await rm(dir,{recursive:true,force:true})}
