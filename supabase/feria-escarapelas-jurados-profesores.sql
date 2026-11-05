-- Ejecutar después de feria-ubicacion-credenciales.sql y feria-participantes-certificados.sql.
begin;
create or replace function public.feria_sincronizar_expositores(proyecto uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;r record;
begin
 select * into p from public.feria_proyectos where id=proyecto;
 if p.id is null then return;end if;
 if p.titulo like '[Emprendimiento familiar] %' then
  update public.feria_participantes set activo=false,actualizado_en=now()
  where automatico and activo and tipo='expositor' and proyecto_origen='claudina' and proyecto_id=p.id;
  return;
 end if;
 if p.estado<>'aprobado' then return;end if;
 for r in select e.id,e.nombre,e.grado from public.estudiantes e where e.activo and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) loop
  insert into public.feria_participantes(tipo,nombre,estudiante_id,grado,proyecto_origen,proyecto_id,automatico)
  values('expositor',r.nombre,r.id,case when r.grado=0 then 'TS y JR' else r.grado||'°' end,'claudina',p.id,true)
  on conflict(estudiante_id,proyecto_origen,proyecto_id) where tipo='expositor' and estudiante_id is not null and proyecto_id is not null
  do update set activo=true,actualizado_en=now() where feria_participantes.automatico and not feria_participantes.activo;
 end loop;
end $$;
revoke all on function public.feria_sincronizar_expositores(uuid) from public,anon,authenticated;
drop trigger if exists feria_participantes_al_aprobar on public.feria_proyectos;
create trigger feria_participantes_al_aprobar after insert or update of estado,integrantes_ids,titulo on public.feria_proyectos for each row execute function public.feria_participantes_al_aprobar();
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
   if p.automatico then habilitado:=habilitado and i.titulo not like '[Emprendimiento familiar] %' and(p.estudiante_id=i.estudiante_id or p.estudiante_id=any(i.integrantes_ids));end if;
   titulo:=case when i.titulo like '[Emprendimiento familiar] %' then substr(i.titulo,27) else i.titulo end;
  else
   select * into e from public.feria_proyectos_externos where id=p.proyecto_id;
   habilitado:=habilitado and e.id is not null and e.estado='aprobado';titulo:=e.datos->>'titulo';
  end if;
  select * into pl from public.feria_placas where origen=p.proyecto_origen and proyecto_id=p.proyecto_id;
 elsif p.tipo='expositor' then habilitado:=false;
 end if;
 return (to_jsonb(p)-'creado_por')||jsonb_build_object('nombre',coalesce(nombre_actual,p.nombre),'grado',coalesce(grado_actual,p.grado),'habilitado',coalesce(habilitado,false),'proyecto_titulo',coalesce(titulo,''),'categoria',pl.categoria,
 'proyecto_codigo',case when pl.proyecto_id is null then '' else case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,greatest(3,length(pl.numero_categoria::text)),'0') end,'numero_general',pl.numero_general,'ubicaciones',case when coalesce(habilitado,false) and p.proyecto_id is not null then public.feria_ubicaciones_proyecto(p.proyecto_origen,p.proyecto_id) else '[]'::jsonb end);
end $$;
revoke all on function public.feria_participante_datos(uuid) from public,anon,authenticated;
-- Corrección solicitada para este proyecto concreto; no reclasifica otros proyectos.
do $$declare r record;numero integer;areas_nuevas text[];begin
 for r in select p.* from public.feria_proyectos p where lower(regexp_replace(btrim(p.titulo),'[[:space:].]+$','','g'))='weather scientists: análisis climático y prevención de riesgos' order by p.id for update loop
  select array_agg(distinct area order by area) into areas_nuevas from unnest(array_remove(r.areas,'emprendimiento')||array['science']) area;
  if r.areas is distinct from areas_nuevas then update public.feria_proyectos set areas=areas_nuevas,version=version+1,revision_contenido=revision_contenido+1,actualizado_en=now() where id=r.id;end if;
  if exists(select 1 from public.feria_placas where origen='claudina' and proyecto_id=r.id and categoria<>'stem') then
   update public.feria_placa_contadores set ultimo=ultimo+1 where clave='stem' returning ultimo into numero;
   update public.feria_placas set categoria='stem',numero_categoria=numero where origen='claudina' and proyecto_id=r.id;
  end if;
 end loop;
end $$;
-- Conservar registros y certificados; desactivar solo credenciales automáticas familiares.
do $$declare r record;begin
 for r in select id from public.feria_proyectos where titulo like '[Emprendimiento familiar] %' loop perform public.feria_sincronizar_expositores(r.id);end loop;
end $$;

-- Vínculos estables para evitar duplicados al incorporar varias veces.
alter table public.feria_participantes add column if not exists jurado_id uuid references public.feria_jurados(id);
alter table public.feria_participantes add column if not exists profesor_id uuid references public.perfiles(id);
create unique index if not exists feria_participante_jurado_unico on public.feria_participantes(jurado_id) where jurado_id is not null;
create unique index if not exists feria_participante_profesor_unico on public.feria_participantes(profesor_id) where profesor_id is not null;
alter table public.feria_participantes drop constraint if exists feria_participantes_tipo_check;
alter table public.feria_participantes add constraint feria_participantes_tipo_check check(tipo in('expositor','evaluador','profesor','logistica','ponente','asistente'));
do $patch$
declare d text;
begin
 select pg_get_functiondef('public.feria_participante_guardar(uuid,jsonb)'::regprocedure) into d;
 d:=replace(d,$old$tipo not in('expositor','evaluador','logistica','ponente','asistente')$old$,$new$tipo not in('expositor','evaluador','profesor','logistica','ponente','asistente')$new$);
 execute d;
end $patch$;
create or replace function public.feria_sincronizar_jurados_profesores()
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;existente uuid;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden incorporar jurados y profesores';end if;
 perform pg_advisory_xact_lock(20261106,2027);
 for r in select id,nombre,institucion,profesion from public.feria_jurados order by id loop
  -- Vincular un registro manual inequívoco en lugar de duplicarlo.
  existente:=null;
  select min(p.id::text)::uuid into existente from public.feria_participantes p
   where p.tipo='evaluador' and p.jurado_id is null and lower(trim(p.nombre))=lower(trim(r.nombre))
   and lower(trim(p.institucion))=lower(trim(r.institucion)) having count(*)=1;
  if existente is not null and not exists(select 1 from public.feria_participantes where jurado_id=r.id) then
   update public.feria_participantes set jurado_id=r.id where id=existente;
  end if;
  insert into public.feria_participantes(tipo,nombre,institucion,detalle,jurado_id,creado_por)
  values('evaluador',r.nombre,r.institucion,r.profesion,r.id,auth.uid())
  on conflict(jurado_id) where jurado_id is not null do nothing;
 end loop;
 for r in select id,nombre from public.perfiles where rol='profesor' and length(trim(nombre))>=2 order by id loop
  existente:=null;
  select min(p.id::text)::uuid into existente from public.feria_participantes p
   where p.tipo='profesor' and p.profesor_id is null and lower(trim(p.nombre))=lower(trim(r.nombre)) having count(*)=1;
  if existente is not null and not exists(select 1 from public.feria_participantes where profesor_id=r.id) then
   update public.feria_participantes set profesor_id=r.id where id=existente;
  end if;
  insert into public.feria_participantes(tipo,nombre,profesor_id,creado_por)
  values('profesor',r.nombre,r.id,auth.uid())
  on conflict(profesor_id) where profesor_id is not null do nothing;
 end loop;
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_sincronizar_jurados_profesores() from public,anon;
grant execute on function public.feria_sincronizar_jurados_profesores() to authenticated;
notify pgrst,'reload schema';
commit;
