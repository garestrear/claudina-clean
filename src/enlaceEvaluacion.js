const patron=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clave='claudina:evaluacion-ingreso';
export function idEvaluacion(){const id=new URLSearchParams(window.location.search).get('evaluacion');return id&&patron.test(id)?id:null}
export function enlaceEvaluacion(id,acudiente=false){if(!patron.test(id))throw new Error('Evaluación inválida');const url=new URL('/',window.location.origin);url.searchParams.set('evaluacion',id);if(acudiente)url.searchParams.set('ingreso','acudiente');return url.href}
export function destinoIngreso(){const id=idEvaluacion();if(id){try{sessionStorage.setItem(clave,id)}catch{}return enlaceEvaluacion(id)}return window.location.origin}
export function restaurarEvaluacion(){try{const id=sessionStorage.getItem(clave);sessionStorage.removeItem(clave);if(!idEvaluacion()&&id&&patron.test(id)){const url=new URL(window.location.href);url.searchParams.set('evaluacion',id);window.history.replaceState(null,'',url.href)}}catch{}}
