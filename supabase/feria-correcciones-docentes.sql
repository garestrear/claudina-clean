-- Ejecutar después de feria-familias-estados.sql y feria-poster.sql.
-- No modifica permisos de estudiantes ni decisiones docentes anteriores.
begin;
create table if not exists public.feria_correcciones_docentes(
 id uuid primary key default gen_random_uuid(),origen text not null check(origen in('claudina','invitados')),
 proyecto_id uuid not null,docente_id uuid not null,nombre_docente text not null,
 antes jsonb not null,despues jsonb not null,version_anterior integer not null,
 solicitud uuid not null unique,creado_en timestamptz not null default now()
);
create index if not exists feria_correcciones_proyecto on public.feria_correcciones_docentes(origen,proyecto_id,creado_en);
alter table public.feria_correcciones_docentes enable row level security;
revoke all on public.feria_correcciones_docentes from public,anon,authenticated;
create or replace function public.feria_correcciones_contexto(origen text,proyecto uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if origen='claudina' then perform public.feria_proyecto(proyecto);
 elsif origen='invitados' then perform public.feria_externa_proyecto(proyecto);
 else raise exception 'Origen no válido';end if;
 return coalesce((select jsonb_agg(to_jsonb(c)-'docente_id'-'solicitud' order by c.creado_en desc,c.id) from public.feria_correcciones_docentes c where c.origen=feria_correcciones_contexto.origen and c.proyecto_id=proyecto),'[]'::jsonb);
end $$;
revoke all on function public.feria_correcciones_contexto(text,uuid) from public,anon;
grant execute on function public.feria_correcciones_contexto(text,uuid) to authenticated;
create or replace function public.feria_corregir_proyecto(origen text,proyecto uuid,datos jsonb,version_esperada integer,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;e public.feria_proyectos_externos;previa public.feria_correcciones_docentes;
 anterior jsonb;d jsonb:='{}';antes jsonb:='{}';despues jsonb:='{}';campo text;valor text;limite integer;v integer;nombre text;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo los profesores pueden corregir textos de los proyectos';end if;
 if origen is null or origen not in('claudina','invitados') or proyecto is null or solicitud is null or version_esperada is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>85000 then raise exception 'Revisa los datos de la corrección';end if;
 if origen='claudina' then
  select * into p from public.feria_proyectos where id=proyecto for update;
  if p.id is null then raise exception 'Proyecto no disponible';end if;
  anterior:=to_jsonb(p);v:=p.version;
 else
  select * into e from public.feria_proyectos_externos where id=proyecto for update;
  if e.id is null then raise exception 'Proyecto no disponible';end if;
  anterior:=e.datos;v:=e.version;
 end if;
 select * into previa from public.feria_correcciones_docentes c where c.solicitud=feria_corregir_proyecto.solicitud;
 if previa.id is not null then
  if previa.docente_id<>auth.uid() or previa.origen<>origen or previa.proyecto_id<>proyecto then raise exception 'Solicitud de corrección no válida';end if;
  if origen='claudina' then return public.feria_proyecto(proyecto);else return public.feria_externa_proyecto(proyecto);end if;
 end if;
 if v<>version_esperada then raise exception 'El proyecto cambió. Vuelve a abrirlo desde la lista y revisa la versión actual antes de guardar';end if;
 for campo in select jsonb_object_keys(datos) loop
  if campo not in('titulo','propuesta','procedimiento','materiales','resultados_esperados','bibliografia','poster_url','apoyo') and not(origen='invitados' and campo='integrantes') then raise exception 'No se permite corregir el campo % desde este formulario',campo;end if;
  limite:=case when campo='titulo' then 150 when campo in('propuesta','procedimiento','bibliografia') then 4000 else 2000 end;
  if jsonb_typeof(datos->campo) is distinct from 'string' or length(datos->>campo)>limite then raise exception 'Revisa el texto y la longitud de %',campo;end if;
  valor:=trim(datos->>campo);
  -- Conserva la categoría de emprendimiento familiar al corregir su título.
  if origen='claudina' and campo='titulo' and p.titulo like '[Emprendimiento familiar] %' then
   if valor like '[Emprendimiento familiar] %' then valor:=substr(valor,27);end if;
   valor:='[Emprendimiento familiar] '||valor;
  elsif origen='claudina' and campo='titulo' and valor like '[Emprendimiento familiar] %' then raise exception 'La corrección no permite cambiar la categoría del proyecto';end if;
  if campo='titulo' and (length(valor)<3 or length(valor)>150 or (valor like '[Emprendimiento familiar] %' and length(trim(substr(valor,27)))<3)) then raise exception 'El título debe tener al menos tres caracteres y respetar su longitud máxima';end if;
  if campo='poster_url' and valor<>'' and valor!~* '^https?://[^[:space:]]+$' then raise exception 'El enlace del póster debe comenzar por http:// o https://';end if;
  if valor is distinct from coalesce(anterior->>campo,'') then
   d:=d||jsonb_build_object(campo,valor);antes:=antes||jsonb_build_object(campo,coalesce(anterior->>campo,''));despues:=despues||jsonb_build_object(campo,valor);
  end if;
 end loop;
 if d<>'{}'::jsonb then
  if origen='claudina' then
   update public.feria_proyectos set titulo=coalesce(d->>'titulo',p.titulo),propuesta=coalesce(d->>'propuesta',p.propuesta),procedimiento=coalesce(d->>'procedimiento',p.procedimiento),materiales=coalesce(d->>'materiales',p.materiales),resultados_esperados=coalesce(d->>'resultados_esperados',p.resultados_esperados),bibliografia=coalesce(d->>'bibliografia',p.bibliografia),poster_url=coalesce(d->>'poster_url',p.poster_url),apoyo=coalesce(d->>'apoyo',p.apoyo),version=p.version+1,revision_contenido=p.revision_contenido+1,actualizado_en=now() where id=proyecto;
  else
   update public.feria_proyectos_externos set datos=e.datos||d,version=e.version+1,actualizado_en=now() where id=proyecto;
  end if;
  select pf.nombre into nombre from public.perfiles pf where pf.id=auth.uid();
  insert into public.feria_correcciones_docentes(origen,proyecto_id,docente_id,nombre_docente,antes,despues,version_anterior,solicitud)
  values(origen,proyecto,auth.uid(),coalesce(nombre,'Docente'),antes,despues,v,solicitud);
 end if;
 if origen='claudina' then return public.feria_proyecto(proyecto);else return public.feria_externa_proyecto(proyecto);end if;
end $$;
revoke all on function public.feria_corregir_proyecto(text,uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.feria_corregir_proyecto(text,uuid,jsonb,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
