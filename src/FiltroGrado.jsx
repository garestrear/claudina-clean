import React from 'react';

export default function FiltroGrado({valor,cambiar}){return <div className="gradeFilter"><label htmlFor="filtro-grado">Filtrar por grado</label><select id="filtro-grado" value={valor} onChange={e=>cambiar(e.target.value)}><option value="todos">Todos los grados</option>{Array.from({length:8},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}°</option>)}</select></div>}
