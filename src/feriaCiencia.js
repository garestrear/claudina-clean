export const areasSteam=[
 {id:'science',nombre:'Science',es:'Ciencias'},
 {id:'technology',nombre:'Technology',es:'Tecnología'},
 {id:'engineering',nombre:'Engineering',es:'Ingeniería'},
 {id:'arts',nombre:'Arts',es:'Artes'},
 {id:'mathematics',nombre:'Mathematics',es:'Matemáticas'}
];
export const areasFeriaValidas=valor=>Array.isArray(valor)&&valor.length<=5&&valor.every(a=>areasSteam.some(opcion=>opcion.id===a))&&new Set(valor).size===valor.length;
export const estadosFeria={borrador:'Borrador',enviado:'Por revisar',ajustes:'En ajustes',aprobado:'Aprobado'};
export const camposFeria=[
 {id:'titulo',titulo:'Nombre del proyecto',max:150,corto:true,obligatorio:true,ayuda:'Un nombre que cuente su idea.'},
 {id:'integrantes',titulo:'¿Quiénes participan?',max:2000,obligatorio:true,ayuda:'Escribe los nombres y grados de todos los integrantes, incluido el tuyo.'},
 {id:'propuesta',titulo:'¿Qué queremos hacer?',max:4000,obligatorio:true,ayuda:'Cuéntanos su idea con sus propias palabras. ¿Qué quieren crear, investigar o resolver?'},
 {id:'procedimiento',titulo:'¿Cómo lo vamos a hacer?',max:4000,obligatorio:true,ayuda:'Explica los pasos o las pruebas que quieren realizar.'},
 {id:'materiales',titulo:'Materiales y recursos',max:2000,ayuda:'¿Qué necesitarán? Pueden indicar lo que ya tienen y lo que les hace falta.'},
 {id:'resultados_esperados',titulo:'¿Qué esperamos lograr?',max:2000,ayuda:'¿Qué les gustaría aprender o mostrar el día de la feria?'},
 {id:'apoyo',titulo:'¿En qué necesitamos ayuda?',max:2000,ayuda:'Pueden escribir sus dudas o el apoyo que esperan del colegio.'}
];
export const datosFeria=p=>({...Object.fromEntries(camposFeria.map(c=>[c.id,typeof p?.[c.id]==='string'?p[c.id]:''])),areas:areasFeriaValidas(p?.areas)?[...p.areas]:[],asesor_id:typeof p?.asesor_id==='string'?p.asesor_id:''});
export const gradoFeria=g=>Number(g)===0?'TS y JR':`${g}°`;
export const claveBorradorFeria=(cuenta,id)=>`claudina:feria:v1:${cuenta}:${id}`;
export function leerBorradorFeria(storage,clave){
 try{const b=JSON.parse(storage.getItem(clave));return b&&typeof b==='object'&&typeof b.proyectoId==='string'&&Number.isInteger(b.versionBase)&&b.datos&&(b.datos.areas===undefined||areasFeriaValidas(b.datos.areas))&&camposFeria.every(c=>typeof b.datos[c.id]==='string'&&b.datos[c.id].length<=c.max)?{...b,datos:datosFeria(b.datos)}:null}catch{return null}
}
export function validarFeria(datos,enviar){
 if(!areasFeriaValidas(datos.areas)||datos.areas.length===0)return 'Selecciona una o varias áreas STEAM para clasificar el proyecto.';
 if(!datos.asesor_id)return 'Escoge un profesor asesor de la lista de docentes.';
 if(datos.titulo.trim().length<3)return 'Escribe un nombre de al menos 3 caracteres para el proyecto.';
 if(enviar&&camposFeria.some(c=>c.obligatorio&&!datos[c.id].trim()))return 'Antes de enviar, completa los integrantes, qué harán y cómo lo harán.';
 return '';
}
