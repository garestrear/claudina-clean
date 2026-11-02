-- Ejecutar después de feria-espacios-programacion.sql,
-- feria-familias-estados.sql. Incluye la asignación automática actualizada.
-- No mueve reservas ni modifica proyectos al instalar. Repetible.
begin;
create or replace function public.feria_tramo_exposiciones()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare horario jsonb;
begin
 if to_regclass('public.feria_agenda_general') is not null then
  execute 'select jsonb_build_object(''fecha'',coalesce(r.fecha,a.fecha),''inicio'',coalesce(r.inicio,a.inicio),''fin'',coalesce(r.fin,a.fin)) from public.feria_agenda_general a left join public.feria_programacion r on r.id=a.reserva_id where a.codigo=''exposiciones'' and coalesce(r.activo,true)' into horario;
 end if;
 return coalesce(horario,jsonb_build_object('fecha','2026-11-06','inicio','08:00','fin','10:00'));
end $$;
revoke all on function public.feria_tramo_exposiciones() from public,anon,authenticated;
create or replace function public.feria_asignar_aula(fuente text,proyecto uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare aula uuid;ubicacion uuid;nombre text;horario jsonb;dia date;desde time;hasta time;
begin
 perform pg_advisory_xact_lock(20261106);
 horario:=public.feria_tramo_exposiciones();dia:=(horario->>'fecha')::date;desde:=(horario->>'inicio')::time;hasta:=(horario->>'fin')::time;
 if fuente='claudina' then select titulo into nombre from public.feria_proyectos where id=proyecto and estado='aprobado';
 elsif fuente='invitados' then select datos->>'titulo' into nombre from public.feria_proyectos_externos where id=proyecto and estado='aprobado';
 else raise exception 'Origen no válido';end if;
 if nombre is null then return null;end if;
 -- Las ubicaciones existentes, incluidas las movidas manualmente, se conservan.
 select id into ubicacion from public.feria_programacion where activo and origen=fuente and proyecto_id=proyecto and fecha=dia limit 1;
 if ubicacion is not null then return ubicacion;end if;
 select e.id into aula from public.feria_espacios e
 cross join lateral (
  select coalesce(max((select count(*) from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio<=p.momento and r.fin>p.momento)),0) ocupados
  from (select desde momento union select r.inicio from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio>=desde and r.inicio<hasta) p
 ) carga
 where e.activo and e.cupos>1 and carga.ocupados<e.cupos
 and not exists(select 1 from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio<hasta and r.fin>desde and r.exclusivo)
 order by (carga.ocupados+1)::numeric/e.cupos, carga.ocupados,e.orden,e.nombre,e.id limit 1;
 if aula is null then return null;end if;
 insert into public.feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo,creado_por)
 values(aula,dia,desde,hasta,'proyecto',fuente,proyecto,nombre,
 (select id from public.perfiles where id=auth.uid())) returning id into ubicacion;
 return ubicacion;
end $$;
revoke all on function public.feria_asignar_aula(text,uuid) from public,anon,authenticated;

create or replace function public.feria_asignar_al_aprobar()
returns trigger language plpgsql security definer set search_path='' as $$
declare asignada uuid;
begin
 if new.estado='aprobado' then
  if TG_OP='INSERT' then asignada:=public.feria_asignar_aula(TG_ARGV[0],new.id);
  elsif old.estado is distinct from new.estado then asignada:=public.feria_asignar_aula(TG_ARGV[0],new.id);
  else return new;end if;
  if asignada is null then raise exception 'No se pudo aprobar y asignar el proyecto: no hay cupos compartidos disponibles en el horario de exposiciones. En Aulas y espacios habilita espacios con más de un puesto y revisa sus reservas';end if;
 end if;
 return new;
end $$;
revoke all on function public.feria_asignar_al_aprobar() from public,anon,authenticated;
drop trigger if exists feria_asignacion_aula on public.feria_proyectos;
create trigger feria_asignacion_aula after insert or update of estado on public.feria_proyectos for each row execute function public.feria_asignar_al_aprobar('claudina');
drop trigger if exists feria_asignacion_aula on public.feria_proyectos_externos;
create trigger feria_asignacion_aula after insert or update of estado on public.feria_proyectos_externos for each row execute function public.feria_asignar_al_aprobar('invitados');

create or replace function public.feria_asignar_pendientes()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p record;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden asignar aulas';end if;
 perform pg_advisory_xact_lock(20261106);
 for p in select 'claudina' fuente,id from public.feria_proyectos where estado='aprobado' union all select 'invitados',id from public.feria_proyectos_externos where estado='aprobado' order by fuente,id
 loop perform public.feria_asignar_aula(p.fuente,p.id);end loop;
 return public.feria_espacios_contexto();
end $$;
revoke all on function public.feria_asignar_pendientes() from public,anon;
grant execute on function public.feria_asignar_pendientes() to authenticated;

create table if not exists public.feria_revision_aula_solicitudes(
 solicitud uuid primary key,autor uuid not null,entrada jsonb not null,respuesta jsonb not null
);
alter table public.feria_revision_aula_solicitudes enable row level security;
revoke all on public.feria_revision_aula_solicitudes from public,anon,authenticated;
create or replace function public.feria_revision_aulas_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 return public.feria_espacios_contexto()||jsonb_build_object('tramo',public.feria_tramo_exposiciones());
end $$;
revoke all on function public.feria_revision_aulas_contexto() from public,anon;
grant execute on function public.feria_revision_aulas_contexto() to authenticated;

create or replace function public.feria_revision_con_aula(
 origen text,proyecto uuid,version_esperada integer,decision text,comentario text,
 solicitud uuid,aula uuid,reserva uuid,version_reserva integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare entrada jsonb:=jsonb_build_array(origen,proyecto,version_esperada,decision,comentario,aula,reserva,version_reserva);
 previa public.feria_revision_aula_solicitudes;actual public.feria_programacion;
 resultado jsonb;horario jsonb;dia date;estado text;version_actual integer;ubicacion uuid;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden revisar y asignar aulas';end if;
 if origen is null or origen not in('claudina','invitados') or solicitud is null or aula is null then raise exception 'Revisa el proyecto y el aula seleccionada';end if;
 perform pg_advisory_xact_lock(20261106);
 select * into previa from public.feria_revision_aula_solicitudes s where s.solicitud=feria_revision_con_aula.solicitud;
 if previa.solicitud is not null then
  if previa.autor<>auth.uid() or previa.entrada<>entrada then raise exception 'Solicitud ya utilizada';end if;
  return previa.respuesta;
 end if;
 if origen='claudina' then
  select p.estado,p.version into estado,version_actual from public.feria_proyectos p where p.id=proyecto for update;
 else
  select p.estado,p.version into estado,version_actual from public.feria_proyectos_externos p where p.id=proyecto for update;
 end if;
 if version_actual is null or version_actual is distinct from version_esperada then raise exception 'El proyecto cambió. Actualiza y revisa la versión más reciente';end if;
 if coalesce(decision,estado)<>'aprobado' then raise exception 'Solo se asignan aulas a proyectos aprobados';end if;
 if not exists(select 1 from public.feria_espacios e where e.id=aula and e.activo and e.cupos>1) then raise exception 'Selecciona un espacio habilitado con más de un puesto simultáneo';end if;
 horario:=public.feria_tramo_exposiciones();dia:=(horario->>'fecha')::date;
 select * into actual from public.feria_programacion r where r.activo and r.origen=feria_revision_con_aula.origen and r.proyecto_id=proyecto and r.fecha=dia order by r.inicio,r.id limit 1 for update;
 if actual.id is distinct from reserva or (actual.id is not null and actual.version is distinct from version_reserva) then raise exception 'La ubicación cambió. Actualiza las aulas antes de guardar';end if;
 if decision is not null or length(trim(coalesce(comentario,'')))>0 then
  if origen='claudina' then resultado:=public.feria_revisar(proyecto,version_esperada,coalesce(decision,estado),coalesce(comentario,''),solicitud);
  else resultado:=public.feria_externa_revisar(proyecto,version_esperada,coalesce(decision,estado),coalesce(comentario,''),solicitud);end if;
 else
  if origen='claudina' then resultado:=public.feria_proyecto(proyecto);else resultado:=public.feria_externa_proyecto(proyecto);end if;
 end if;
 ubicacion:=public.feria_asignar_aula(origen,proyecto);
 if ubicacion is null then raise exception 'No hay cupos compartidos disponibles. Revisa Aulas y espacios';end if;
 select * into actual from public.feria_programacion r where r.id=ubicacion for update;
 if actual.espacio_id<>aula then
  -- Reutiliza cupos, cruces, exclusividad, puestos y control de versiones.
  perform public.feria_programacion_guardar(actual.id,to_jsonb(actual)||jsonb_build_object('espacio_id',aula),actual.version);
 end if;
 insert into public.feria_revision_aula_solicitudes values(solicitud,auth.uid(),entrada,resultado);
 return resultado;
end $$;
revoke all on function public.feria_revision_con_aula(text,uuid,integer,text,text,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.feria_revision_con_aula(text,uuid,integer,text,text,uuid,uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
