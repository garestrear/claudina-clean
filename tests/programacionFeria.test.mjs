import assert from 'node:assert/strict';
import {disponibilidadEspacio,htmlProgramacionFeria} from '../src/programacionFeria.js';
const e={id:'a',nombre:'Salón <script>alert(1)</script>',activo:true,cupos:2},tramo={fecha:'2026-11-06',inicio:'08:00',fin:'11:00'};
const r=(id,inicio,fin,extra={})=>({id,fecha:tramo.fecha,inicio,fin,espacio_id:'a',activo:true,titulo:'Proyecto <img src=x>',...extra});
let d=disponibilidadEspacio(e,[r('1','08:00','09:00'),r('2','10:00','11:00')],tramo);assert.equal(d.pico,1);assert.equal(d.estado,'compartido');d=disponibilidadEspacio(e,[r('1','08:00','09:00'),r('2','08:30','11:00')],tramo);assert.equal(d.pico,2);assert.equal(d.estado,'lleno');assert.equal(disponibilidadEspacio(e,[r('1','08:00','09:00',{exclusivo:true})],tramo).estado,'exclusivo');assert.equal(disponibilidadEspacio(e,[r('1','07:00','08:00')],tramo).estado,'libre');assert.equal(disponibilidadEspacio(e,[r('1','08:00','09:00')],tramo,'1').estado,'libre');
const html=htmlProgramacionFeria({espacios:[e],docentes:[],programacion:[r('1','08:00:00','09:00:00',{puesto:'001',responsable:'Ejemplo & Familia'}),r('2','10:00:00','11:00:00',{activo:false})]},tramo.fecha);assert(!html.includes('<script>'));assert(!html.includes('<img '));assert(html.includes('&lt;script&gt;'));assert(html.includes('001'));assert(html.includes('Programación general'));assert(html.includes('Programación de las rotaciones'));assert(html.includes('Programación por salón'));assert(html.includes('08:00 - 09:00'));assert(html.includes('Ejemplo &amp; Familia'));
console.log('PASS: disponibilidad por concurrencia, límites exactos, edición sin autocruce e impresión con contenido escapado');

assert.equal(disponibilidadEspacio(e,[r('rechazado','08:00','10:00',{proyecto_vigente:false})],tramo).estado,'libre');
const sinRechazado=htmlProgramacionFeria({espacios:[e],docentes:[],programacion:[r('rechazado','08:00','10:00',{titulo:'Rechazado fantasma',proyecto_vigente:false})]},tramo.fecha);assert(!sinRechazado.includes('Rechazado fantasma'));

const proyecto=r('alumnos','08:00:00','10:00:00',{tipo:'proyecto',origen:'claudina',proyecto_id:'p1',docente_id:'d1',responsable:'Profesor asesor',titulo:'Cohete de agua'});
const alumno=(id,nombre,grado)=>({estudiante_id:id,nombre,grado,proyecto_id:'p1',fecha:tramo.fecha,inicio:'08:00',fin:'10:00'});
const impreso=htmlProgramacionFeria({espacios:[e],docentes:[{id:'d1',nombre:'Profesor asesor'}],programacion:[proyecto],expositores:[alumno('a1','ANA RESTREPO',4),alumno('a2','LUIS ROJAS',4),alumno('a1','ANA RESTREPO',4),{...alumno('otro','Otro horario',5),inicio:'10:15',fin:'11:40'}]},tramo.fecha);
assert(impreso.includes('Ana Restrepo (4°) · Luis Rojas (4°)'));assert(!impreso.includes('Profesor asesor'));assert(!impreso.includes('Otro horario'));assert.equal(impreso.split('Ana Restrepo (4°)').length,2);
const pendiente=htmlProgramacionFeria({espacios:[e],programacion:[proyecto],docentes:[{id:'d1',nombre:'Profesor asesor'}]},tramo.fecha);assert(pendiente.includes('Expositores por confirmar'));assert(!pendiente.includes('Profesor asesor'));
console.log('PASS responsables: integrantes actuales por proyecto y horario, sin duplicados ni asesor en la columna');
