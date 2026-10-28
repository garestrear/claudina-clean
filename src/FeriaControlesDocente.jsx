import React from 'react';

const estados=[['enviado','Por revisar'],['vigentes','Vigentes'],['aprobado','Aprobados'],['rechazado','Rechazados']];
export default function FeriaControlesDocente({proyectos,estado,onEstado,busqueda,onBusqueda,filtrosActivos,onActualizar,onLimpiar,children}){
 return <div className="fairTeacherControls">
  <div className="fairTeacherStates" role="group" aria-label="Estado de los proyectos">
   {estados.map(([id,nombre])=><button type="button" key={id} aria-pressed={estado===id} onClick={()=>onEstado(id)}>{nombre}<span>{proyectos.filter(p=>id==='vigentes'?p.estado!=='rechazado':p.estado===id).length}</span></button>)}
  </div>
  <div className="fairTeacherSearch"><label>Buscar proyecto o integrante<input type="search" value={busqueda} onChange={e=>onBusqueda(e.target.value)} placeholder="Nombre del proyecto o integrante"/></label><button type="button" onClick={onActualizar} aria-label="Actualizar lista de proyectos">↻ Actualizar</button></div>
  <details className="fairTeacherFilters"><summary>Filtros{filtrosActivos>0?` (${filtrosActivos})`:''}</summary><p>Puedes revisar proyectos de todos los grados, aunque no estén entre tus grupos asignados.</p><div className="fairFilters">{children}<button type="button" onClick={onLimpiar}>Limpiar filtros</button></div></details>
 </div>;
}
