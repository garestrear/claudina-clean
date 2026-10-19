export const seccionesDocente=[
 {id:'inicio',nombre:'Inicio',icono:'🏠',paginas:['horario']},
 {id:'aseo',nombre:'Aseo',icono:'🧹',paginas:['hoy','consolidado','historial']},
 {id:'comunidad',nombre:'Comunidad',icono:'📣',paginas:['tareas','avisos','convivencia']},
 {id:'actividades',nombre:'Actividades',icono:'🎯',paginas:['feria','eventos','encuestas','ingles']},
 {id:'mas',nombre:'Más',icono:'☰',paginas:['reportes','misgrupos','administracion','estudiantes','profesores','asignacion']}
];
export const herramientasDocente={
 horario:['🕒','Mi horario','Consulta tus clases y el horario semanal.'],
 hoy:['🧹','Registrar aseo','Registra cómo fue el aseo de tus grupos.'],
 consolidado:['📈','Calificaciones de aseo','Consulta las valoraciones por estudiante.'],
 historial:['📊','Historial de aseo','Revisa los registros de días anteriores.'],
 tareas:['📚','Tareas','Revisa propuestas y consulta las tareas publicadas.'],
 avisos:['📣','Avisos','Publica comunicaciones para la comunidad.'],
 convivencia:['🤝','Convivencia','Acompaña reportes, explicaciones y compromisos.'],
 feria:['🔬','Feria STEAM','Acompaña y revisa los proyectos de tus estudiantes.'],
 eventos:['⭐','Evaluar eventos','Responde evaluaciones y consulta resultados.'],
 encuestas:['📋','Encuestas','Participa y consulta las encuestas institucionales.'],
 ingles:['🎧','Inglés con música','Actividades para escuchar y aprender.'],
 reportes:['🚨','Reportes','Consulta los reportes de tus estudiantes.'],
 misgrupos:['⚙️','Mis grupos','Escoge los grupos en los que impartes clase.'],
 administracion:['🔐','Administración','Gestiona estudiantes, docentes y asignaciones.'],
 estudiantes:['👥','Estudiantes','Registra y actualiza las fichas de estudiantes.'],
 profesores:['👨‍🏫','Profesores y permisos','Invita docentes, asigna grupos y gestiona accesos.'],
 asignacion:['📅','Asignación de aseo','Organiza los turnos de cada estudiante.']
};
export const paginasAdministrativas=['administracion','estudiantes','profesores','asignacion'];
export const seccionDe=tab=>seccionesDocente.find(s=>s.id===tab||s.paginas.includes(tab))?.id||'inicio';
export function novedadesSeccion(novedades,ids){const datos=ids.map(id=>novedades[id]).filter(Boolean);return{cantidad:datos.reduce((n,d)=>n+(d.cantidad||0),0),cambio:datos.some(d=>d.cambio)}}
