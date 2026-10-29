const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function idProyectoFeria(){const id=new URLSearchParams(window.location.search).get('proyectoFeria');return id&&uuid.test(id)?id:null}
