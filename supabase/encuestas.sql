-- Encuestas Claudina: ejecutar completo en Supabase > SQL Editor.
-- Puede repetirse. No modifica ni elimina las tablas o votos de los Grammy.
begin;
create table if not exists public.encuestas (
 id uuid primary key default gen_random_uuid(),
 titulo text not null check(length(trim(titulo)) between 1 and 150),
 descripcion text not null default '' check(length(descripcion)<=1000),
 grados_participantes integer[] not null,
 grados_candidatos integer[] not null,
 estado text not null default 'borrador' check(estado in ('borrador','abierta','cerrada')),
 resultados_publicados boolean not null default false,
 creado_por uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 cerrada_at timestamptz,
 check(cardinality(grados_participantes)>0 and grados_participantes <@ array[1,2,3,4,5,6,7,8]),
 check(cardinality(grados_candidatos)>0 and grados_candidatos <@ array[1,2,3,4,5,6,7,8]),
 check(not resultados_publicados or estado='cerrada')
);
create table if not exists public.encuesta_preguntas (
 id uuid primary key default gen_random_uuid(),
 encuesta_id uuid not null references public.encuestas(id) on delete cascade,
 titulo text not null check(length(trim(titulo)) between 1 and 200),
 descripcion text not null default '' check(length(descripcion)<=500),
 orden integer not null,
 unique(encuesta_id,id)
);
create table if not exists public.encuesta_respuestas (
 autor uuid not null references auth.users(id) on delete cascade,
 encuesta_id uuid not null references public.encuestas(id) on delete cascade,
 pregunta_id uuid not null,
 candidato_id uuid references public.estudiantes(id) on delete set null,
 candidato_referencia uuid not null,
 nombre text not null,
 grado integer not null,
 updated_at timestamptz not null default now(),
 primary key(autor,pregunta_id),
 foreign key(encuesta_id,pregunta_id) references public.encuesta_preguntas(encuesta_id,id) on delete cascade
);
create index if not exists encuesta_respuestas_encuesta on public.encuesta_respuestas(encuesta_id);
alter table public.encuestas enable row level security;
alter table public.encuesta_preguntas enable row level security;
alter table public.encuesta_respuestas enable row level security;
revoke all on public.encuestas,public.encuesta_preguntas,public.encuesta_respuestas from anon,authenticated;

create or replace function public.encuesta_puede_ver(ficha public.encuestas)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (public.es_profesor() or
 (ficha.estado<>'borrador' and (
 exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo and grado=any(ficha.grados_participantes))
 or exists(select 1 from public.encuesta_respuestas where encuesta_id=ficha.id and autor=auth.uid())
 )));
$$;
revoke all on function public.encuesta_puede_ver(public.encuestas) from public,anon,authenticated;

create or replace function public.encuestas_listar()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Ingresa a tu cuenta para consultar las encuestas.';end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
 select e.*, (select count(*) from public.encuesta_preguntas where encuesta_id=e.id) preguntas,
 (select count(*) from public.encuesta_respuestas where encuesta_id=e.id and autor=auth.uid()) mis_respuestas,
 case when public.es_profesor() then (select count(distinct autor) from public.encuesta_respuestas where encuesta_id=e.id) else null end participantes
 from public.encuestas e where public.encuesta_puede_ver(e)
 )t),'[]'::jsonb);
end;
$$;

create or replace function public.encuesta_contexto(encuesta uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ficha public.encuestas; profesor boolean:=public.es_profesor();conteo jsonb;
begin
 select * into ficha from public.encuestas where id=encuesta;
 if not found or not public.encuesta_puede_ver(ficha) then raise exception 'Esta encuesta no está disponible para tu cuenta.';end if;
 if profesor or ficha.resultados_publicados then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.pregunta_id,t.votos desc,t.nombre),'[]'::jsonb) into conteo from (
   select r.pregunta_id,r.candidato_referencia candidato_id,min(r.nombre) nombre,min(r.grado) grado,count(*)::integer votos
   from public.encuesta_respuestas r where r.encuesta_id=encuesta group by r.pregunta_id,r.candidato_referencia
  )t;
 end if;
 return jsonb_build_object('profesor',profesor,'encuesta',to_jsonb(ficha),
 'puede_responder',ficha.estado='abierta' and exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo and grado=any(ficha.grados_participantes)),
 'editable',ficha.estado<>'abierta' and not exists(select 1 from public.encuesta_respuestas where encuesta_id=encuesta),
 'preguntas',coalesce((select jsonb_agg(to_jsonb(p) order by orden,id) from public.encuesta_preguntas p where encuesta_id=encuesta),'[]'::jsonb),
 'candidatos',case when ficha.estado='abierta' or profesor then coalesce((select jsonb_agg(to_jsonb(s) order by nombre) from (select id,nombre,grado from public.estudiantes where activo and grado=any(ficha.grados_candidatos))s),'[]'::jsonb) else '[]'::jsonb end,
 'mis_respuestas',coalesce((select jsonb_object_agg(pregunta_id::text,jsonb_build_object('candidato_id',candidato_referencia,'nombre',nombre,'grado',grado)) from public.encuesta_respuestas where encuesta_id=encuesta and autor=auth.uid()),'{}'::jsonb),
 'conteo',conteo,
 'participantes',case when profesor then (select count(distinct autor) from public.encuesta_respuestas where encuesta_id=encuesta) else null end);
end;
$$;

create or replace function public.encuesta_guardar(encuesta uuid,datos jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare ficha public.encuestas; identificador uuid; participantes integer[]; candidatos integer[];
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo un profesor puede crear o editar encuestas.';end if;
 participantes:=array(select distinct value::integer from jsonb_array_elements_text(datos->'grados_participantes'));
 candidatos:=array(select distinct value::integer from jsonb_array_elements_text(datos->'grados_candidatos'));
 if encuesta is null then
  insert into public.encuestas(titulo,descripcion,grados_participantes,grados_candidatos,creado_por)
  values(trim(datos->>'titulo'),coalesce(trim(datos->>'descripcion'),''),participantes,candidatos,auth.uid()) returning id into identificador;
 else
  select * into ficha from public.encuestas where id=encuesta for update;
  if not found then raise exception 'Encuesta no encontrada.';end if;
  if ficha.estado='abierta' or exists(select 1 from public.encuesta_respuestas where encuesta_id=encuesta) then
   raise exception 'Una encuesta con respuestas conserva sus preguntas y grados. Crea otra encuesta para cambiarla.';
  end if;
  update public.encuestas set titulo=trim(datos->>'titulo'),descripcion=coalesce(trim(datos->>'descripcion'),''),
   grados_participantes=participantes,grados_candidatos=candidatos where id=encuesta;
  identificador:=encuesta;
 end if;
 return identificador;
end;
$$;

create or replace function public.encuesta_pregunta_guardar(encuesta uuid,pregunta uuid,datos jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare ficha public.encuestas; identificador uuid;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo un profesor puede editar preguntas.';end if;
 select * into ficha from public.encuestas where id=encuesta for update;
 if not found then raise exception 'Encuesta no encontrada.';end if;
 if ficha.estado='abierta' or exists(select 1 from public.encuesta_respuestas where encuesta_id=encuesta) then raise exception 'Las preguntas se editan antes de recibir respuestas y con la encuesta cerrada.';end if;
 if pregunta is null then
  insert into public.encuesta_preguntas(encuesta_id,titulo,descripcion,orden)
  values(encuesta,trim(datos->>'titulo'),coalesce(trim(datos->>'descripcion'),''),coalesce((select max(orden)+1 from public.encuesta_preguntas where encuesta_id=encuesta),1)) returning id into identificador;
 else
  update public.encuesta_preguntas set titulo=trim(datos->>'titulo'),descripcion=coalesce(trim(datos->>'descripcion'),'') where id=pregunta and encuesta_id=encuesta returning id into identificador;
  if not found then raise exception 'Pregunta no encontrada.';end if;
 end if;
 return identificador;
end;
$$;

create or replace function public.encuesta_pregunta_eliminar(encuesta uuid,pregunta uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ficha public.encuestas;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo un profesor puede eliminar preguntas.';end if;
 select * into ficha from public.encuestas where id=encuesta for update;
 if not found then raise exception 'Encuesta no encontrada.';end if;
 if ficha.estado='abierta' or exists(select 1 from public.encuesta_respuestas where encuesta_id=encuesta) then raise exception 'Las preguntas se eliminan antes de recibir respuestas y con la encuesta cerrada.';end if;
 delete from public.encuesta_preguntas where encuesta_id=encuesta and id=pregunta;
 if not found then raise exception 'Pregunta no encontrada.';end if;
end;
$$;

create or replace function public.encuesta_administrar(encuesta uuid,accion text)
returns void language plpgsql security definer set search_path=public as $$
declare ficha public.encuestas;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo un profesor puede administrar encuestas.';end if;
 select * into ficha from public.encuestas where id=encuesta for update;
 if not found then raise exception 'Encuesta no encontrada.';end if;
 if accion='abrir' then
  if not exists(select 1 from public.encuesta_preguntas where encuesta_id=encuesta) then raise exception 'Agrega al menos una pregunta antes de abrir.';end if;
  if not exists(select 1 from public.estudiantes where activo and grado=any(ficha.grados_candidatos)) then raise exception 'No hay estudiantes activos en los grados de candidatos.';end if;
  update public.encuestas set estado='abierta',resultados_publicados=false,cerrada_at=null where id=encuesta;
 elsif accion='cerrar' then update public.encuestas set estado='cerrada',cerrada_at=now() where id=encuesta;
 elsif accion='publicar' then
  if ficha.estado<>'cerrada' then raise exception 'Cierra la encuesta antes de publicar los resultados.';end if;
  update public.encuestas set resultados_publicados=true where id=encuesta;
 elsif accion='ocultar' then update public.encuestas set resultados_publicados=false where id=encuesta;
 else raise exception 'Acción no válida.';
 end if;
end;
$$;

create or replace function public.encuesta_responder(encuesta uuid,elecciones jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare ficha public.encuestas; item record;
begin
 select * into ficha from public.encuestas where id=encuesta for share;
 if not found or ficha.estado<>'abierta' then raise exception 'La encuesta está cerrada. Tus respuestas no se modificaron.';end if;
 if auth.uid() is null or not exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo and grado=any(ficha.grados_participantes)) then raise exception 'Tu grado no participa en esta encuesta.';end if;
 if jsonb_typeof(elecciones) is distinct from 'object' then raise exception 'Formato de respuestas inválido.';end if;
 for item in select * from jsonb_each_text(elecciones) loop
  if not exists(select 1 from public.encuesta_preguntas where id=item.key::uuid and encuesta_id=encuesta) then raise exception 'Pregunta no disponible.';end if;
  if coalesce(item.value,'')<>'' and not exists(select 1 from public.estudiantes where id=item.value::uuid and activo and grado=any(ficha.grados_candidatos)) then raise exception 'Selecciona un estudiante activo de los grados autorizados.';end if;
 end loop;
 delete from public.encuesta_respuestas where encuesta_id=encuesta and autor=auth.uid();
 insert into public.encuesta_respuestas(autor,encuesta_id,pregunta_id,candidato_id,candidato_referencia,nombre,grado)
 select auth.uid(),encuesta,x.key::uuid,s.id,s.id,s.nombre,s.grado from jsonb_each_text(elecciones)x
 join public.estudiantes s on s.id=nullif(x.value,'')::uuid;
end;
$$;

revoke all on function public.encuestas_listar() from public,anon;
revoke all on function public.encuesta_contexto(uuid) from public,anon;
revoke all on function public.encuesta_guardar(uuid,jsonb) from public,anon;
revoke all on function public.encuesta_pregunta_guardar(uuid,uuid,jsonb) from public,anon;
revoke all on function public.encuesta_pregunta_eliminar(uuid,uuid) from public,anon;
revoke all on function public.encuesta_administrar(uuid,text) from public,anon;
revoke all on function public.encuesta_responder(uuid,jsonb) from public,anon;
grant execute on function public.encuestas_listar(),public.encuesta_contexto(uuid),public.encuesta_guardar(uuid,jsonb),public.encuesta_pregunta_guardar(uuid,uuid,jsonb),public.encuesta_pregunta_eliminar(uuid,uuid),public.encuesta_administrar(uuid,text),public.encuesta_responder(uuid,jsonb) to authenticated;
commit;
