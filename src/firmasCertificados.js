export const firmantesPredeterminados=[
 {nombre:'YASMITH BERNAL',cargo:'Directora',firma:null},
 {nombre:'GUSTAVO ADOLFO RESTREPO ARBOLEDA',cargo:'Docente líder PRAE - Organizador Feria STEAM',firma:null}
];
// Conversión local: conserva la tinta, hace transparente el papel claro y recorta el margen.
export async function prepararFirma(archivo){
 if(archivo.size>5*1024*1024)throw new Error('La imagen debe pesar como máximo 5 MB.');
 if(!['image/png','image/jpeg','image/webp'].includes(archivo.type))throw new Error('Selecciona una imagen PNG, JPG o WebP.');
 const url=URL.createObjectURL(archivo);
 try{
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('No se pudo leer la imagen.'));i.src=url});
  if(img.width*img.height>25000000)throw new Error('La imagen es demasiado grande. Usa una foto de menor resolución.');
  const escala=Math.min(1,1400/img.width,700/img.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*escala));canvas.height=Math.max(1,Math.round(img.height*escala));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const datos=ctx.getImageData(0,0,canvas.width,canvas.height);let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const k=(y*canvas.width+x)*4,r=datos.data[k],g=datos.data[k+1],b=datos.data[k+2],v=Math.min(r,g,b);const opacidad=Math.max(0,Math.min(1,(245-v)/100));datos.data[k+3]=Math.round(datos.data[k+3]*opacidad);if(datos.data[k+3]>32){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
  if(x1<x0)throw new Error('No se detectó una firma. Usa tinta oscura sobre papel blanco.');
  ctx.putImageData(datos,0,0);const salida=document.createElement('canvas');salida.width=x1-x0+9;salida.height=y1-y0+9;salida.getContext('2d').drawImage(canvas,x0,y0,x1-x0+1,y1-y0+1,4,4,x1-x0+1,y1-y0+1);
  const firma=salida.toDataURL('image/png');if(firma.length>450000)throw new Error('La firma tiene demasiado detalle. Recorta la foto y vuelve a cargarla.');return firma;
 }finally{URL.revokeObjectURL(url)}
}
