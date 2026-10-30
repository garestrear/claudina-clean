-- Ejecutar después de feria-espacios-programacion.sql. No reemplaza cambios ya guardados.
begin;
select pg_advisory_xact_lock(20261106);
create table if not exists public.feria_agenda_general(
 id uuid primary key default gen_random_uuid(),codigo text not null unique,
 fecha date not null default date '2026-11-06',inicio time not null,fin time not null check(fin>inicio),
 titulo text not null check(length(trim(titulo)) between 3 and 200),detalle text not null default '' check(length(detalle)<=4000),
 reserva_id uuid unique references public.feria_programacion(id),version integer not null default 1
);
alter table public.feria_agenda_general enable row level security;
revoke all on public.feria_agenda_general from public,anon,authenticated;
insert into public.feria_espacios(codigo,nombre,tipo,orden,cubierto)
select 'aula-multiple','Aula múltiple','otro',12,true where not exists(select 1 from public.feria_espacios where lower(trim(nombre))='aula múltiple') on conflict(codigo) do nothing;
insert into public.feria_espacios(codigo,nombre,tipo,orden,cubierto)
select 'patio-nuevo','Patio nuevo','patio',13,false where not exists(select 1 from public.feria_espacios where lower(trim(nombre))='patio nuevo') on conflict(codigo) do nothing;

do $$
declare actividad record;lugar uuid;reserva uuid;
begin
 for actividad in select * from (values
 ('logistica','07:00'::time,'07:30'::time,'Logística y preparación de los stands','Reclamar escarapelas. Los estudiantes expositores preparan sus stands.',null::text),
 ('apertura','07:30'::time,'08:00'::time,'Apertura de la Feria STEAM','Himno Nacional. Palabras de la directora Yasmidth Bernal y de los docentes Guillermo Adelkin Villegas Restrepo, Johana Cabrera y Luz Enidia David.','Aula múltiple'),
 ('exposiciones','08:00'::time,'10:00'::time,'Exposiciones de proyectos en carrusel','Recorrido por los proyectos con el acompañamiento de los docentes. Rutas y grupos por definir.',null),
 ('refrigerio','10:00'::time,'10:15'::time,'Refrigerio','Pausa para estudiantes, docentes, expositores y visitantes.',null),
 ('charlas','10:15'::time,'11:35'::time,'Carrusel de charlas de los visitantes','Cuatro rotaciones de 20 minutos: 10:15–10:35, 10:35–10:55, 10:55–11:15 y 11:15–11:35. Es posible que los grupos no alcancen a asistir a todas las charlas. Charlas, aulas y rutas por confirmar.',null),
 ('puentes','11:35'::time,'12:15'::time,'Final del concurso de puentes','Los finalistas deberán estar presentes. Se realiza simultáneamente con la obra de teatro de AMVA.','Patio nuevo'),
 ('teatro','11:35'::time,'12:15'::time,'Obra de teatro de AMVA','Actividad simultánea con la final de puentes. El Aula múltiple será otro espacio para visitar. La distribución de los grupos se organizará según el aforo.','Aula múltiple'),
 ('premiacion','12:15'::time,'12:30'::time,'Premiación','Reconocimiento a los proyectos destacados y premiación de los concursos.','Aula múltiple')
 ) x(codigo,inicio,fin,titulo,detalle,lugar)
 loop
  if exists(select 1 from public.feria_agenda_general a where a.codigo=actividad.codigo) then continue;end if;
  reserva:=null;
  if actividad.lugar is not null then
   select id into lugar from public.feria_espacios where lower(trim(nombre))=lower(actividad.lugar) order by orden,id limit 1;
   if lugar is null then raise exception 'Falta el espacio %',actividad.lugar;end if;
   if exists(select 1 from public.feria_programacion r where r.activo and r.espacio_id=lugar and r.fecha=date '2026-11-06' and r.inicio<actividad.fin and r.fin>actividad.inicio) then
    raise exception 'Hay una reserva previa en % entre % y %. Reubícala antes de activar la agenda.',actividad.lugar,actividad.inicio,actividad.fin;
   end if;
   insert into public.feria_programacion(espacio_id,fecha,inicio,fin,tipo,titulo,exclusivo)
   values(lugar,date '2026-11-06',actividad.inicio,actividad.fin,'actividad',actividad.titulo,true) returning id into reserva;
  end if;
  insert into public.feria_agenda_general(codigo,inicio,fin,titulo,detalle,reserva_id)
  values(actividad.codigo,actividad.inicio,actividad.fin,actividad.titulo,actividad.detalle,reserva);
 end loop;
end $$;

create or replace function public.feria_agenda_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden consultar la agenda de organización';end if;
 return jsonb_build_object('actividades',coalesce((select jsonb_agg(jsonb_build_object(
 'id',a.id,'codigo',a.codigo,'titulo',coalesce(r.titulo,a.titulo),'fecha',coalesce(r.fecha,a.fecha),
 'inicio',coalesce(r.inicio,a.inicio),'fin',coalesce(r.fin,a.fin),'detalle',a.detalle,'version',a.version,
 'reserva_id',a.reserva_id,'reserva_version',r.version,'activo',coalesce(r.activo,true),'espacio_id',r.espacio_id,'espacio_nombre',e.nombre)
 order by coalesce(r.fecha,a.fecha),coalesce(r.inicio,a.inicio),a.codigo)
 from public.feria_agenda_general a left join public.feria_programacion r on r.id=a.reserva_id left join public.feria_espacios e on e.id=r.espacio_id),'[]'::jsonb));
end $$;

create or replace function public.feria_agenda_guardar(actividad uuid,datos jsonb,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.feria_agenda_general;r public.feria_programacion;ubicacion uuid;nueva_reserva uuid;nombre text;nota text;dia date;desde time;hasta time;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden editar la agenda';end if;
 perform pg_advisory_xact_lock(20261106);
 select * into a from public.feria_agenda_general where id=actividad for update;
 if a.id is null or a.version is distinct from version_esperada then raise exception 'La actividad cambió. Actualiza la agenda';end if;
 if jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>20000 then raise exception 'Datos no válidos';end if;
 nombre:=trim(datos->>'titulo');nota:=coalesce(trim(datos->>'detalle'),'');dia:=(datos->>'fecha')::date;desde:=(datos->>'inicio')::time;hasta:=(datos->>'fin')::time;ubicacion:=nullif(datos->>'espacio_id','')::uuid;
 if nombre is null or length(nombre) not between 3 and 200 or length(nota)>4000 or dia is null or desde is null or hasta is null or hasta<=desde then raise exception 'Revisa título, horario y descripción';end if;
 if a.reserva_id is not null then
  select * into r from public.feria_programacion where id=a.reserva_id;
  if r.version is distinct from (datos->>'reserva_version')::integer or not r.activo then raise exception 'La reserva cambió o se canceló. Actualiza la agenda';end if;
 end if;
 if ubicacion is not null then
  nueva_reserva:=coalesce(a.reserva_id,gen_random_uuid());
  perform public.feria_programacion_guardar(nueva_reserva,jsonb_build_object(
   'espacio_id',ubicacion,'fecha',dia,'inicio',desde,'fin',hasta,'tipo','actividad','titulo',nombre,
   'exclusivo',true,'responsable',coalesce(r.responsable,''),'docente_id',r.docente_id,'notas',coalesce(r.notas,'')),coalesce(r.version,0));
  a.reserva_id:=nueva_reserva;
 elsif a.reserva_id is not null then
  perform public.feria_programacion_cancelar(a.reserva_id,r.version);a.reserva_id:=null;
 end if;
 update public.feria_agenda_general set titulo=nombre,detalle=nota,fecha=dia,inicio=desde,fin=hasta,reserva_id=a.reserva_id,version=version+1 where id=actividad;
 return public.feria_agenda_contexto();
end $$;
revoke all on function public.feria_agenda_contexto(),public.feria_agenda_guardar(uuid,jsonb,integer) from public,anon;
grant execute on function public.feria_agenda_contexto(),public.feria_agenda_guardar(uuid,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
