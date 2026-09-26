import React from 'react';

export const coincideGrado=(filtro,grado)=>filtro==='todos'||(filtro==='7-8'?[7,8].includes(Number(grado)):Number(filtro)===Number(grado));
export const coincideGrupo=(filtro,grupo)=>filtro==='todos'||(filtro==='7-8'?['7','8','7-8'].includes(String(grupo)):String(filtro)===String(grupo));

export default function FiltroGrado({valor,cambiar}){return <div className="gradeFilter"><label htmlFor="filtro-grado">Filtrar por grado</label><select id="filtro-grado" value={valor} onChange={e=>cambiar(e.target.value)}><option value="todos">Todos los grados</option>{Array.from({length:6},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}°</option>)}<option value="7-8">7° y 8°</option></select></div>}
