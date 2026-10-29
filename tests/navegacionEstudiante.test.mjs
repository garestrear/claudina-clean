import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {unlink} from 'node:fs/promises';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window={scrollTo(){}};
const outfile=new URL('../node_modules/navegacion-estudiante-test.mjs',import.meta.url).pathname;
await build({entryPoints:['src/EstudiantePanel.jsx'],bundle:true,format:'esm',packages:'external',outfile,loader:{'.css':'empty'},plugins:[{name:'badges',setup(b){b.onLoad({filter:/Novedades.jsx$/},()=>({contents:'export function IndicadorNovedades(){return null}'}))}}]});
const {default:Panel,grupoEstudiante,gruposEstudiante,novedadesGrupo,TarjetaFeriaEstudiante}=await import(outfile);
for(const [tab,grupo] of Object.entries({inicio:'inicio',feria:'feria',ingles:'aprender',calificaciones:'colegio',evidencias:'colegio',reportes:'colegio',valoraciones:'colegio',convivencia:'colegio',horario:'mas',encuestas:'mas',eventos:'mas'}))assert.equal(grupoEstudiante(tab),grupo);
assert.deepEqual(novedadesGrupo({evidencias:{cantidad:2},convivencia:{cantidad:1,cambio:true}},gruposEstudiante.find(g=>g.id==='colegio')),{cantidad:3,cambio:true});
let actual='inicio';const visitar=tab=>{actual=tab};let view;
const render=tab=>React.createElement(Panel,{tab,setTab:visitar,grado:6},React.createElement('div',{'data-page':tab},'Contenido actual'));
await act(async()=>{view=create(render('inicio'))});
let nav=view.root.findByType('nav');assert.equal(nav.findAllByType('button').length,5);assert.ok(JSON.stringify(view.toJSON()).includes('Feria STEAM'));
await act(async()=>nav.findAllByType('button')[1].props.onClick());assert.equal(actual,'feria');
for(const [menu,paginas] of [['colegio',['valoraciones','evidencias','calificaciones','convivencia']],['mas',['horario','encuestas','eventos','cuenta']],['aprender',['ingles']]]){
 await act(async()=>view.update(render(menu)));
 const botones=view.root.findByProps({className:'studentMenuGrid'}).findAllByType('button');assert.equal(botones.length,paginas.length);
 for(let i=0;i<botones.length;i++){await act(async()=>botones[i].props.onClick());assert.equal(actual,paginas[i]);}
}
await act(async()=>view.update(render('eventos')));assert.ok(view.root.findByProps({'data-page':'eventos'}));assert.equal(view.root.findByType('nav').findAllByType('button').filter(b=>b.props['aria-current']==='page').length,1);await act(async()=>view.root.findByProps({className:'studentBackToMenu'}).props.onClick());assert.equal(actual,'mas');
await act(async()=>view.update(React.createElement(Panel,{tab:'aprender',setTab:visitar,grado:3})));assert.equal(view.root.findByProps({className:'studentMenuGrid'}).findAllByType('button').length,0);
await act(async()=>view.update(React.createElement(TarjetaFeriaEstudiante,{onAbrir:()=>visitar('feria')})));await act(async()=>view.root.findByType('button').props.onClick());assert.equal(actual,'feria');
await act(async()=>view.unmount());await unlink(outfile);console.log('PASS: cinco pestañas, acceso Feria, todas las secciones agrupadas, enlaces anteriores, indicadores, grados y acceso desde Inicio');
