-- Ejecutar completo en Supabase SQL Editor después de acudientes.sql. Repetible.
begin;
create table if not exists public.convivencia_permisos (
 estudiante_id uuid primary key references public.estudiantes(id) on delete cascade,
 habilitado_por uuid not null references auth.users(id), creado_en timestamptz not null default now()
);
create table if not exists public.convivencia_casos (
 id uuid primary key default gen_random_uuid(),
 estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
 autor uuid not null references auth.users(id),
 categoria text not null check(categoria in ('Llegada tarde o no ingreso','Interrupciones reiteradas','Vocabulario ofensivo','No participación en la actividad','Trato irrespetuoso','Otra situación')),
 materia text not null check(length(trim(materia)) between 1 and 100),
 ocurrido_en timestamptz not null,
 descripcion_original text not null check(length(trim(descripcion_original)) between 1 and 1500),
 descripcion_visible text check(length(trim(descripcion_visible)) between 1 and 1500),
 estado text not null default 'pendiente' check(estado in ('pendiente','aclaracion','seguimiento','cerrado','descartado')),
 publicado_en timestamptz, revisado_por uuid references auth.users(id),
 observacion text not null default '' check(length(observacion)<=1500),
 respuesta_tipo text check(respuesta_tipo in ('aclarar','reconocer')),
 respuesta text not null default '' check(length(respuesta)<=1500),
 compromiso text not null default '' check(length(compromiso)<=1000), respondido_en timestamptz,
 leido_en timestamptz, acompanamiento text not null default '' check(length(acompanamiento)<=1000),
 creado_en timestamptz not null default now(),
 check(respuesta_tipo is distinct from 'reconocer' or length(trim(compromiso))>0)
);
create index if not exists convivencia_casos_estudiante on public.convivencia_casos(estudiante_id,creado_en desc);
alter table public.convivencia_permisos enable row level security;
alter table public.convivencia_casos enable row level security;
revoke all on public.convivencia_permisos,public.convivencia_casos from public,anon,authenticated;

create or replace function public.convivencia_contexto() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ficha public.estudiantes; docente boolean:=coalesce(public.es_profesor(),false);
begin
 select * into ficha from estudiantes where auth_user_id=auth.uid() and activo;
 return jsonb_build_object('habilitado',docente or exists(select 1 from convivencia_permisos where estudiante_id=ficha.id),
 'estudiantes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado,'habilitado',exists(select 1 from convivencia_permisos p where p.estudiante_id=e.id)) order by e.grado,e.nombre)
 from estudiantes e where e.activo and (docente or (exists(select 1 from convivencia_permisos where estudiante_id=ficha.id) and e.id<>ficha.id and (e.grado=ficha.grado or (e.grado in(7,8) and ficha.grado in(7,8)))))),'[]'::jsonb));
end; $$;
create or replace function public.convivencia_habilitar(ficha uuid, habilitar boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden habilitar estudiantes.';end if;
 if habilitar is null then raise exception 'Selecciona el permiso.';end if;
 if habilitar then
  if not exists(select 1 from estudiantes where id=ficha and activo) then raise exception 'Estudiante no disponible.';end if;
  insert into convivencia_permisos(estudiante_id,habilitado_por) values(ficha,auth.uid()) on conflict(estudiante_id) do nothing;
 else delete from convivencia_permisos where estudiante_id=ficha;end if;
end; $$;
create or replace function public.convivencia_reportar(involucrados uuid[],categoria text,materia text,ocurrido timestamptz,descripcion text) returns void language plpgsql security definer set search_path=public as $$
declare ficha public.estudiantes;destino uuid;
begin
 select * into ficha from estudiantes where auth_user_id=auth.uid() and activo;
 if ficha.id is null or not exists(select 1 from convivencia_permisos where estudiante_id=ficha.id) then raise exception 'El docente debe habilitarte para reportar.';end if;
 if coalesce(cardinality(involucrados),0) not between 1 and 20 or ocurrido is null or ocurrido>now() then raise exception 'Revisa estudiantes y fecha; no puede ser futura.';end if;
 foreach destino in array involucrados loop
  if destino=ficha.id or not exists(select 1 from estudiantes e where e.id=destino and e.activo and (e.grado=ficha.grado or (e.grado in(7,8) and ficha.grado in(7,8)))) then raise exception 'Selecciona compañeros activos de tu grupo.';end if;
 end loop;
 for destino in select distinct unnest(involucrados) loop
  insert into convivencia_casos(estudiante_id,autor,categoria,materia,ocurrido_en,descripcion_original) values(destino,auth.uid(),categoria,trim(materia),ocurrido,trim(descripcion));
 end loop;
end; $$;
create or replace function public.convivencia_listar() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(x.dato order by x.creado_en desc),'[]'::jsonb) from (
 select c.creado_en,case when public.es_profesor() then to_jsonb(c)||jsonb_build_object('nombre',e.nombre,'grado',e.grado,'reportado_por',coalesce(p.nombre,'Estudiante'))
 else (to_jsonb(c)-'autor'-'descripcion_original'-'revisado_por'-case when e.auth_user_id=auth.uid() then 'acompanamiento' else '__ninguno__' end)||jsonb_build_object('nombre',e.nombre,'grado',e.grado) end dato
 from convivencia_casos c join estudiantes e on e.id=c.estudiante_id left join perfiles p on p.id=c.autor
 where public.es_profesor() or (e.activo and c.publicado_en is not null and (e.auth_user_id=auth.uid() or exists(select 1 from acudientes a where a.auth_user_id=auth.uid() and a.estudiante_id=e.id)))
 ) x;
$$;
create or replace function public.convivencia_revisar(caso uuid,nuevo_estado text,descripcion text,nota text) returns void language plpgsql security definer set search_path=public as $$
declare c public.convivencia_casos;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden revisar.';end if;
 select * into c from convivencia_casos where id=caso for update;
 if c.id is null or nuevo_estado is null or nuevo_estado not in ('aclaracion','seguimiento','cerrado','descartado') then raise exception 'Revisa el caso y el estado.';end if;
 if c.publicado_en is not null and descripcion is distinct from c.descripcion_visible then raise exception 'El texto publicado se conserva; agrega correcciones en la observación.';end if;
 if descripcion is null or length(trim(descripcion)) not between 1 and 1500 or nota is null or length(nota)>1500 then raise exception 'Revisa descripción y observación.';end if;
 update convivencia_casos set estado=nuevo_estado,descripcion_visible=trim(descripcion),observacion=trim(nota),revisado_por=auth.uid(),
 publicado_en=case when nuevo_estado='descartado' then publicado_en else coalesce(publicado_en,now()) end where id=caso;
end; $$;
create or replace function public.convivencia_responder(caso uuid,tipo text,explicacion text,acuerdo text) returns void language plpgsql security definer set search_path=public as $$
declare c public.convivencia_casos;
begin
 select * into c from convivencia_casos where id=caso for update;
 if c.id is null or c.publicado_en is null or c.estado not in ('aclaracion','seguimiento') or c.respondido_en is not null or not exists(select 1 from estudiantes where id=c.estudiante_id and auth_user_id=auth.uid() and activo) then raise exception 'Este caso no está disponible para responder.';end if;
 if tipo is null or tipo not in ('aclarar','reconocer') or explicacion is null or acuerdo is null or length(explicacion)>1500 or length(acuerdo)>1000 or (tipo='aclarar' and length(trim(explicacion))=0) or (tipo='reconocer' and length(trim(acuerdo))=0) then raise exception 'Escribe tu explicación o un compromiso concreto.';end if;
 update convivencia_casos set respuesta_tipo=tipo,respuesta=trim(explicacion),compromiso=trim(acuerdo),respondido_en=now() where id=caso;
end; $$;
create or replace function public.convivencia_acompanar(caso uuid,comentario text) returns void language plpgsql security definer set search_path=public as $$
begin
 if comentario is null or length(comentario)>1000 then raise exception 'Máximo 1000 caracteres.';end if;
 update convivencia_casos c set leido_en=coalesce(leido_en,now()),acompanamiento=trim(comentario)
 where c.id=caso and c.publicado_en is not null and exists(select 1 from acudientes a join estudiantes e on e.id=a.estudiante_id where a.auth_user_id=auth.uid() and e.id=c.estudiante_id and e.activo);
 if not found then raise exception 'Caso no disponible para este acudiente.';end if;
end; $$;
revoke all on function public.convivencia_contexto(),public.convivencia_habilitar(uuid,boolean),public.convivencia_reportar(uuid[],text,text,timestamptz,text),public.convivencia_listar(),public.convivencia_revisar(uuid,text,text,text),public.convivencia_responder(uuid,text,text,text),public.convivencia_acompanar(uuid,text) from public,anon;
grant execute on function public.convivencia_contexto(),public.convivencia_habilitar(uuid,boolean),public.convivencia_reportar(uuid[],text,text,timestamptz,text),public.convivencia_listar(),public.convivencia_revisar(uuid,text,text,text),public.convivencia_responder(uuid,text,text,text),public.convivencia_acompanar(uuid,text) to authenticated;
commit;
