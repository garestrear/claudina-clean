export function esAudioPublico(url,origen){
 return url.origin===origen&&url.pathname.startsWith('/storage/v1/object/public/ingles-audios/');
}
// Un audio completo permite reutilizar la caché al retroceder y servir rangos.
export function solicitudAudioCompleto(request){
 const headers=new Headers(request.headers);headers.delete('range');
 return new Request(request,{headers});
}
