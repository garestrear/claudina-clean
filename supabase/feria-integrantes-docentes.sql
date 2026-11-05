-- Ejecutar después de feria-correcciones-docentes.sql y feria-edicion-equipos.sql.
-- Conserva estado, asesor, ubicación y responsable original del registro.
begin;
create or replace function public.feria_docente_integrantes(proyecto uuid,equipo uuid[],version_esperada integer,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;previa public.feria_correcciones_docentes;ids uuid[];nombres text;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo los docentes pueden cambiar los integrantes';end if;
 if proyecto is null or solicitud is null or version_esperada is null or equipo is null or cardinality(equipo)=0 or cardinality(equipo)>200 or array_position(equipo,null) is not null then raise exception 'Selecciona entre 1 y 200 integrantes válidos';end if;
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is null or p.estado='borrador' then raise exception 'Proyecto no disponible para revisión docente';end if;
 select * into previa from public.feria_correcciones_docentes c where c.solicitud=feria_docente_integrantes.solicitud;
 if previa.id is not null then
  if previa.docente_id<>auth.uid() or previa.proyecto_id<>proyecto or previa.origen<>'claudina' or not(previa.despues ? 'integrantes') then raise exception 'Solicitud no válida';end if;
  return public.feria_proyecto(proyecto);
 end if;
 if p.version<>version_esperada then raise exception 'El proyecto cambió. Vuelve a abrirlo y revisa los integrantes antes de guardar';end if;
 select array_agg(distinct id order by id) into ids from unnest(equipo) id;
 if exists(select 1 from unnest(ids) x(id) left join public.estudiantes e on e.id=x.id where e.id is null or (not e.activo and not(x.id=any(p.integrantes_ids)))) then raise exception 'Selecciona estudiantes activos de la lista';end if;
 select string_agg(e.nombre,'; ' order by e.nombre,e.id) into nombres from public.estudiantes e where e.id=any(ids);
 if length(nombres)>2000 then raise exception 'La lista de integrantes supera el máximo permitido';end if;
 if ids is distinct from (select array_agg(id order by id) from unnest(p.integrantes_ids) id) then
  update public.feria_proyectos set integrantes_ids=ids,integrantes=nombres,version=p.version+1,revision_contenido=p.revision_contenido+1,actualizado_en=now() where id=proyecto;
  insert into public.feria_correcciones_docentes(origen,proyecto_id,docente_id,nombre_docente,antes,despues,version_anterior,solicitud)
  values('claudina',proyecto,auth.uid(),(select nombre from public.perfiles where id=auth.uid()),jsonb_build_object('integrantes',p.integrantes),jsonb_build_object('integrantes',nombres),p.version,solicitud);
 end if;
 return public.feria_proyecto(proyecto);
end;$$;
revoke all on function public.feria_docente_integrantes(uuid,uuid[],integer,uuid) from public,anon;
grant execute on function public.feria_docente_integrantes(uuid,uuid[],integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
