-- Ejecutar después de feria-familias-estados.sql. Conserva proyectos, placas y revisiones.
begin;
create table if not exists public.feria_participantes(
 id uuid primary key default gen_random_uuid(),folio bigint generated always as identity unique,
 tipo text not null check(tipo in('expositor','evaluador','logistica','ponente','asistente')),
 nombre text not null check(length(trim(nombre)) between 2 and 150),
 institucion text not null default 'C.E.R. Claudina Múnera' check(length(institucion)<=150),
 estudiante_id uuid references public.estudiantes(id) on delete set null,grado text not null default '' check(length(grado)<=40),
 proyecto_origen text check(proyecto_origen in('claudina','invitados')),proyecto_id uuid,
 detalle text not null default '' check(length(detalle)<=300),
 automatico boolean not null default false,activo boolean not null default true,
 creado_por uuid,creado_en timestamptz not null default now(),actualizado_en timestamptz not null default now(),
 check((proyecto_id is null)=(proyecto_origen is null))
);
create unique index if not exists feria_expositor_estudiante_unico on public.feria_participantes(estudiante_id,proyecto_origen,proyecto_id) where tipo='expositor' and estudiante_id is not null and proyecto_id is not null;
create table if not exists public.feria_certificados(
 id uuid primary key default gen_random_uuid(),folio bigint generated always as identity unique,
 participante_id uuid not null references public.feria_participantes(id),
 contenido jsonb not null,emitido_por uuid not null,emitido_en timestamptz not null default now(),
 anulado_en timestamptz,motivo_anulacion text not null default '' check(length(motivo_anulacion)<=1000)
);
create unique index if not exists feria_certificado_vigente_unico on public.feria_certificados(participante_id) where anulado_en is null;
alter table public.feria_participantes enable row level security;
alter table public.feria_certificados enable row level security;
revoke all on public.feria_participantes,public.feria_certificados from public,anon,authenticated;
revoke all on sequence public.feria_participantes_folio_seq,public.feria_certificados_folio_seq from public,anon,authenticated;
create or replace function public.feria_sincronizar_expositores(proyecto uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;r record;
begin
 select * into p from public.feria_proyectos where id=proyecto;
 if p.id is null or p.estado<>'aprobado' then return;end if;
 for r in select e.id,e.nombre,e.grado from public.estudiantes e where e.activo and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) loop
  insert into public.feria_participantes(tipo,nombre,estudiante_id,grado,proyecto_origen,proyecto_id,automatico)
  values('expositor',r.nombre,r.id,case when r.grado=0 then 'TS y JR' else r.grado||'°' end,'claudina',p.id,true)
  on conflict(estudiante_id,proyecto_origen,proyecto_id) where tipo='expositor' and estudiante_id is not null and proyecto_id is not null
  do nothing;
 end loop;
end $$;
revoke all on function public.feria_sincronizar_expositores(uuid) from public,anon,authenticated;
create or replace function public.feria_participantes_al_aprobar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado='aprobado' then perform public.feria_sincronizar_expositores(new.id);end if;return new;
end $$;
revoke all on function public.feria_participantes_al_aprobar() from public,anon,authenticated;
drop trigger if exists feria_participantes_al_aprobar on public.feria_proyectos;
create trigger feria_participantes_al_aprobar after insert or update of estado,integrantes_ids on public.feria_proyectos for each row execute function public.feria_participantes_al_aprobar();
do $$declare r record;begin
 for r in select id from public.feria_proyectos where estado='aprobado' order by creado_en,id loop perform public.feria_sincronizar_expositores(r.id);end loop;
end $$;
-- Datos de la credencial: autorización se verifica en los RPC que la utilizan.
create or replace function public.feria_participante_datos(persona uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.feria_participantes;i public.feria_proyectos;e public.feria_proyectos_externos;pl public.feria_placas;habilitado boolean;titulo text:='';institucion_actual text;nombre_actual text;grado_actual text;
begin
 select * into p from public.feria_participantes where id=persona;if p.id is null then return null;end if;
 habilitado:=p.activo;institucion_actual:=p.institucion;nombre_actual:=p.nombre;grado_actual:=p.grado;
 if p.estudiante_id is not null then
  select nombre,case when grado=0 then 'TS y JR' else grado||'°' end into nombre_actual,grado_actual from public.estudiantes where id=p.estudiante_id and activo;
  habilitado:=habilitado and nombre_actual is not null;
 end if;
 if p.proyecto_id is not null then
  if p.proyecto_origen='claudina' then
   select * into i from public.feria_proyectos where id=p.proyecto_id;
   habilitado:=habilitado and i.id is not null and i.estado='aprobado';
   if p.automatico then habilitado:=habilitado and(p.estudiante_id=i.estudiante_id or p.estudiante_id=any(i.integrantes_ids));end if;
   titulo:=case when i.titulo like '[Emprendimiento familiar] %' then substr(i.titulo,27) else i.titulo end;
  else
   select * into e from public.feria_proyectos_externos where id=p.proyecto_id;
   habilitado:=habilitado and e.id is not null and e.estado='aprobado';titulo:=e.datos->>'titulo';
  end if;
  select * into pl from public.feria_placas where origen=p.proyecto_origen and proyecto_id=p.proyecto_id;
 elsif p.tipo='expositor' then habilitado:=false;
 end if;
 return (to_jsonb(p)-'creado_por')||jsonb_build_object('nombre',coalesce(nombre_actual,p.nombre),'grado',coalesce(grado_actual,p.grado),'habilitado',coalesce(habilitado,false),'proyecto_titulo',coalesce(titulo,''),'categoria',pl.categoria,
 'proyecto_codigo',case when pl.proyecto_id is null then '' else case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0') end,'numero_general',pl.numero_general);
end $$;
revoke all on function public.feria_participante_datos(uuid) from public,anon,authenticated;
create or replace function public.feria_participantes_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid;personas jsonb;
begin
 ficha:=(public.feria_ficha_actual()).id;
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como docente, estudiante activo o su acudiente vinculado';end if;
 select coalesce(jsonb_agg(public.feria_participante_datos(p.id)||jsonb_build_object('certificado',(select to_jsonb(c)-'emitido_por' from public.feria_certificados c where c.participante_id=p.id and c.anulado_en is null)) order by p.folio),'[]'::jsonb) into personas
 from public.feria_participantes p where docente or p.estudiante_id=ficha;
 return jsonb_build_object('docente',docente,'participantes',personas,
 'estudiantes',case when docente then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre) from public.estudiantes e where e.activo),'[]'::jsonb) else '[]'::jsonb end,
 'proyectos',case when docente then public.feria_placas_contexto()->'placas' else '[]'::jsonb end,
 'jurados',case when docente then coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'nombre',j.nombre,'institucion',j.institucion,'profesion',j.profesion) order by j.nombre) from public.feria_jurados j),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.feria_participantes_contexto() from public,anon;
grant execute on function public.feria_participantes_contexto() to authenticated;
create or replace function public.feria_participante_guardar(persona uuid,datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare anterior public.feria_participantes;estudiante public.estudiantes;vinculo uuid;origen text;proyecto uuid;tipo text;nombre text;institucion text;grado text;detalle text;activo boolean;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden registrar participantes';end if;
 if persona is null or jsonb_typeof(datos) is distinct from 'object' then raise exception 'Datos no válidos';end if;
 tipo:=datos->>'tipo';nombre:=trim(coalesce(datos->>'nombre',''));institucion:=trim(coalesce(datos->>'institucion',''));grado:=trim(coalesce(datos->>'grado',''));detalle:=trim(coalesce(datos->>'detalle',''));activo:=coalesce((datos->>'activo')::boolean,true);
 if tipo is null or tipo not in('expositor','evaluador','logistica','ponente','asistente') or length(nombre) not between 2 and 150 or length(institucion)>150 or length(grado)>40 or length(detalle)>300 then raise exception 'Revisa el tipo, nombre y longitudes de los campos';end if;
 vinculo:=nullif(datos->>'estudiante_id','')::uuid;origen:=nullif(datos->>'proyecto_origen','');proyecto:=nullif(datos->>'proyecto_id','')::uuid;
 if vinculo is not null then
  select * into estudiante from public.estudiantes e where e.id=vinculo and e.activo;
  if estudiante.id is null then raise exception 'Selecciona un estudiante activo';end if;
  nombre:=estudiante.nombre;grado:=case when estudiante.grado=0 then 'TS y JR' else estudiante.grado||'°' end;institucion:='C.E.R. Claudina Múnera';
 end if;
 if tipo='expositor' and proyecto is null then raise exception 'Vincula al expositor con un proyecto aprobado';end if;
 if proyecto is not null then
  if origen='claudina' then perform 1 from public.feria_proyectos where id=proyecto and estado='aprobado';
  elsif origen='invitados' then perform 1 from public.feria_proyectos_externos where id=proyecto and estado='aprobado';else raise exception 'Origen de proyecto no válido';end if;
  if not found then raise exception 'Selecciona un proyecto aprobado';end if;
 elsif origen is not null then raise exception 'Selecciona el proyecto asociado';end if;
 select * into anterior from public.feria_participantes where id=persona for update;
 if anterior.id is not null then
  if anterior.automatico and (tipo<>anterior.tipo or vinculo is distinct from anterior.estudiante_id or proyecto is distinct from anterior.proyecto_id or origen is distinct from anterior.proyecto_origen) then raise exception 'La vinculación del expositor automático se administra desde su proyecto';end if;
  if exists(select 1 from public.feria_certificados where participante_id=persona and anulado_en is null) and (tipo<>anterior.tipo or vinculo is distinct from anterior.estudiante_id or nombre<>anterior.nombre or institucion<>anterior.institucion or grado<>anterior.grado or detalle<>anterior.detalle or proyecto is distinct from anterior.proyecto_id or origen is distinct from anterior.proyecto_origen) then raise exception 'Anula el certificado vigente antes de corregir los datos certificados';end if;
  update public.feria_participantes set tipo=feria_participante_guardar.tipo,nombre=feria_participante_guardar.nombre,institucion=feria_participante_guardar.institucion,estudiante_id=vinculo,grado=feria_participante_guardar.grado,detalle=feria_participante_guardar.detalle,proyecto_origen=origen,proyecto_id=proyecto,activo=feria_participante_guardar.activo,actualizado_en=now() where id=persona;
 else
  insert into public.feria_participantes(id,tipo,nombre,institucion,estudiante_id,grado,detalle,proyecto_origen,proyecto_id,activo,creado_por) values(persona,tipo,nombre,institucion,vinculo,grado,detalle,origen,proyecto,activo,auth.uid());
 end if;
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_participante_guardar(uuid,jsonb) from public,anon;
grant execute on function public.feria_participante_guardar(uuid,jsonb) to authenticated;
create or replace function public.feria_certificado_emitir(persona uuid,confirmar boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_participantes;datos jsonb;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden confirmar participación y emitir certificados';end if;
 if confirmar is distinct from true then raise exception 'Confirma que la persona participó en la feria en la función indicada';end if;
 select * into p from public.feria_participantes where id=persona for update;
 if p.id is null then raise exception 'Participante no disponible';end if;
 if exists(select 1 from public.feria_certificados where participante_id=persona and anulado_en is null) then return public.feria_participantes_contexto();end if;
 datos:=public.feria_participante_datos(persona);
 if datos->'habilitado' is distinct from 'true'::jsonb then raise exception 'El participante debe estar activo y su proyecto, si corresponde, aprobado';end if;
 insert into public.feria_certificados(participante_id,contenido,emitido_por)
 values(persona,datos||jsonb_build_object('evento','Feria STEAM 2026','fecha_evento','6 de noviembre de 2026','lugar','Caldas, Antioquia','firmante','GUSTAVO ADOLFO RESTREPO ARBOLEDA','cargo','Docente líder PRAE - Organizador Feria STEAM'),auth.uid());
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_certificado_emitir(uuid,boolean) from public,anon;
grant execute on function public.feria_certificado_emitir(uuid,boolean) to authenticated;
create or replace function public.feria_certificado_anular(certificado uuid,motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare persona uuid;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden anular certificados';end if;
 if length(trim(coalesce(motivo,''))) not between 3 and 1000 then raise exception 'Escribe un motivo de anulación entre 3 y 1000 caracteres';end if;
 select participante_id into persona from public.feria_certificados where id=certificado;
 if persona is null then raise exception 'Certificado no disponible';end if;
 perform 1 from public.feria_participantes where id=persona for update;
 update public.feria_certificados set anulado_en=coalesce(anulado_en,now()),motivo_anulacion=case when anulado_en is null then trim(motivo) else motivo_anulacion end where id=certificado;
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_certificado_anular(uuid,text) from public,anon;
grant execute on function public.feria_certificado_anular(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
