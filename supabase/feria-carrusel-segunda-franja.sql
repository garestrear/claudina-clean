-- Ejecutar después de feria-dos-franjas.sql. Conserva planes: regenerar la segunda franja antes de guardar.
begin;
create or replace function public.feria_carrusel_contexto(dia date,desde time,hasta time)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare aulas jsonb;visitantes jsonb;docentes jsonb;guardado public.feria_planes_carrusel;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden organizar el carrusel';end if;
 if dia is null or desde is null or hasta is null or hasta<=desde then raise exception 'Revisa el horario del carrusel';end if;
 -- Un bloque debe tener las mismas exposiciones durante todo el recorrido.
 if exists(select 1 from public.feria_programacion r where r.activo and r.tipo='proyecto' and r.fecha=dia and r.inicio<hasta and r.fin>desde
 and ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')))
 and (r.inicio>desde or r.fin<hasta)) then raise exception 'Las exposiciones cambian dentro de este bloque. Divide el horario en tramos con las mismas aulas y proyectos';end if;
 select coalesce(jsonb_agg(x.d order by x.orden,x.nombre,x.id),'[]'::jsonb) into aulas from (
 select e.id,e.orden,e.nombre,jsonb_build_object('id',e.id,'nombre',e.nombre,'aforo',e.aforo,'proyectos',count(distinct (r.origen,r.proyecto_id)),'requiere_lider',count(distinct (r.origen,r.proyecto_id))>1) d
 from public.feria_espacios e join public.feria_programacion r on r.espacio_id=e.id and r.activo and r.tipo='proyecto' and r.fecha=dia and r.inicio<=desde and r.fin>=hasta
 where e.activo and ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')))
 group by e.id) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.grado,e.nombre,e.id),'[]'::jsonb) into visitantes
 from public.estudiantes e where e.activo and (not(desde>=time '10:15' and hasta<=time '11:40') or e.grado<>0) and not exists(select 1 from public.feria_proyectos p where p.estado='aprobado' and p.titulo not like '[Emprendimiento familiar] %' and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) and exists(select 1 from public.feria_programacion r where r.activo and r.tipo='proyecto' and r.origen='claudina' and r.proyecto_id=p.id and r.fecha=dia and r.inicio<hasta and r.fin>desde));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre,p.id),'[]'::jsonb) into docentes from public.perfiles p where p.rol='profesor';
 select * into guardado from public.feria_planes_carrusel p where p.fecha=dia and p.inicio=desde and p.fin=hasta;
 return jsonb_build_object('segunda_franja',desde>=time '10:15' and hasta<=time '11:40','aulas',aulas,'visitantes',visitantes,'docentes',docentes,'plan',guardado.datos,'firma_guardada',guardado.firma,'version',coalesce(guardado.version,0),'firma',md5(jsonb_build_array(aulas,visitantes,docentes)::text));
end $$;
do $migration$
declare definicion text;marca text:='-- Segunda franja: cinco grupos y cuatro visitas de cinco minutos.';
begin
 select pg_get_functiondef('public.feria_carrusel_guardar(date,time,time,jsonb,text,integer)'::regprocedure) into definicion;
 if position(marca in definicion)=0 then
  if position('insert into public.feria_planes_carrusel' in definicion)=0 then raise exception 'Activa feria-carrusel.sql antes de esta actualización';end if;
  definicion:=replace(definicion,'insert into public.feria_planes_carrusel', $checks$
 -- Segunda franja: cinco grupos y cuatro visitas de cinco minutos.
 if desde>=time '10:15' and hasta<=time '11:40' then
  if jsonb_array_length(ctx->'aulas')<>5 or jsonb_array_length(datos->'grupos')<>5
   or (datos->>'minutos')::integer is distinct from 5 or (datos->>'max_rotaciones')::integer is distinct from 4
   or (datos->>'segunda_franja')::boolean is distinct from true then raise exception 'La segunda franja requiere cinco espacios, cinco grupos y cuatro rotaciones de cinco minutos. Regenera los grupos';end if;
  if hasta-desde<interval '20 minutes' then raise exception 'Se requieren al menos veinte minutos para las cuatro rotaciones';end if;
  if exists(select 1 from jsonb_array_elements(datos->'grupos') g where jsonb_array_length(g->'estudiantes_ids')=0) then raise exception 'Los cinco grupos deben tener estudiantes';end if;
  if exists(select 1 from jsonb_array_elements(datos->'grupos') g cross join lateral jsonb_array_elements_text(g->'estudiantes_ids') s
   join jsonb_array_elements(ctx->'visitantes') e on e->>'id'=s where (e->>'grado')::integer>=6
   group by (1=1) having count(distinct g->>'numero')>1) then raise exception 'Bachillerato debe permanecer en un solo grupo';end if;
  if exists(select 1 from jsonb_array_elements(datos->'grupos') g cross join lateral jsonb_array_elements_text(g->'estudiantes_ids') s
   join jsonb_array_elements(ctx->'visitantes') e on e->>'id'=s where (e->>'grado')::integer in(1,3,4,5)
   group by e->>'grado' having count(distinct g->>'numero')>1) then raise exception 'Conserva juntos los estudiantes de cada grado de primaria; solo segundo puede repartirse';end if;
 end if;
$checks$ || 'insert into public.feria_planes_carrusel');
  execute definicion;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
