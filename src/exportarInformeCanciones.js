import {nombreGrupo} from '../lib/gruposDocente.js';

const columnas=[
  ['Estudiante',36],['Grado',10],['Canción',28],['Actividad',38],['Estado',19],
  ['Intentos',12],['Último puntaje /10',22],['Mejor puntaje /10',22],
  ['Puntos /100',16],['Mejor tiempo (s)',20],['Fecha del mejor intento (Colombia)',37],
];
const fechaColombia=new Intl.DateTimeFormat('es-CO',{
  dateStyle:'short',timeStyle:'medium',timeZone:'America/Bogota',
});

export async function crearInformeCanciones({estudiantes,actividades,resultados}){
  const modulo=await import('exceljs/dist/exceljs.min.js');
  const Excel=modulo.default||modulo;
  const libro=new Excel.Workbook();
  const porActividad=new Map([...resultados].map(([id,filas])=>[id,new Map(filas.map(f=>[f.id,f]))]));
  const grados=[...new Set(estudiantes.map(e=>e.grado))].sort((a,b)=>a-b);

  for(const grado of grados){
    const asignadas=actividades.filter(a=>a.grados.includes(grado));
    if(!asignadas.length)continue;
    const hoja=libro.addWorksheet(nombreGrupo(String(grado)));
    hoja.columns=columnas.map(([header,width])=>({header,width}));
    hoja.getRow(1).font={bold:true};
    hoja.views=[{state:'frozen',ySplit:1,xSplit:1}];
    hoja.autoFilter={from:'A1',to:'K1'};
    hoja.getColumn(7).numFmt='0.0';
    hoja.getColumn(8).numFmt='0.0';
    hoja.getColumn(9).numFmt='0.00';

    for(const estudiante of estudiantes.filter(e=>e.grado===grado)){
      for(const actividad of asignadas){
        const resultado=porActividad.get(actividad.id)?.get(estudiante.id);
        const total=resultado?.total;
        const nota=aciertos=>total&&aciertos!=null?Number((10*aciertos/total).toFixed(1)):null;
        hoja.addRow([
          estudiante.nombre,grado,actividad.cancion,actividad.titulo,
          resultado?'Con intentos':'Sin intentos',resultado?.intentos??0,
          nota(resultado?.aciertos),nota(resultado?.mejor_aciertos),
          resultado?.puntos??null,resultado?.mejor_tiempo_segundos??null,
          resultado?.mejor_logrado_at?fechaColombia.format(new Date(resultado.mejor_logrado_at)):null,
        ]);
      }
    }
  }
  return libro;
}

export async function descargarInformeCanciones(datos){
  const libro=await crearInformeCanciones(datos);
  const archivo=await libro.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([archivo],{
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const enlace=document.createElement('a');
  const nombre=datos.cancion?.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
  enlace.href=url;
  enlace.download=`informe-canciones-${datos.grupo}${nombre?'-'+nombre:''}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
