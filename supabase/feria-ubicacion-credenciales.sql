-- Ejecutar después de los módulos de espacios, placas y participantes. Incluye la reparación de la asignación automática.
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

-- Ubicación viva: las credenciales reflejan también los movimientos manuales.
create or replace function public.feria_ubicaciones_proyecto(fuente text,proyecto uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('espacio_id',e.id,'espacio_nombre',e.nombre,'fecha',r.fecha,'inicio',r.inicio,'fin',r.fin,'puesto',r.puesto) order by r.fecha,r.inicio,e.orden,e.nombre,r.id),'[]'::jsonb)
 from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id
 where r.activo and e.activo and r.tipo='proyecto' and r.origen=fuente and r.proyecto_id=proyecto;
$$;
revoke all on function public.feria_ubicaciones_proyecto(text,uuid) from public,anon,authenticated;
create or replace function public.feria_asegurar_ubicacion_proyecto(fuente text,proyecto uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare asignada uuid;ubicaciones jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden asignar ubicaciones';end if;
 if not((fuente='claudina' and exists(select 1 from public.feria_proyectos p where p.id=proyecto and p.estado='aprobado')) or(fuente='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=proyecto and p.estado='aprobado'))) then raise exception 'Selecciona un proyecto aprobado';end if;
 asignada:=public.feria_asignar_aula(fuente,proyecto);
 ubicaciones:=public.feria_ubicaciones_proyecto(fuente,proyecto);
 return jsonb_build_object('asignado',asignada is not null,'ubicaciones',ubicaciones,'mensaje',case when asignada is null then 'Proyecto aprobado pendiente de ubicación: no hay cupos compartidos disponibles en el horario de exposiciones. Configura más de un puesto por espacio y revisa las reservas.' else 'Ubicación confirmada.' end);
end $$;
revoke all on function public.feria_asegurar_ubicacion_proyecto(text,uuid) from public,anon;
grant execute on function public.feria_asegurar_ubicacion_proyecto(text,uuid) to authenticated;
create or replace function public.feria_placas_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid;externo boolean;salida jsonb;resumen jsonb;
begin
 ficha:=(public.feria_ficha_actual()).id;
 externo:=coalesce(public.feria_externo_autorizado(),false);
 if auth.uid() is null or not(docente or ficha is not null or externo) then raise exception 'Ingresa con una cuenta autorizada para consultar las placas';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.numero_general),'[]'::jsonb) into salida from (
  select pl.origen,pl.proyecto_id,pl.categoria,pl.numero_general,pl.numero_categoria,
   case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0') codigo,
   case when p.titulo like '[Emprendimiento familiar] %' then substr(p.titulo,27) else p.titulo end titulo,
   case when p.titulo like '[Emprendimiento familiar] %' and length(trim(p.materiales))>0 then p.materiales else p.integrantes end integrantes,
   p.grado::text grado,'C.E.R. Claudina Múnera'::text institucion,public.feria_ubicaciones_proyecto(pl.origen,pl.proyecto_id) ubicaciones
  from public.feria_placas pl join public.feria_proyectos p on pl.origen='claudina' and p.id=pl.proyecto_id
  where p.estado='aprobado' and (docente or p.estudiante_id=ficha or ficha=any(p.integrantes_ids))
  union all
  select pl.origen,pl.proyecto_id,pl.categoria,pl.numero_general,pl.numero_categoria,
   case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0'),
   p.datos->>'titulo',p.datos->>'integrantes',null::text,p.datos->>'institucion',public.feria_ubicaciones_proyecto(pl.origen,pl.proyecto_id)
  from public.feria_placas pl join public.feria_proyectos_externos p on pl.origen='invitados' and p.id=pl.proyecto_id
  where p.estado='aprobado' and (docente or (externo and p.autor=auth.uid()))
 ) q;
 select jsonb_build_object(
  'registrados',(select count(*) from public.feria_proyectos where estado<>'borrador')+(select count(*) from public.feria_proyectos_externos where estado<>'borrador'),
  'aprobados',count(*),'stem',count(*) filter(where categoria='stem'),'arte',count(*) filter(where categoria='arte'),'emprendimiento',count(*) filter(where categoria='emprendimiento'),'familias',count(*) filter(where categoria='familias')
 ) into resumen from public.feria_placas pl where
  (pl.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=pl.proyecto_id and p.estado='aprobado')) or
  (pl.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=pl.proyecto_id and p.estado='aprobado'));
 return jsonb_build_object('resumen',resumen,'placas',salida,'docente',docente);
end $$;
revoke all on function public.feria_placas_contexto() from public,anon;
grant execute on function public.feria_placas_contexto() to authenticated;
create or replace function public.feria_participante_datos(persona uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.feria_participantes;i public.feria_proyectos;e public.feria_proyectos_externos;pl public.feria_placas;habilitado boolean;titulo text:='';institucion_actual text;nombre_actual text;grado_actual text;
begin
 select * into p from public.feria_participantes where id=persona;if p.id is null then return null;end if;
 habilitado:=p.activo;institucion_actual:=p.institucion;nombre_actual:=p.nombre;grado_actual:=p.grado;
 if p.estudiante_id is not null then
  select nombre,case when grado=0 then 'TS y JR' else grado||'°' end into nombre_actual,grado_actual from public.estudiantes where id=p.estudiante_id and activo;
  habilitado:=habilitado and nombre_actual is not null;
 end if;
 if p.proyecto_id is not null then
  if p.proyecto_origen='claudina' then
   select * into i from public.feria_proyectos where id=p.proyecto_id;
   habilitado:=habilitado and i.id is not null and i.estado='aprobado';
   if p.automatico then habilitado:=habilitado and(p.estudiante_id=i.estudiante_id or p.estudiante_id=any(i.integrantes_ids));end if;
   titulo:=case when i.titulo like '[Emprendimiento familiar] %' then substr(i.titulo,27) else i.titulo end;
  else
   select * into e from public.feria_proyectos_externos where id=p.proyecto_id;
   habilitado:=habilitado and e.id is not null and e.estado='aprobado';titulo:=e.datos->>'titulo';
  end if;
  select * into pl from public.feria_placas where origen=p.proyecto_origen and proyecto_id=p.proyecto_id;
 elsif p.tipo='expositor' then habilitado:=false;
 end if;
 return (to_jsonb(p)-'creado_por')||jsonb_build_object('nombre',coalesce(nombre_actual,p.nombre),'grado',coalesce(grado_actual,p.grado),'habilitado',coalesce(habilitado,false),'proyecto_titulo',coalesce(titulo,''),'categoria',pl.categoria,
 'proyecto_codigo',case when pl.proyecto_id is null then '' else case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0') end,'numero_general',pl.numero_general,'ubicaciones',case when coalesce(habilitado,false) and p.proyecto_id is not null then public.feria_ubicaciones_proyecto(p.proyecto_origen,p.proyecto_id) else '[]'::jsonb end);
end $$;
revoke all on function public.feria_participante_datos(uuid) from public,anon,authenticated;

-- Repara los aprobados anteriores sin duplicar ni mover reservas existentes.
do $$declare p record;begin
 for p in select 'claudina' fuente,id from public.feria_proyectos where estado='aprobado' union all select 'invitados',id from public.feria_proyectos_externos where estado='aprobado' order by fuente,id
 loop perform public.feria_asignar_aula(p.fuente,p.id);end loop;
end $$;
notify pgrst,'reload schema';
commit;
