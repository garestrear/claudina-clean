-- Ejecutar en Supabase SQL Editor sobre la instalación actual de Feria STEAM.
-- Comparte la consulta del mismo proyecto con sus integrantes y acudientes.
-- Conserva inscripciones, revisiones y permisos de edición del responsable.
begin;
create or replace function public.feria_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha jsonb;
begin
 if auth.uid() is null or not(docente or (public.feria_ficha_actual()).id is not null) then raise exception 'Ingresa como docente, estudiante activo o su acudiente vinculado';end if;
 if not docente then select jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) into ficha from public.feria_ficha_actual() e;end if;
 return jsonb_build_object('profesor',docente,'ficha',ficha,'companeros',case when docente then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.activo and e.id<>(ficha->>'id')::uuid and (e.grado=(ficha->>'grado')::integer or(e.grado in(7,8) and (ficha->>'grado')::integer in(7,8)))),'[]'::jsonb) end,'docentes',coalesce((select jsonb_agg(jsonb_build_object('id',pf.id,'nombre',pf.nombre) order by pf.nombre,pf.id) from public.perfiles pf where pf.rol='profesor'),'[]'::jsonb),'proyectos',coalesce((select jsonb_agg(x.dato order by x.actualizado_en desc,x.id) from(
  select p.id,p.actualizado_en,jsonb_build_object('id',p.id,'titulo',p.titulo,'integrantes',p.integrantes,'areas',p.areas,'asesor_id',p.asesor_id,'asesor_nombre',(select pf.nombre from public.perfiles pf where pf.id=p.asesor_id),'grado',p.grado,'estado',p.estado,'version',p.version,'actualizado_en',p.actualizado_en,'registrado_por',e.nombre) dato
  from public.feria_proyectos p join public.estudiantes e on e.id=p.estudiante_id
  where (docente and p.estado<>'borrador') or p.estudiante_id=(public.feria_ficha_actual()).id or (public.feria_ficha_actual()).id=any(p.integrantes_ids)
 ) x),'[]'::jsonb));
end;
$$;
create or replace function public.feria_proyecto(proyecto uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.feria_proyectos;docente boolean:=coalesce(public.es_profesor(),false);
begin
 if auth.uid() is null or not(docente or (public.feria_ficha_actual()).id is not null) then raise exception 'Inicia sesión con una cuenta autorizada';end if;
 select * into p from public.feria_proyectos where id=proyecto;
 if p.id is null or not coalesce((docente and p.estado<>'borrador') or p.estudiante_id=(public.feria_ficha_actual()).id or (public.feria_ficha_actual()).id=any(p.integrantes_ids),false) then raise exception 'Proyecto no disponible';end if;
 return jsonb_build_object('puede_editar',coalesce(p.estudiante_id=(public.feria_ficha_actual()).id,false),'proyecto',to_jsonb(p)-'autor'-'ultimo_guardado'-'estudiante_id','asesor_nombre',(select pf.nombre from public.perfiles pf where pf.id=p.asesor_id),'registrado_por',(select e.nombre from public.estudiantes e where e.id=p.estudiante_id),
 'integrantes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado,'activo',e.activo) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb),
 'revisiones',coalesce((select jsonb_agg(to_jsonb(r)-'revisor'-'solicitud' order by r.creado_en desc,r.id) from public.feria_revisiones r where r.proyecto_id=p.id),'[]'::jsonb));
end;
$$;
revoke all on function public.feria_contexto(),public.feria_proyecto(uuid) from public,anon;
grant execute on function public.feria_contexto(),public.feria_proyecto(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
