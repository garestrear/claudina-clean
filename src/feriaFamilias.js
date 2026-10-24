// Conserva el flujo de permisos y revisión de feria_guardar, sin otra tabla.
export const prefijoFamilia='[Emprendimiento familiar] ';
export const esEmprendimiento=p=>typeof p?.titulo==='string'&&p.titulo.startsWith(prefijoFamilia);
export const tituloFeria=p=>esEmprendimiento(p)?p.titulo.slice(prefijoFamilia.length):p?.titulo||'';
export const datosEmprendimiento=d=>({...d,titulo:prefijoFamilia+d.titulo.trim()});
export const camposEmprendimiento=[
 {id:'titulo',titulo:'Nombre del emprendimiento',max:125,corto:true,obligatorio:true,ayuda:'¿Cómo se llama tu producto, servicio o idea?'},
 {id:'materiales',titulo:'Responsable y familiares participantes',max:2000,obligatorio:true,ayuda:'Escribe el nombre de la persona responsable y de quienes te acompañarán. No incluyas documentos de identidad.'},
 {id:'propuesta',titulo:'¿Qué vas a ofrecer o presentar?',max:4000,obligatorio:true,ayuda:'Describe tus productos o servicios y a quiénes están dirigidos.'},
 {id:'procedimiento',titulo:'¿Cómo lo elaboras o qué hace especial tu propuesta?',max:4000,obligatorio:true,ayuda:'Cuéntanos cómo lo preparas, produces o prestas y qué lo hace especial.'},
 {id:'resultados_esperados',titulo:'¿Qué te gustaría lograr en la feria?',max:2000,ayuda:'Por ejemplo: dar a conocer tu trabajo, vender productos o compartir un saber.'},
 {id:'apoyo',titulo:'¿Qué necesitas para participar?',max:2000,ayuda:'Indica mesas, sillas, electricidad o espacio. Escribe cantidades y detalles para que los organizadores puedan revisarlos.'}
];
