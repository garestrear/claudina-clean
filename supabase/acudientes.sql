-- Acceso de acudiente. Ejecutar completo DESPUÉS de documentos-estudiantes.sql.
-- Añadir el rol fuera de la transacción permite usarlo en el mismo script.
begin;
alter type public.rol_usuario add value if not exists 'acudiente';
commit;
begin;
create table if not exists public.acudientes(
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 estudiante_id uuid not null unique references public.estudiantes(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.acudientes enable row level security;
revoke all on public.acudientes from public,anon,authenticated;
grant all on public.acudientes to service_role;

create or replace function public.es_acudiente()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.acudientes where auth_user_id=auth.uid());
$$;
revoke all on function public.es_acudiente() from public,anon;
grant execute on function public.es_acudiente() to authenticated;

-- Exclusiva del servidor: una cuenta separada por estudiante, sin cambiar su Google.
create or replace function public.vincular_cuenta_acudiente(cuenta uuid,estudiante uuid)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare vinculada uuid;
begin
 perform 1 from public.estudiantes where id=estudiante and activo and documento is not null for update;
 if not found then raise exception 'Estudiante no disponible.';end if;
 if not exists(select 1 from auth.users where id=cuenta) then raise exception 'Cuenta no disponible.';end if;
 if exists(select 1 from public.perfiles where id=cuenta and rol='profesor') or exists(select 1 from public.estudiantes where auth_user_id=cuenta) then raise exception 'La cuenta ya tiene otra función.';end if;
 insert into public.acudientes(auth_user_id,estudiante_id) values(cuenta,estudiante) on conflict(estudiante_id) do nothing;
 select auth_user_id into vinculada from public.acudientes where estudiante_id=estudiante;
 insert into public.perfiles(id,nombre,rol) select vinculada,'Acudiente de '||nombre,'acudiente'::public.rol_usuario from public.estudiantes where id=estudiante
 on conflict(id) do update set nombre=excluded.nombre,rol=excluded.rol;
 return vinculada;
end;
$$;
revoke all on function public.vincular_cuenta_acudiente(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vincular_cuenta_acudiente(uuid,uuid) to service_role;

-- Control persistente de intentos. No almacena documentos, contraseñas ni IP.
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
end;
$$;
revoke all on function public.acudiente_registrar_intento(text) from public,anon,authenticated;
grant execute on function public.acudiente_registrar_intento(text) to service_role;

-- Las consultas escolares del acudiente pasan por funciones limitadas a su hijo.
-- Las políticas RESTRICTIVE impiden usar permisos estudiantiles antiguos por fuera de la vista.
do $$ declare tabla text;accion text;begin
 foreach tabla in array array['estudiantes','asignaciones','registros_aseo','participaciones','tareas','evidencias','valoraciones','reportes','avisos','mensajes_estudiantes','encuestas','encuesta_preguntas','encuesta_respuestas','grammy_votos','horario_base','horario_cambios'] loop
  if to_regclass('public.'||tabla) is not null then
   execute format('drop policy if exists acudiente_consulta_controlada on public.%I',tabla);
   execute format('create policy acudiente_consulta_controlada on public.%I as restrictive for all to authenticated using (not public.es_acudiente()) with check (not public.es_acudiente())',tabla);
  end if;
 end loop;
 foreach accion in array array['insert','update','delete'] loop
  execute format('drop policy if exists %I on public.perfiles','acudiente_perfil_'||accion);
  if accion='insert' then
   execute 'create policy acudiente_perfil_insert on public.perfiles as restrictive for insert to authenticated with check(not public.es_acudiente())';
  elsif accion='update' then
   execute 'create policy acudiente_perfil_update on public.perfiles as restrictive for update to authenticated using(not public.es_acudiente()) with check(not public.es_acudiente())';
  else
   execute 'create policy acudiente_perfil_delete on public.perfiles as restrictive for delete to authenticated using(not public.es_acudiente())';
  end if;
 end loop;
end $$;

create or replace function public.acudiente_puede_ver_foto(ruta text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.acudientes a join public.estudiantes s on s.id=a.estudiante_id
 join public.evidencias e on e.path=ruta
 where a.auth_user_id=auth.uid() and s.activo and (
  (e.registro_id is not null and e.reporte_id is null and exists(select 1 from public.participaciones p where p.registro_id=e.registro_id and p.estudiante_id=s.id)
    and (e.subido_por=s.auth_user_id or exists(select 1 from public.perfiles pr where pr.id=e.subido_por and pr.rol='profesor')))
  or exists(select 1 from public.reportes r where r.id=e.reporte_id and r.autor=s.auth_user_id)
 ));
$$;
revoke all on function public.acudiente_puede_ver_foto(text) from public,anon;
grant execute on function public.acudiente_puede_ver_foto(text) to authenticated;
drop policy if exists "acudiente consulta fotos de su hijo" on storage.objects;
create policy "acudiente consulta fotos de su hijo" on storage.objects for select to authenticated
 using(bucket_id='evidencias' and public.acudiente_puede_ver_foto(name));
-- Sin subidas ni cambios de archivos escolares desde una cuenta de acudiente.
drop policy if exists acudiente_storage_insert on storage.objects;
create policy acudiente_storage_insert on storage.objects as restrictive for insert to authenticated with check(not public.es_acudiente());
drop policy if exists acudiente_storage_update on storage.objects;
create policy acudiente_storage_update on storage.objects as restrictive for update to authenticated using(not public.es_acudiente()) with check(not public.es_acudiente());
drop policy if exists acudiente_storage_delete on storage.objects;
create policy acudiente_storage_delete on storage.objects as restrictive for delete to authenticated using(not public.es_acudiente());

create or replace function public.acudiente_contexto()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare hijo public.estudiantes;historial jsonb;avisos_hijo jsonb;mensajes jsonb;
begin
 select s.* into hijo from public.estudiantes s join public.acudientes a on a.estudiante_id=s.id where a.auth_user_id=auth.uid() and s.activo;
 if not found then raise exception 'No hay un estudiante activo vinculado a esta cuenta de acudiente.';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha desc),'[]'::jsonb) into historial from (
  select p.id,p.estudiante_id,p.registro_id,p.estado,p.calificacion,r.fecha,r.observaciones,jsonb_build_object('fecha',r.fecha) registros_aseo,
  coalesce((select jsonb_agg(jsonb_build_object('tipo',t.tipo,'detalle',t.detalle,'realizada',t.realizada)) from public.tareas t where t.participacion_id=p.id),'[]'::jsonb) tareas,
  coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'path',ev.path)) from public.evidencias ev where ev.registro_id=r.id and ev.reporte_id is null and public.acudiente_puede_ver_foto(ev.path)),'[]'::jsonb) evidencias
  from public.participaciones p join public.registros_aseo r on r.id=p.registro_id where p.estudiante_id=hijo.id
 )x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into avisos_hijo from (
  select id,tipo,titulo,contenido,grado,fecha_evento,created_at from public.avisos where publicado and (grado is null or grado=hijo.grado) order by created_at desc limit 40
 )x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into mensajes from (
  select id,titulo,contenido,created_at from public.mensajes_estudiantes where estado='aprobado' order by created_at desc limit 30
 )x;
 return jsonb_build_object('estudiante',jsonb_build_object('id',hijo.id,'nombre',hijo.nombre,'grado',hijo.grado,'email',hijo.email,'documento',hijo.documento),
  'turnos',coalesce((select jsonb_agg(dia order by dia) from public.asignaciones where estudiante_id=hijo.id),'[]'::jsonb),
  'participaciones',historial,'avisos',avisos_hijo,'mensajes',mensajes,
  'reportes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,tipo,descripcion,estado,created_at from public.reportes where autor=hijo.auth_user_id)x),'[]'::jsonb),
  'horario_base',coalesce((select jsonb_agg(to_jsonb(h)) from public.horario_base h where grupo=case when hijo.grado in(7,8) then '7-8' else hijo.grado::text end),'[]'::jsonb),
  'horario_cambios',coalesce((select jsonb_agg(to_jsonb(h)) from public.horario_cambios h where grupo=case when hijo.grado in(7,8) then '7-8' else hijo.grado::text end and fecha between timezone('America/Bogota',now())::date-7 and timezone('America/Bogota',now())::date+14),'[]'::jsonb));
end;
$$;
revoke all on function public.acudiente_contexto() from public,anon;
grant execute on function public.acudiente_contexto() to authenticated;

-- Solo encuestas cerradas con resultados publicados; nunca votos individuales.
create or replace function public.acudiente_encuestas()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare grado_hijo integer;resultado jsonb:='[]'::jsonb;grammy jsonb:=null;
begin
 select s.grado into grado_hijo from public.estudiantes s join public.acudientes a on a.estudiante_id=s.id where a.auth_user_id=auth.uid() and s.activo;
 if not found then raise exception 'Cuenta de acudiente sin estudiante activo.';end if;
 if to_regclass('public.encuestas') is not null then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into resultado from (
   select e.id,e.titulo,e.descripcion,e.created_at,
   coalesce((select jsonb_agg(to_jsonb(p) order by orden) from public.encuesta_preguntas p where encuesta_id=e.id),'[]'::jsonb) preguntas,
   coalesce((select jsonb_agg(to_jsonb(v) order by v.pregunta_id,v.votos desc,v.nombre) from (
    select r.pregunta_id,r.candidato_referencia candidato_id,min(r.nombre) nombre,min(r.grado) grado,count(*)::integer votos from public.encuesta_respuestas r where encuesta_id=e.id group by r.pregunta_id,r.candidato_referencia
   )v),'[]'::jsonb) conteo
   from public.encuestas e where e.estado='cerrada' and e.resultados_publicados and grado_hijo=any(e.grados_participantes)
  )x;
 end if;
 if grado_hijo in(6,7,8) and to_regclass('public.grammy_config') is not null then
  if exists(select 1 from public.grammy_config where id=1 and resultados_publicados and not abierto) then
   grammy:=jsonb_build_object('categorias',coalesce((select jsonb_agg(to_jsonb(c) order by orden) from public.grammy_categorias c where habilitada),'[]'::jsonb),'conteo',public.grammy_conteo());
  end if;
 end if;
 return jsonb_build_object('encuestas',resultado,'grammy',grammy);
end;
$$;
revoke all on function public.acudiente_encuestas() from public,anon;
grant execute on function public.acudiente_encuestas() to authenticated;
commit;
