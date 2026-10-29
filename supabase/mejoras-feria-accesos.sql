-- Claudina App: ejecutar completo en Supabase > SQL Editor.
-- Requiere los módulos de feria y correcciones previamente instalados.
-- Conserva proyectos, contraseñas existentes y las suscripciones push.
begin;
create table if not exists public.feria_notificaciones_push(
 tipo text not null check(tipo in('correccion','revision')),
 solicitud uuid not null,docente_id uuid not null,
 creado_en timestamptz not null default now(),primary key(tipo,solicitud)
);
alter table public.feria_notificaciones_push enable row level security;
revoke all on public.feria_notificaciones_push from public,anon,authenticated;
grant select,insert on public.feria_notificaciones_push to service_role;
commit;


-- Ejecutar completo en Supabase SQL Editor. Conserva proyectos y permisos existentes.
begin;
alter table public.feria_proyectos add column if not exists poster_url text not null default '' check(length(poster_url)<=2000 and (poster_url='' or poster_url ~* '^https?://[^[:space:]]+$'));
-- Amplía la función instalada sin reemplazar las mejoras anteriores de equipos y revisión.
do $migration$
declare definicion text;
begin
 select pg_get_functiondef('public.feria_guardar(uuid,jsonb,integer,boolean,uuid)'::regprocedure) into definicion;
 if position('poster_url' in definicion)=0 then
  if position('update public.feria_proyectos set ' in definicion)=0 or position('apoyo,bibliografia,estado,ultimo_guardado)' in definicion)=0 or position('if datos-array[' in definicion)=0 then
   raise exception 'La función feria_guardar cambió. No se aplicaron cambios; revisa su definición antes de actualizar.';
  end if;
  definicion:=replace(definicion,'if datos-array[','if datos-array[''poster_url'',');
  definicion:=replace(definicion,'update public.feria_proyectos set ','update public.feria_proyectos set poster_url=case when datos?''poster_url'' then trim(datos->>''poster_url'') else poster_url end,');
  definicion:=replace(definicion,'apoyo,bibliografia,estado,ultimo_guardado)','apoyo,bibliografia,poster_url,estado,ultimo_guardado)');
  definicion:=replace(definicion,'coalesce(trim(datos->>''bibliografia''),''''),case when enviar','coalesce(trim(datos->>''bibliografia''),''''),coalesce(trim(datos->>''poster_url''),''''),case when enviar');
  definicion:=replace(definicion,'if datos?''bibliografia'' and',E'if datos?''poster_url'' and (jsonb_typeof(datos->''poster_url'') is distinct from ''string'' or length(datos->>''poster_url'')>2000 or (trim(datos->>''poster_url'')<>'''' and trim(datos->>''poster_url'')!~* ''^https?://[^[:space:]]+$'')) then raise exception ''Revisa el enlace al póster: usa http:// o https:// (máximo 2000 caracteres)'';end if;\n if datos?''bibliografia'' and');
  execute definicion;
 end if;
 -- Los proyectos externos almacenan los campos en JSON; conservar el enlace al normalizarlos.
 if to_regprocedure('public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid)') is not null then
  select pg_get_functiondef('public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid)'::regprocedure) into definicion;
  if position('poster_url' in definicion)=0 then
   if position('foreach campo in array array[' in definicion)=0 then raise exception 'Revisa la definición de feria_externa_guardar antes de actualizar';end if;
   definicion:=replace(definicion,'foreach campo in array array[','foreach campo in array array[''poster_url'',');
   definicion:=replace(definicion,'d:=d||jsonb_build_object(campo,trim(coalesce(datos->>campo,'''')));',E'if campo=''poster_url'' and (length(coalesce(datos->>campo,''''))>2000 or (trim(coalesce(datos->>campo,''''))<>'''' and trim(datos->>campo)!~* ''^https?://[^[:space:]]+$'')) then raise exception ''Revisa el enlace al póster: usa http:// o https:// (máximo 2000 caracteres)'';end if;\n  d:=d||jsonb_build_object(campo,trim(coalesce(datos->>campo,'''')));');
   execute definicion;
  end if;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;

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

-- Ejecutar completo después de documentos-estudiantes.sql.
-- Prepara únicamente cuentas de estudiantes activos cuyo correo y documento coincidan.
begin;
create table if not exists public.acudiente_intentos(llave text primary key,inicio timestamptz not null default now(),cantidad integer not null default 1);
alter table public.acudiente_intentos enable row level security;
revoke all on public.acudiente_intentos from public,anon,authenticated;
create or replace function public.acudiente_registrar_intento(clave text)
returns boolean language plpgsql security definer set search_path=public as $$
declare cantidad_actual integer;
begin
 delete from public.acudiente_intentos where inicio<now()-interval '1 day';
 insert into public.acudiente_intentos(llave) values(clave) on conflict(llave) do update
 set cantidad=case when acudiente_intentos.inicio<now()-interval '10 minutes' then 1 else acudiente_intentos.cantidad+1 end,
 inicio=case when acudiente_intentos.inicio<now()-interval '10 minutes' then now() else acudiente_intentos.inicio end returning cantidad into cantidad_actual;
 return cantidad_actual<=12;
end; $$;
revoke all on function public.acudiente_registrar_intento(text) from public,anon,authenticated;
grant execute on function public.acudiente_registrar_intento(text) to service_role;
create or replace function public.preparar_acceso_estudiante(correo text,documento_ingresado text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare ficha public.estudiantes;cuenta uuid;sin_password boolean;
begin
 select * into ficha from public.estudiantes where email=lower(trim(correo)) and activo and documento=documento_ingresado for update;
 if ficha.id is null then return null;end if;
 if to_regclass('public.invitaciones_profesor') is not null then
  if exists(select 1 from public.invitaciones_profesor i where lower(i.email)=ficha.email) then return null;end if;
 end if;
 select id,coalesce(encrypted_password,'')='' into cuenta,sin_password from auth.users where lower(email)=ficha.email;
 if cuenta is null then
  if ficha.auth_user_id is not null then return null;end if;
  return jsonb_build_object('email',ficha.email,'crear',true);
 end if;
 if ficha.auth_user_id is not null and ficha.auth_user_id<>cuenta then return null;end if;
 if exists(select 1 from public.perfiles where id=cuenta and rol::text<>'estudiante') then return null;end if;
 if to_regclass('public.acudientes') is not null then
  if exists(select 1 from public.acudientes where auth_user_id=cuenta) then return null;end if;
 end if;
 if exists(select 1 from public.estudiantes where auth_user_id=cuenta and id<>ficha.id) then return null;end if;
 update public.estudiantes set auth_user_id=cuenta where id=ficha.id;
 insert into public.perfiles(id,nombre,rol) values(cuenta,ficha.nombre,'estudiante') on conflict(id) do update set nombre=excluded.nombre where perfiles.rol='estudiante';
 return jsonb_build_object('email',ficha.email,'id',cuenta,'crear',false,'inicializar_password',sin_password);
end; $$;
revoke all on function public.preparar_acceso_estudiante(text,text) from public,anon,authenticated;
grant execute on function public.preparar_acceso_estudiante(text,text) to service_role;
commit;

notify pgrst,'reload schema';
