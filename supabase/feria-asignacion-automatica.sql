-- Ejecutar después de feria-espacios-programacion.sql. Repetible.
begin;
create or replace function public.feria_asignar_aula(fuente text,proyecto uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare aula uuid;ubicacion uuid;nombre text;
begin
 perform pg_advisory_xact_lock(20261106);
 if fuente='claudina' then select titulo into nombre from public.feria_proyectos where id=proyecto and estado='aprobado';
 elsif fuente='invitados' then select datos->>'titulo' into nombre from public.feria_proyectos_externos where id=proyecto and estado='aprobado';
 else raise exception 'Origen no válido';end if;
 if nombre is null then return null;end if;
 -- Las ubicaciones existentes, incluidas las movidas manualmente, se conservan.
 select id into ubicacion from public.feria_programacion where activo and origen=fuente and proyecto_id=proyecto and fecha=date '2026-11-06' limit 1;
 if ubicacion is not null then return ubicacion;end if;
 select e.id into aula from public.feria_espacios e
 cross join lateral (
  select coalesce(max((select count(*) from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=date '2026-11-06' and r.inicio<=p.momento and r.fin>p.momento)),0) ocupados
  from (select time '07:00' momento union select r.inicio from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=date '2026-11-06' and r.inicio>=time '07:00' and r.inicio<time '13:00') p
 ) carga
 where e.activo and e.tipo='salon' and e.cupos>1 and carga.ocupados<e.cupos
 and not exists(select 1 from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=date '2026-11-06' and r.inicio<time '13:00' and r.fin>time '07:00' and r.exclusivo)
 order by (carga.ocupados+1)::numeric/e.cupos, carga.ocupados,e.orden,e.nombre,e.id limit 1;
 if aula is null then return null;end if;
 insert into public.feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo,creado_por)
 values(aula,date '2026-11-06',time '07:00',time '13:00','proyecto',fuente,proyecto,nombre,
 (select id from public.perfiles where id=auth.uid())) returning id into ubicacion;
 return ubicacion;
end $$;
revoke all on function public.feria_asignar_aula(text,uuid) from public,anon,authenticated;

create or replace function public.feria_asignar_al_aprobar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado='aprobado' then
  if TG_OP='INSERT' then perform public.feria_asignar_aula(TG_ARGV[0],new.id);
  elsif old.estado is distinct from new.estado then perform public.feria_asignar_aula(TG_ARGV[0],new.id);end if;
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
