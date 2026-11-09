// Reduce solo fotos nuevas. Si el navegador no puede convertirlas, conserva el original.
export async function optimizarFoto(archivo){
 if(!['image/jpeg','image/png','image/webp'].includes(archivo.type)||archivo.size<=250000)return archivo;
 let imagen;
 try{
  imagen=await createImageBitmap(archivo);
  const escala=Math.min(1,1600/Math.max(imagen.width,imagen.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(imagen.width*escala));canvas.height=Math.max(1,Math.round(imagen.height*escala));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(imagen,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
  return blob&&blob.size<archivo.size?new File([blob],archivo.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:archivo.lastModified}):archivo;
 }catch{return archivo}finally{imagen?.close()}
}
