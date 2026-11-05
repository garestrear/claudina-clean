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
notify pgrst,'reload schema';
commit;
