import {useGruposDocente} from './GruposDocente';
import React from 'react';

export const coincideGrado=(filtro,grado)=>filtro==='todos'||(grado!=null&&grado!==''&&(filtro==='7-8'?[7,8].includes(Number(grado)):Number(filtro)===Number(grado)));
export const coincideGrupo=(filtro,grupo)=>filtro==='todos'||(filtro==='7-8'?['7','8','7-8'].includes(String(grupo)):String(filtro)===String(grupo));

export default function FiltroGrado({valor,cambiar}){const {incluye}=useGruposDocente();return <div className="gradeFilter"><label htmlFor="filtro-grado">Filtrar por grado</label><select id="filtro-grado" value={valor} onChange={e=>cambiar(e.target.value)}><option value="todos">Todos los grados</option>{Array.from({length:7},(_,i)=>incluye(String(i))&&<option key={i} value={String(i)}>{i===0?'0° · TS y JR':i+'°'}</option>)}{incluye('7-8')&&<option value="7-8">7° y 8°</option>}</select></div>}
