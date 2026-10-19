-- Actualización acumulativa de Feria: equipos con estudiantes de varios grados.
-- También incluye áreas STEAM, asesor e integrantes. Ejecutar completo; repetible.
begin;
-- Los proyectos anteriores se conservan sin asignarles un área arbitraria.
alter table public.feria_proyectos add column if not exists areas text[] not null default '{}'::text[];
do $$begin
 if not exists(select 1 from pg_constraint where conname='feria_areas_validas' and conrelid='public.feria_proyectos'::regclass) then
  alter table public.feria_proyectos add constraint feria_areas_validas check(cardinality(areas)<=5 and array_position(areas,null) is null and areas<@array['science','technology','engineering','arts','mathematics']::text[]);
 end if;
end;$$;
alter table public.feria_proyectos add column if not exists asesor_id uuid references public.perfiles(id) on delete set null;
alter table public.feria_proyectos add column if not exists integrantes_ids uuid[] not null default '{}'::uuid[];


create or replace function public.feria_estudiantes_grado(grado_elegido integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(coalesce(public.es_profesor(),false) or public.feria_estudiante_activo()) then raise exception 'Ingresa como docente o estudiante con ficha activa';end if;
 if grado_elegido is null or grado_elegido not between 0 and 8 then raise exception 'Selecciona un grado válido';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.activo and e.grado=grado_elegido),'[]'::jsonb);
end;
$$;

create or replace function public.feria_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha jsonb;
begin
 if auth.uid() is null or not(docente or public.feria_estudiante_activo()) then raise exception 'Ingresa como docente o estudiante con ficha activa';end if;
 if not docente then select jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) into ficha from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo limit 1;end if;
 return jsonb_build_object('profesor',docente,'ficha',ficha,'companeros',case when docente then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.activo and e.id<>(ficha->>'id')::uuid and (e.grado=(ficha->>'grado')::integer or(e.grado in(7,8) and (ficha->>'grado')::integer in(7,8)))),'[]'::jsonb) end,'docentes',coalesce((select jsonb_agg(jsonb_build_object('id',pf.id,'nombre',pf.nombre) order by pf.nombre,pf.id) from public.perfiles pf where pf.rol='profesor'),'[]'::jsonb),'proyectos',coalesce((select jsonb_agg(x.dato order by x.actualizado_en desc,x.id) from(
  select p.id,p.actualizado_en,jsonb_build_object('id',p.id,'titulo',p.titulo,'integrantes',p.integrantes,'areas',p.areas,'asesor_id',p.asesor_id,'asesor_nombre',(select pf.nombre from public.perfiles pf where pf.id=p.asesor_id),'grado',p.grado,'estado',p.estado,'version',p.version,'actualizado_en',p.actualizado_en,'registrado_por',e.nombre) dato
  from public.feria_proyectos p join public.estudiantes e on e.id=p.estudiante_id
  where (docente and p.estado<>'borrador') or p.autor=auth.uid()
 ) x),'[]'::jsonb));
end;
$$;

create or replace function public.feria_proyecto(proyecto uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.feria_proyectos;docente boolean:=coalesce(public.es_profesor(),false);
begin
 if auth.uid() is null or not(docente or public.feria_estudiante_activo()) then raise exception 'Inicia sesión con una cuenta autorizada';end if;
 select * into p from public.feria_proyectos where id=proyecto;
 if p.id is null or not((docente and p.estado<>'borrador') or p.autor=auth.uid()) then raise exception 'Proyecto no disponible';end if;
 return jsonb_build_object('proyecto',to_jsonb(p)-'autor'-'ultimo_guardado'-'estudiante_id','asesor_nombre',(select pf.nombre from public.perfiles pf where pf.id=p.asesor_id),'registrado_por',(select e.nombre from public.estudiantes e where e.id=p.estudiante_id),
 'integrantes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado,'activo',e.activo) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb),
 'revisiones',coalesce((select jsonb_agg(to_jsonb(r)-'revisor'-'solicitud' order by r.creado_en desc,r.id) from public.feria_revisiones r where r.proyecto_id=p.id),'[]'::jsonb));
end;
$$;

create or replace function public.feria_guardar(proyecto uuid,datos jsonb,version_esperada integer,enviar boolean,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;ficha public.estudiantes;campo text;limite integer;estado_nuevo text;areas_elegidas text[];asesor_elegido uuid;equipo uuid[];nombres_equipo text;
begin
 if not public.feria_estudiante_activo() then raise exception 'Solo estudiantes con ficha activa pueden registrar proyectos';end if;
 if proyecto is null or solicitud is null or enviar is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>85000 then raise exception 'Revisa los datos del proyecto';end if;
 if datos-array['titulo','integrantes','propuesta','procedimiento','materiales','resultados_esperados','apoyo','areas','asesor_id','integrantes_ids']<>'{}'::jsonb then raise exception 'Los campos del proyecto no son válidos';end if;
 select * into ficha from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo limit 1;
 if jsonb_typeof(datos->'integrantes_ids') is distinct from 'array' then raise exception 'Actualiza la app y escoge los integrantes de la lista de compañeros';end if;
 if jsonb_array_length(datos->'integrantes_ids')>100 or exists(select 1 from jsonb_array_elements(datos->'integrantes_ids') a where jsonb_typeof(a) is distinct from 'string' or (a#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Selecciona integrantes válidos de la lista';end if;
 select coalesce(array_agg(a::uuid),'{}'::uuid[]) into equipo from jsonb_array_elements_text(datos->'integrantes_ids') a;
 if cardinality(equipo)<>(select count(distinct x) from unnest(equipo) x) then raise exception 'No repitas integrantes';end if;
 if exists(select 1 from unnest(equipo) x where not exists(select 1 from public.estudiantes e where e.id=x and e.activo)) then raise exception 'Solo puedes escoger estudiantes activos de la institución';end if;
 if not(ficha.id=any(equipo)) then equipo:=array_prepend(ficha.id,equipo);end if;
 select string_agg(e.nombre||' · '||case when e.grado=0 then 'TS y JR' else e.grado||'°' end,E'\n' order by (e.id=ficha.id) desc,e.nombre,e.id) into nombres_equipo from public.estudiantes e where e.id=any(equipo);
 datos:=jsonb_set(datos,'{integrantes}',to_jsonb(nombres_equipo));
 if jsonb_typeof(datos->'asesor_id') is distinct from 'string' or coalesce(datos->>'asesor_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Escoge un profesor asesor de la lista';end if;
 asesor_elegido:=(datos->>'asesor_id')::uuid;
 if not exists(select 1 from public.perfiles pf where pf.id=asesor_elegido and pf.rol='profesor') then raise exception 'El asesor seleccionado no está disponible en la lista de profesores';end if;
 if jsonb_typeof(datos->'areas') is distinct from 'array' then raise exception 'Selecciona una o varias áreas STEAM';end if;
 if exists(select 1 from jsonb_array_elements(datos->'areas') a where jsonb_typeof(a) is distinct from 'string') then raise exception 'Selecciona áreas STEAM válidas';end if;
 select array_agg(a) into areas_elegidas from jsonb_array_elements_text(datos->'areas') a;
 if coalesce(cardinality(areas_elegidas),0) not between 1 and 5 or not(areas_elegidas<@array['science','technology','engineering','arts','mathematics']::text[]) or cardinality(areas_elegidas)<>(select count(distinct a) from unnest(areas_elegidas) a) then raise exception 'Selecciona una o varias áreas STEAM válidas, sin repetir';end if;
 foreach campo in array array['titulo','integrantes','propuesta','procedimiento','materiales','resultados_esperados','apoyo'] loop
  limite:=case when campo='titulo' then 150 when campo in('propuesta','procedimiento') then 4000 else 2000 end;
  if jsonb_typeof(datos->campo) is distinct from 'string' or length(datos->>campo)>limite then raise exception 'Revisa el campo % y su longitud',campo;end if;
 end loop;
 if length(trim(datos->>'titulo'))<3 then raise exception 'Escribe un nombre de proyecto de al menos 3 caracteres';end if;
 if enviar and (length(trim(datos->>'integrantes'))=0 or length(trim(datos->>'propuesta'))=0 or length(trim(datos->>'procedimiento'))=0) then raise exception 'Completa integrantes, qué harán y cómo lo harán antes de enviar';end if;
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is not null then
  if p.autor<>auth.uid() then raise exception 'Solo la cuenta que registró el proyecto puede modificarlo';end if;
  if p.ultimo_guardado=solicitud then return public.feria_proyecto(p.id);end if;
  if version_esperada is distinct from p.version then raise exception 'El proyecto cambió. Vuelve a abrirlo antes de guardar para no sobrescribir cambios';end if;
  estado_nuevo:=case when enviar then 'enviado' when p.estado='borrador' then 'borrador' else 'ajustes' end;
  update public.feria_proyectos set integrantes_ids=equipo,areas=areas_elegidas,asesor_id=asesor_elegido,titulo=trim(datos->>'titulo'),integrantes=trim(datos->>'integrantes'),propuesta=trim(datos->>'propuesta'),procedimiento=trim(datos->>'procedimiento'),materiales=trim(datos->>'materiales'),resultados_esperados=trim(datos->>'resultados_esperados'),apoyo=trim(datos->>'apoyo'),estado=estado_nuevo,version=p.version+1,revision_contenido=p.revision_contenido+1,ultimo_guardado=solicitud,actualizado_en=now() where id=p.id;
 else
  if version_esperada is distinct from 0 then raise exception 'Proyecto no disponible';end if;
  insert into public.feria_proyectos(id,autor,estudiante_id,grado,integrantes_ids,areas,asesor_id,titulo,integrantes,propuesta,procedimiento,materiales,resultados_esperados,apoyo,estado,ultimo_guardado)
  values(proyecto,auth.uid(),ficha.id,ficha.grado,equipo,areas_elegidas,asesor_elegido,trim(datos->>'titulo'),trim(datos->>'integrantes'),trim(datos->>'propuesta'),trim(datos->>'procedimiento'),trim(datos->>'materiales'),trim(datos->>'resultados_esperados'),trim(datos->>'apoyo'),case when enviar then 'enviado' else 'borrador' end,solicitud);
 end if;
 return public.feria_proyecto(proyecto);
end;
$$;
revoke all on function public.feria_estudiantes_grado(integer),public.feria_contexto(),public.feria_proyecto(uuid),public.feria_guardar(uuid,jsonb,integer,boolean,uuid) from public,anon;
grant execute on function public.feria_estudiantes_grado(integer),public.feria_contexto(),public.feria_proyecto(uuid),public.feria_guardar(uuid,jsonb,integer,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
