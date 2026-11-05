import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import chromiumConfig from '@sparticuz/chromium';
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Feria from './src/FeriaCarrusel.jsx';createRoot(document.getElementById('root')).render(<Feria/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',plugins:[{name:'mock',setup(b){b.onResolve({filter:/lib\/supabase$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`const ctx={aulas:Array.from({length:5},(_,i)=>({id:'s'+i,nombre:'Salón '+(i+1),proyectos:1,requiere_lider:false})),visitantes:[1,2,3,4,5,6,7,8].flatMap(grado=>Array.from({length:grado===2?2:5},(_,i)=>({id:grado+'-'+i,nombre:'Estudiante '+grado+'-'+i,grado}))),docentes:Array.from({length:5},(_,i)=>({id:'d'+i,nombre:'Docente '+i})),plan:null,firma:'ok',firma_guardada:null,version:0};export const supabase={rpc:async(n,a)=>{if(n==='feria_carrusel_guardar'){ctx.plan=a.datos;ctx.firma_guardada='ok';ctx.version++}return {data:{...ctx,segunda_franja:a.desde==='10:15'},error:null}}};`,loader:'js'}))}}]});
const browser=await chromium.launch({executablePath:await chromiumConfig.executablePath(),args:chromiumConfig.args,headless:true});
try{const page=await browser.newPage({viewport:{width:1000,height:850}});await page.setContent('<div id="root"></div>');await page.addScriptTag({content:result.outputFiles[0].text});
 await page.getByRole('button',{name:/Segunda franja/}).click();await page.getByRole('button',{name:'Generar grupos por grado',exact:true}).click();
 assert.equal(await page.getByLabel('Minutos por rotación').inputValue(),'20');assert(await page.getByLabel('Minutos por rotación').isDisabled());
 assert.equal(await page.getByRole('heading',{name:/^Grupo \d ·/}).count(),5);
 await page.getByText('Bachillerato (6°, 7° y 8°)',{exact:true}).waitFor();
 assert.equal(await page.locator('.spaceAgenda .spaceCard').count(),4);
 await page.getByRole('button',{name:'Asignar docentes disponibles',exact:true}).click();await page.getByRole('button',{name:'Guardar organización',exact:true}).click();
 await page.getByText('Organización guardada: líderes de aula y acompañantes asignados.',{exact:true}).waitFor();
 assert.equal(await page.locator('.spaceAgenda .spaceCard').count(),4);
 console.log('PASS UI segunda franja: cinco grupos, bachillerato, cuatro rotaciones de veinte minutos y guardado');
}finally{await browser.close()}
