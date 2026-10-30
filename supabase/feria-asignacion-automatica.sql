-- Ejecutar después de feria-espacios-programacion.sql. Repetible.
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
notify pgrst,'reload schema';
commit;
