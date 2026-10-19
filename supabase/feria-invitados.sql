-- Feria STEAM: instituciones invitadas. Ejecutar completo; conserva proyectos.
begin;
create table if not exists public.feria_proyectos_externos(
 id uuid primary key,autor uuid not null references auth.users(id),datos jsonb not null,
 estado text not null default 'borrador' check(estado in('borrador','enviado','ajustes','aprobado')),
 version integer not null default 1,ultima_solicitud uuid not null,
 creado_en timestamptz not null default now(),actualizado_en timestamptz not null default now()
);
create table if not exists public.feria_revisiones_externas(
 id uuid primary key default gen_random_uuid(),proyecto_id uuid not null references public.feria_proyectos_externos(id) on delete cascade,
 autor uuid not null references public.perfiles(id),decision text not null check(decision in('ajustes','aprobado')),
 comentario text not null,version_revisada integer not null,solicitud uuid not null unique,creado_en timestamptz not null default now()
);
alter table public.feria_proyectos_externos enable row level security;
alter table public.feria_revisiones_externas enable row level security;
revoke all on public.feria_proyectos_externos,public.feria_revisiones_externas from public,anon,authenticated;
-- Las cuentas externas no reciben perfil institucional. Las políticas restrictivas
-- impiden aprovechar lecturas antiguas abiertas a cualquier sesión autenticada.
create or replace function public.es_miembro_claudina()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 exists(select 1 from public.perfiles p where p.id=auth.uid() and p.rol='profesor') or
 exists(select 1 from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo) or
 exists(select 1 from public.acudientes a join public.estudiantes e on e.id=a.estudiante_id where a.auth_user_id=auth.uid() and e.activo));
$$;
revoke all on function public.es_miembro_claudina() from public,anon;
grant execute on function public.es_miembro_claudina() to authenticated;
do $$declare r record;begin
 for r in select n.nspname esquema,c.relname tabla from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or (n.nspname='storage' and c.relname='objects')) loop
  execute format('drop policy if exists acceso_institucional on %I.%I',r.esquema,r.tabla);
  execute format('create policy acceso_institucional on %I.%I as restrictive for all to authenticated using(public.es_miembro_claudina()) with check(public.es_miembro_claudina())',r.esquema,r.tabla);
 end loop;
end $$;
create or replace function public.feria_externo_autorizado()
returns boolean language sql stable security definer set search_path='' as $$
 select not public.es_miembro_claudina() and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.email is not null);
$$;
revoke all on function public.feria_externo_autorizado() from public,anon,authenticated;
create or replace function public.feria_externa_contexto()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) and not public.feria_externo_autorizado() then raise exception 'Ingresa con el correo verificado del participante invitado';end if;
 return coalesce((select jsonb_agg(to_jsonb(p)-'ultima_solicitud'-'autor' order by p.actualizado_en desc) from public.feria_proyectos_externos p
 where p.autor=auth.uid() or (public.es_profesor() and p.estado<>'borrador')),'[]'::jsonb);
end $$;
create or replace function public.feria_externa_proyecto(proyecto uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos_externos;historial jsonb;
begin
 select * into p from public.feria_proyectos_externos where id=proyecto;
 if p.id is null or not coalesce((public.feria_externo_autorizado() and p.autor=auth.uid()) or(public.es_profesor() and p.estado<>'borrador'),false) then raise exception 'Proyecto no disponible';end if;
 select coalesce(jsonb_agg(jsonb_build_object('decision',r.decision,'comentario',r.comentario,'version_revisada',r.version_revisada,'creado_en',r.creado_en,'docente',pf.nombre) order by r.creado_en desc),'[]'::jsonb) into historial
 from public.feria_revisiones_externas r join public.perfiles pf on pf.id=r.autor where r.proyecto_id=proyecto;
 return jsonb_build_object('proyecto',to_jsonb(p)-'autor'-'ultima_solicitud','revisiones',historial);
end $$;
create or replace function public.feria_externa_guardar(proyecto uuid,datos jsonb,version_esperada integer,enviar boolean,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos_externos;d jsonb:='{}'::jsonb;campo text;limite int;correo text;
begin
 if not public.feria_externo_autorizado() then raise exception 'Usa un correo verificado de una persona de otra institución';end if;
 if proyecto is null or solicitud is null or enviar is null or version_esperada is null then raise exception 'Solicitud incompleta';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into p from public.feria_proyectos_externos where id=proyecto for update;
 if p.id is not null and p.autor<>auth.uid() then raise exception 'Proyecto no disponible';end if;
 if p.id is not null and p.ultima_solicitud=solicitud then return public.feria_externa_proyecto(proyecto);end if;
 if (p.id is null and version_esperada<>0) or(p.id is not null and p.version<>version_esperada) then raise exception 'El proyecto cambió. Actualiza la lista antes de guardar';end if;
 if enviar and (p.id is null or p.estado='borrador') and now()>=timestamptz '2026-10-31 00:00:00 America/Bogota' then raise exception 'La recepción de nuevas propuestas cerró el 30 de octubre de 2026 a las 11:59 p. m. (Colombia). Contacta al comité científico';end if;
 if p.id is null and(select count(*) from public.feria_proyectos_externos where autor=auth.uid())>=20 then raise exception 'Límite de 20 proyectos por cuenta';end if;
 foreach campo in array array['institucion','municipio','responsable','telefono','titulo','integrantes','propuesta','procedimiento','materiales','resultados_esperados','bibliografia','apoyo','logistica'] loop
  limite:=case when campo in('institucion','municipio','responsable','titulo') then 150 when campo='telefono' then 50 when campo in('integrantes','materiales','resultados_esperados','apoyo','logistica') then 2000 else 4000 end;
  if datos?campo and jsonb_typeof(datos->campo)<>'string' then raise exception 'Texto inválido en %',campo;end if;
  if length(coalesce(datos->>campo,''))>limite then raise exception 'Texto demasiado largo en %',campo;end if;
  d:=d||jsonb_build_object(campo,trim(coalesce(datos->>campo,'')));
 end loop;
 if length(d->>'titulo')<3 or length(d->>'institucion')<3 or length(d->>'responsable')<3 or length(d->>'municipio')<2 then raise exception 'Completa institución, municipio, persona responsable y título';end if;
 if jsonb_typeof(datos->'areas') is distinct from 'array' then raise exception 'Selecciona las áreas STEAM';end if;
 if jsonb_array_length(datos->'areas') not between 1 and 5 or exists(select 1 from jsonb_array_elements(datos->'areas') a where jsonb_typeof(a)<>'string' or (a#>>'{}') not in('science','technology','engineering','arts','mathematics')) or (select count(distinct a) from jsonb_array_elements(datos->'areas') a)<>jsonb_array_length(datos->'areas') then raise exception 'Áreas STEAM inválidas';end if;
 if enviar and (length(d->>'integrantes')=0 or length(d->>'propuesta')=0 or length(d->>'procedimiento')=0) then raise exception 'Completa integrantes, propuesta y procedimiento antes de enviar';end if;
 if datos->'acepta' is distinct from 'true'::jsonb then raise exception 'Confirma la autorización institucional para registrar el equipo';end if;
 select u.email into correo from auth.users u where u.id=auth.uid();
 d:=d||jsonb_build_object('areas',datos->'areas','correo',correo,'acepta',true,'publicar',coalesce(datos->'publicar'='true'::jsonb,false));
 if p.id is null then
  insert into public.feria_proyectos_externos(id,autor,datos,estado,ultima_solicitud) values(proyecto,auth.uid(),d,case when enviar then 'enviado' else 'borrador' end,solicitud);
 else
  update public.feria_proyectos_externos f set datos=d,estado=case when enviar then 'enviado' when p.estado='borrador' then 'borrador' else 'ajustes' end,version=f.version+1,ultima_solicitud=solicitud,actualizado_en=now() where id=proyecto;
 end if;
 return public.feria_externa_proyecto(proyecto);
end $$;
create or replace function public.feria_externa_revisar(proyecto uuid,version_esperada integer,decision text,comentario text,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos_externos;r public.feria_revisiones_externas;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes de Claudina';end if;
 select * into p from public.feria_proyectos_externos where id=proyecto for update;
 if p.id is null or p.estado='borrador' then raise exception 'Proyecto no disponible';end if;
 select * into r from public.feria_revisiones_externas where feria_revisiones_externas.solicitud=feria_externa_revisar.solicitud;
 if r.id is not null then
  if r.proyecto_id=proyecto and r.autor=auth.uid() then return public.feria_externa_proyecto(proyecto);end if;
  raise exception 'Solicitud ya utilizada';
 end if;
 if p.version is distinct from version_esperada or p.estado<>'enviado' then raise exception 'El proyecto cambió o no está enviado para revisión';end if;
 if decision is null or decision not in('ajustes','aprobado') or solicitud is null or length(coalesce(comentario,''))>4000 or(decision='ajustes' and length(trim(coalesce(comentario,'')))=0) then raise exception 'Revisa la decisión y las observaciones';end if;
 insert into public.feria_revisiones_externas(proyecto_id,autor,decision,comentario,version_revisada,solicitud) values(proyecto,auth.uid(),decision,trim(coalesce(comentario,'')),p.version,solicitud);
 update public.feria_proyectos_externos f set estado=decision,version=f.version+1,actualizado_en=now() where id=proyecto;
 return public.feria_externa_proyecto(proyecto);
end $$;
revoke all on function public.feria_externa_contexto(),public.feria_externa_proyecto(uuid),public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid),public.feria_externa_revisar(uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.feria_externa_contexto(),public.feria_externa_proyecto(uuid),public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid),public.feria_externa_revisar(uuid,integer,text,text,uuid) to authenticated;
create or replace function public.feria_invitacion_habilitada() returns boolean language sql stable set search_path='' as $$select true$$;
revoke all on function public.feria_invitacion_habilitada() from public;
grant execute on function public.feria_invitacion_habilitada() to anon,authenticated;
-- Solo datos de difusión de proyectos aprobados con autorización explícita.
create or replace function public.feria_proyectos_publicos()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'titulo',p.datos->>'titulo','institucion',p.datos->>'institucion','areas',p.datos->'areas') order by p.actualizado_en desc),'[]'::jsonb)
 from public.feria_proyectos_externos p where p.estado='aprobado' and p.datos->'publicar'='true'::jsonb;
$$;
revoke all on function public.feria_proyectos_publicos() from public;
grant execute on function public.feria_proyectos_publicos() to anon,authenticated;
commit;
