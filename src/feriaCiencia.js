export const areasSteam=[
 {id:'science',nombre:'Science',es:'Ciencias'},
 {id:'technology',nombre:'Technology',es:'Tecnología'},
 {id:'engineering',nombre:'Engineering',es:'Ingeniería'},
 {id:'arts',nombre:'Arts',es:'Artes'},
 {id:'mathematics',nombre:'Mathematics',es:'Matemáticas'},
 {id:'emprendimiento',nombre:'Emprendimiento',es:'Productos, servicios e iniciativas'}
];
export const areasFeriaValidas=valor=>Array.isArray(valor)&&valor.length<=6&&valor.every(a=>areasSteam.some(opcion=>opcion.id===a))&&new Set(valor).size===valor.length;
export const estadosFeria={borrador:'Borrador',enviado:'Por revisar',ajustes:'En ajustes',aprobado:'Aprobado',rechazado:'Rechazado'};
export const camposFeria=[
 {id:'titulo',titulo:'Nombre del proyecto',max:150,corto:true,obligatorio:true,ayuda:'Un nombre que cuente tu idea.'},
 {id:'integrantes',titulo:'¿Quiénes participan?',max:2000,obligatorio:true,selector:true,ayuda:'Escoge a los compañeros que harán parte del equipo.'},
 {id:'propuesta',titulo:'¿Qué queremos hacer?',max:4000,obligatorio:true,ayuda:'Cuéntanos tu idea con tus propias palabras. ¿Qué quieres crear, investigar o resolver?'},
 {id:'procedimiento',titulo:'¿Cómo lo vamos a hacer?',max:4000,obligatorio:true,ayuda:'Explica los pasos o las pruebas que quieres realizar.'},
 {id:'materiales',titulo:'Materiales y recursos',max:2000,ayuda:'¿Qué necesitarás? Indica lo que ya tienes y lo que te hace falta.'},
 {id:'resultados_esperados',titulo:'¿Qué esperamos lograr?',max:2000,ayuda:'¿Qué te gustaría aprender o mostrar el día de la feria?'},
 {id:'bibliografia',titulo:'Bibliografía',max:4000,ayuda:'Anota los libros, páginas web, videos u otras fuentes que consultaste. Si puedes, incluye el autor, el título y el enlace.'},
 {id:'poster_url',titulo:'Enlace al póster (opcional)',max:2000,corto:true,tipo:'url',ayuda:'Pega el enlace al diseño listo para imprimir (Canva, Google Drive u otro). Activa el permiso de visualización para que los profesores puedan abrirlo e imprimirlo.'},
 {id:'apoyo',titulo:'¿En qué necesitamos ayuda?',max:2000,ayuda:'Puedes escribir tus dudas o indicar el apoyo que esperas del colegio.'}
];
export const datosFeria=p=>({...Object.fromEntries(camposFeria.map(c=>[c.id,typeof p?.[c.id]==='string'?p[c.id]:''])),areas:areasFeriaValidas(p?.areas)?[...p.areas]:[],asesor_id:typeof p?.asesor_id==='string'?p.asesor_id:'',integrantes_ids:Array.isArray(p?.integrantes_ids)?[...p.integrantes_ids]:[]});
export const gradoFeria=g=>Number(g)===0?'TS y JR':`${g}°`;
export const claveBorradorFeria=(cuenta,id)=>`claudina:feria:v1:${cuenta}:${id}`;
export function leerBorradorFeria(storage,clave){
 try{const b=JSON.parse(storage.getItem(clave));return b&&typeof b==='object'&&typeof b.proyectoId==='string'&&Number.isInteger(b.versionBase)&&b.datos&&(b.datos.areas===undefined||areasFeriaValidas(b.datos.areas))&&camposFeria.every(c=>(['bibliografia','poster_url'].includes(c.id)&&b.datos[c.id]===undefined)||(typeof b.datos[c.id]==='string'&&b.datos[c.id].length<=c.max))?{...b,datos:datosFeria(b.datos),referencias:Array.isArray(b.referencias)?b.referencias.filter(e=>e&&typeof e.id==='string'&&typeof e.nombre==='string'&&Number.isInteger(e.grado)&&e.grado>=0&&e.grado<=8):[]}:null}catch{return null}
}
export const enlacePosterValido=valor=>{try{const u=new URL(valor);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password}catch{return false}};
export function validarFeria(datos,enviar){
 if(datos.poster_url?.trim()&&!enlacePosterValido(datos.poster_url.trim()))return 'Pega un enlace válido al póster que comience por https:// o http://.';
 if(!areasFeriaValidas(datos.areas)||datos.areas.length===0)return 'Selecciona una o varias áreas STEAM para clasificar el proyecto.';
 if(!datos.asesor_id)return 'Escoge un profesor asesor de la lista de docentes.';
 if(datos.titulo.trim().length<3)return 'Escribe un nombre de al menos 3 caracteres para el proyecto.';
 if(enviar&&camposFeria.some(c=>c.obligatorio&&c.id!=='integrantes'&&!datos[c.id].trim()))return 'Antes de enviar, completa qué harás y cómo lo harás.';
 return '';
}
