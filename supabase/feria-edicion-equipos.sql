-- Ejecutar después de feria-poster.sql. Conserva inscripciones y revisiones.
begin;
create or replace function public.feria_proyecto(proyecto uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.feria_proyectos;docente boolean:=coalesce(public.es_profesor(),false);
begin
 if auth.uid() is null or not(docente or (public.feria_ficha_actual()).id is not null) then raise exception 'Inicia sesión con una cuenta autorizada';end if;
 select * into p from public.feria_proyectos where id=proyecto;
 if p.id is null or not coalesce((docente and p.estado<>'borrador') or p.estudiante_id=(public.feria_ficha_actual()).id or (public.feria_ficha_actual()).id=any(p.integrantes_ids),false) then raise exception 'Proyecto no disponible';end if;
 return jsonb_build_object('puede_editar',coalesce(p.estudiante_id=(public.feria_ficha_actual()).id or (public.feria_ficha_actual()).id=any(p.integrantes_ids),false),'proyecto',to_jsonb(p)-'autor'-'ultimo_guardado'-'estudiante_id','asesor_nombre',(select pf.nombre from public.perfiles pf where pf.id=p.asesor_id),'registrado_por',(select e.nombre from public.estudiantes e where e.id=p.estudiante_id),
 'integrantes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado,'activo',e.activo) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb),
 'revisiones',coalesce((select jsonb_agg(to_jsonb(r)-'revisor'-'solicitud' order by r.creado_en desc,r.id) from public.feria_revisiones r where r.proyecto_id=p.id),'[]'::jsonb));
end;
$$;

do $migration$
declare d text;
begin
 select pg_get_functiondef('public.feria_guardar(uuid,jsonb,integer,boolean,uuid)'::regprocedure) into d;
 if position('Edición compartida' in d)=0 then
  if position('if p.estudiante_id<>ficha.id then' in d)=0 then raise exception 'Revisa feria_guardar: definición no compatible';end if;
  d:=replace(d,'if p.estudiante_id<>ficha.id then','-- Edición compartida: conserva control de versión y estudiante responsable.'||chr(10)||'  if p.estudiante_id<>ficha.id and not(ficha.id=any(p.integrantes_ids)) then');
  d:=replace(d,'Solo el estudiante que registra y su acudiente vinculado pueden modificar el proyecto','Solo los integrantes del proyecto y sus acudientes vinculados pueden modificarlo');
  d:=replace(d,'select string_agg(e.nombre',E'-- Conserva al responsable original en el equipo.\n select array_agg(distinct x) into equipo from unnest(equipo || coalesce((select array[fp.estudiante_id] from public.feria_proyectos fp where fp.id=proyecto),array[]::uuid[])) x;\n select string_agg(e.nombre');
  d:=replace(d,'estado_nuevo:=case when enviar then', 'estado_nuevo:=case when p.estado=''rechazado'' then ''rechazado'' when enviar then');
  execute d;
 end if;
end $migration$;
-- Permite corregir el contenido sin que los estudiantes anulen un rechazo docente.
create or replace function public.feria_proteger_rechazado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.estado='rechazado' and new.estado<>'rechazado' and not coalesce(public.es_profesor(),false) then
  raise exception 'Solo un docente puede volver a considerar un proyecto rechazado';
 end if;
 return new;
end $$;
revoke all on function public.feria_proteger_rechazado() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
