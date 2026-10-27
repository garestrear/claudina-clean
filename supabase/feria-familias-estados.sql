-- Actualización completa: cuarta categoría FAM azul y cambios de estado docentes.
-- Ejecutar completo; incluye la actualización de placas y conserva números generales.
-- Placas de mesa Feria STEAM 2026. Ejecutar completo; no borra proyectos.
begin;
create table if not exists public.feria_placa_contadores(
 clave text primary key check(clave in('general','stem','arte','emprendimiento','familias')),
 ultimo integer not null default 0 check(ultimo>=0)
);
alter table public.feria_placa_contadores drop constraint if exists feria_placa_contadores_clave_check;
alter table public.feria_placa_contadores add constraint feria_placa_contadores_clave_check check(clave in('general','stem','arte','emprendimiento','familias'));
insert into public.feria_placa_contadores(clave) values('general'),('stem'),('arte'),('emprendimiento'),('familias') on conflict do nothing;
create table if not exists public.feria_placas(
 origen text not null check(origen in('claudina','invitados')),
 proyecto_id uuid not null,
 categoria text not null check(categoria in('stem','arte','emprendimiento','familias')),
 numero_general integer not null unique check(numero_general>0),
 numero_categoria integer not null check(numero_categoria>0),
 creado_en timestamptz not null default now(),
 primary key(origen,proyecto_id),unique(categoria,numero_categoria)
);
alter table public.feria_placas drop constraint if exists feria_placas_categoria_check;
alter table public.feria_placas add constraint feria_placas_categoria_check check(categoria in('stem','arte','emprendimiento','familias'));
alter table public.feria_placas enable row level security;
alter table public.feria_placa_contadores enable row level security;
revoke all on public.feria_placas,public.feria_placa_contadores from public,anon,authenticated;
create or replace function public.feria_asignar_placa(fuente text,proyecto uuid,areas text[],titulo text)
returns void language plpgsql security definer set search_path='' as $$
declare categoria_nueva text;general_nuevo integer;categoria_numero integer;
begin
 -- Un bloqueo común serializa contadores internos y externos, incluida la reclasificación.
 perform pg_advisory_xact_lock(20261106,2026);
 if exists(select 1 from public.feria_placas p where p.origen=fuente and p.proyecto_id=proyecto) then return;end if;
 categoria_nueva:=case when titulo like '[Emprendimiento familiar] %' then 'familias' when 'emprendimiento'=any(areas) then 'emprendimiento' when 'arts'=any(areas) then 'arte' else 'stem' end;
 update public.feria_placa_contadores set ultimo=ultimo+1 where clave='general' returning ultimo into general_nuevo;
 update public.feria_placa_contadores set ultimo=ultimo+1 where clave=categoria_nueva returning ultimo into categoria_numero;
 insert into public.feria_placas(origen,proyecto_id,categoria,numero_general,numero_categoria) values(fuente,proyecto,categoria_nueva,general_nuevo,categoria_numero);
end $$;
revoke all on function public.feria_asignar_placa(text,uuid,text[],text) from public,anon,authenticated;
create or replace function public.feria_generar_placa_aprobada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado='aprobado' then
  if tg_table_name='feria_proyectos' then
   perform public.feria_asignar_placa('claudina',new.id,new.areas,new.titulo);
  else
   perform public.feria_asignar_placa('invitados',new.id,array(select jsonb_array_elements_text(new.datos->'areas')),new.datos->>'titulo');
  end if;
 end if;
 return new;
end $$;
revoke all on function public.feria_generar_placa_aprobada() from public,anon,authenticated;
drop trigger if exists feria_generar_placa on public.feria_proyectos;
create trigger feria_generar_placa after insert or update of estado on public.feria_proyectos for each row execute function public.feria_generar_placa_aprobada();
drop trigger if exists feria_generar_placa on public.feria_proyectos_externos;
create trigger feria_generar_placa after insert or update of estado on public.feria_proyectos_externos for each row execute function public.feria_generar_placa_aprobada();
-- Recupera aprobados anteriores en un orden determinista; ejecutar de nuevo no renumera.
do $$declare r record;begin
 perform pg_advisory_xact_lock(20261106,2026);
 for r in select * from (
  select 'claudina'::text origen,p.id,p.areas,p.titulo,p.creado_en from public.feria_proyectos p where p.estado='aprobado'
  union all
  select 'invitados',p.id,array(select jsonb_array_elements_text(p.datos->'areas')),p.datos->>'titulo',p.creado_en from public.feria_proyectos_externos p where p.estado='aprobado'
 ) q order by creado_en,origen,id loop
  perform public.feria_asignar_placa(r.origen,r.id,r.areas,r.titulo);
 end loop;
end $$;
-- Reclasifica emprendimientos familiares ya numerados sin cambiar el número general.
do $$declare r record;n integer;begin
 perform pg_advisory_xact_lock(20261106,2026);
 for r in select pl.origen,pl.proyecto_id from public.feria_placas pl
 where pl.categoria<>'familias' and (
 (pl.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=pl.proyecto_id and p.titulo like '[Emprendimiento familiar] %')) or
 (pl.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=pl.proyecto_id and p.datos->>'titulo' like '[Emprendimiento familiar] %')))
 order by pl.numero_general loop
  update public.feria_placa_contadores set ultimo=ultimo+1 where clave='familias' returning ultimo into n;
  update public.feria_placas set categoria='familias',numero_categoria=n where origen=r.origen and proyecto_id=r.proyecto_id;
 end loop;
end $$;
create or replace function public.feria_placas_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid;externo boolean;salida jsonb;resumen jsonb;
begin
 ficha:=(public.feria_ficha_actual()).id;
 externo:=coalesce(public.feria_externo_autorizado(),false);
 if auth.uid() is null or not(docente or ficha is not null or externo) then raise exception 'Ingresa con una cuenta autorizada para consultar las placas';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.numero_general),'[]'::jsonb) into salida from (
  select pl.origen,pl.proyecto_id,pl.categoria,pl.numero_general,pl.numero_categoria,
   case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0') codigo,
   case when p.titulo like '[Emprendimiento familiar] %' then substr(p.titulo,27) else p.titulo end titulo,
   case when p.titulo like '[Emprendimiento familiar] %' and length(trim(p.materiales))>0 then p.materiales else p.integrantes end integrantes,
   p.grado::text grado,'C.E.R. Claudina Múnera'::text institucion
  from public.feria_placas pl join public.feria_proyectos p on pl.origen='claudina' and p.id=pl.proyecto_id
  where p.estado='aprobado' and (docente or p.estudiante_id=ficha or ficha=any(p.integrantes_ids))
  union all
  select pl.origen,pl.proyecto_id,pl.categoria,pl.numero_general,pl.numero_categoria,
   case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0'),
   p.datos->>'titulo',p.datos->>'integrantes',null::text,p.datos->>'institucion'
  from public.feria_placas pl join public.feria_proyectos_externos p on pl.origen='invitados' and p.id=pl.proyecto_id
  where p.estado='aprobado' and (docente or (externo and p.autor=auth.uid()))
 ) q;
 select jsonb_build_object(
  'registrados',(select count(*) from public.feria_proyectos where estado<>'borrador')+(select count(*) from public.feria_proyectos_externos where estado<>'borrador'),
  'aprobados',count(*),'stem',count(*) filter(where categoria='stem'),'arte',count(*) filter(where categoria='arte'),'emprendimiento',count(*) filter(where categoria='emprendimiento'),'familias',count(*) filter(where categoria='familias')
 ) into resumen from public.feria_placas pl where
  (pl.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=pl.proyecto_id and p.estado='aprobado')) or
  (pl.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=pl.proyecto_id and p.estado='aprobado'));
 return jsonb_build_object('resumen',resumen,'placas',salida,'docente',docente);
end $$;
revoke all on function public.feria_placas_contexto() from public,anon;
grant execute on function public.feria_placas_contexto() to authenticated;
create or replace function public.feria_placa_cambiar_categoria(fuente text,proyecto uuid,categoria_nueva text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actual public.feria_placas;numero integer;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo un docente puede definir la categoría principal de la placa';end if;
 if fuente not in('claudina','invitados') or categoria_nueva not in('stem','arte','emprendimiento','familias') or categoria_nueva is null then raise exception 'Categoría no válida';end if;
 -- Mismo orden de bloqueo que aprobación: primero proyecto, después contadores.
 if fuente='claudina' then
  perform 1 from public.feria_proyectos where id=proyecto and estado='aprobado' for update;
 else
  perform 1 from public.feria_proyectos_externos where id=proyecto and estado='aprobado' for update;
 end if;
 if not found then raise exception 'Solo se puede clasificar un proyecto aprobado';end if;
 perform pg_advisory_xact_lock(20261106,2026);
 select * into actual from public.feria_placas where origen=fuente and proyecto_id=proyecto for update;
 if actual.proyecto_id is null then raise exception 'Actualiza las placas antes de cambiar la categoría';end if;
 if actual.categoria<>categoria_nueva then
  update public.feria_placa_contadores set ultimo=ultimo+1 where clave=categoria_nueva returning ultimo into numero;
  update public.feria_placas set categoria=categoria_nueva,numero_categoria=numero where origen=fuente and proyecto_id=proyecto;
 end if;
 return public.feria_placas_contexto();
end $$;
revoke all on function public.feria_placa_cambiar_categoria(text,uuid,text) from public,anon;
grant execute on function public.feria_placa_cambiar_categoria(text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

-- Permite al docente elegir cualquier estado y conserva el historial/versionado.
begin;
alter table public.feria_revisiones drop constraint if exists feria_revisiones_estado_check;
alter table public.feria_revisiones add constraint feria_revisiones_estado_check check(estado in('borrador','enviado','ajustes','aprobado','rechazado'));
alter table public.feria_revisiones_externas drop constraint if exists feria_revisiones_externas_decision_check;
alter table public.feria_revisiones_externas add constraint feria_revisiones_externas_decision_check check(decision in('borrador','enviado','ajustes','aprobado','rechazado'));
-- La decisión docente no depende de si el estudiante completó el formulario.
-- Se conserva la validación del formulario de inscripción al enviarlo.
do $$declare r record;begin
 for r in select conname from pg_constraint where conrelid='public.feria_proyectos'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%estado%' and pg_get_constraintdef(oid) like '%procedimiento%' loop
  execute format('alter table public.feria_proyectos drop constraint %I',r.conname);
 end loop;
end $$;
-- Los docentes también pueden acceder a los borradores para cambiar su estado.
do $$declare firma text;definicion text;begin
 foreach firma in array array['public.feria_contexto()','public.feria_proyecto(uuid)','public.feria_externa_contexto()','public.feria_externa_proyecto(uuid)'] loop
  definicion:=pg_get_functiondef(firma::regprocedure);
  definicion:=replace(definicion,'docente and p.estado<>''borrador''','docente');
  definicion:=replace(definicion,'public.es_profesor() and p.estado<>''borrador''','public.es_profesor()');
  execute definicion;
 end loop;
end $$;
create or replace function public.feria_revisar(proyecto uuid,version_esperada integer,decision text,comentario text,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;nombre text;previa public.feria_revisiones;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Cualquier docente puede revisar; ingresa con cuenta docente';end if;
 if solicitud is null or decision is null or decision not in('borrador','enviado','ajustes','aprobado','rechazado') or comentario is null or length(comentario)>4000 or(decision in('ajustes','rechazado') and length(trim(comentario))=0) then raise exception 'Escribe las observaciones o el motivo del rechazo';end if;
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is null then raise exception 'Este proyecto aún no está disponible para revisión';end if;
 select * into previa from public.feria_revisiones r where r.solicitud=feria_revisar.solicitud;
 if previa.id is not null then
  if previa.proyecto_id<>p.id or previa.revisor<>auth.uid() then raise exception 'Solicitud inválida';end if;
  return public.feria_proyecto(p.id);
 end if;
 if version_esperada is distinct from p.version then raise exception 'El proyecto cambió. Actualiza y revisa la versión más reciente';end if;
 select pf.nombre into nombre from public.perfiles pf where pf.id=auth.uid();
 insert into public.feria_revisiones(proyecto_id,revisor,nombre_revisor,revision_contenido,estado,observacion,solicitud)
 values(p.id,auth.uid(),coalesce(nombre,'Docente'),p.revision_contenido,decision,trim(comentario),solicitud);
 update public.feria_proyectos set estado=decision,version=p.version+1,actualizado_en=now() where id=p.id;
 return public.feria_proyecto(p.id);
end;
$$;

create or replace function public.feria_externa_revisar(proyecto uuid,version_esperada integer,decision text,comentario text,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos_externos;r public.feria_revisiones_externas;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes de Claudina';end if;
 select * into p from public.feria_proyectos_externos where id=proyecto for update;
 if p.id is null then raise exception 'Proyecto no disponible';end if;
 select * into r from public.feria_revisiones_externas where feria_revisiones_externas.solicitud=feria_externa_revisar.solicitud;
 if r.id is not null then
  if r.proyecto_id=proyecto and r.autor=auth.uid() then return public.feria_externa_proyecto(proyecto);end if;
  raise exception 'Solicitud ya utilizada';
 end if;
 if p.version is distinct from version_esperada then raise exception 'El proyecto cambió. Actualiza y revisa la versión más reciente';end if;
 if decision is null or decision not in('borrador','enviado','ajustes','aprobado','rechazado') or solicitud is null or length(coalesce(comentario,''))>4000 or(decision in('ajustes','rechazado') and length(trim(coalesce(comentario,'')))=0) then raise exception 'Revisa la decisión y las observaciones';end if;
 insert into public.feria_revisiones_externas(proyecto_id,autor,decision,comentario,version_revisada,solicitud) values(proyecto,auth.uid(),decision,trim(coalesce(comentario,'')),p.version,solicitud);
 update public.feria_proyectos_externos f set estado=decision,version=f.version+1,actualizado_en=now() where id=proyecto;
 return public.feria_externa_proyecto(proyecto);
end $$;

revoke all on function public.feria_revisar(uuid,integer,text,text,uuid),public.feria_externa_revisar(uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.feria_revisar(uuid,integer,text,text,uuid),public.feria_externa_revisar(uuid,integer,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
