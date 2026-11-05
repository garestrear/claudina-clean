-- Ejecutar después de las actualizaciones de escarapelas y jurados/profesores.
-- Retira credenciales obsoletas sin borrar certificados ni folios históricos.
begin;
create or replace function public.feria_sincronizar_expositores(proyecto uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;r record;
begin
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is null then return;end if;
 update public.feria_participantes c set activo=false,actualizado_en=now()
 where c.tipo='expositor' and c.proyecto_origen='claudina' and c.proyecto_id=p.id and c.activo
 and (c.automatico or c.estudiante_id is not null)
 and (p.estado<>'aprobado' or p.titulo like '[Emprendimiento familiar] %' or not exists(
  select 1 from public.estudiantes e where e.id=c.estudiante_id and e.activo
  and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids))));
 if p.estado<>'aprobado' or p.titulo like '[Emprendimiento familiar] %' then return;end if;
 for r in select e.id,e.nombre,e.grado from public.estudiantes e where e.activo
 and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) loop
  insert into public.feria_participantes(tipo,nombre,estudiante_id,grado,proyecto_origen,proyecto_id,automatico)
  values('expositor',r.nombre,r.id,case when r.grado=0 then 'TS y JR' else r.grado||'°' end,'claudina',p.id,true)
  on conflict(estudiante_id,proyecto_origen,proyecto_id) where tipo='expositor' and estudiante_id is not null and proyecto_id is not null
  do update set activo=true,actualizado_en=now()
  where not feria_participantes.activo;
 end loop;
end $$;
revoke all on function public.feria_sincronizar_expositores(uuid) from public,anon,authenticated;
create or replace function public.feria_participantes_al_aprobar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.feria_sincronizar_expositores(new.id);return new;
end $$;
revoke all on function public.feria_participantes_al_aprobar() from public,anon,authenticated;
drop trigger if exists feria_participantes_al_aprobar on public.feria_proyectos;
create trigger feria_participantes_al_aprobar after insert or update of estado,estudiante_id,integrantes_ids,titulo
on public.feria_proyectos for each row execute function public.feria_participantes_al_aprobar();
create or replace function public.feria_escarapelas_estudiante_actualizado()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if old.activo is not distinct from new.activo then return new;end if;
 for r in select id from public.feria_proyectos where estudiante_id=new.id or new.id=any(integrantes_ids) order by id loop
  perform public.feria_sincronizar_expositores(r.id);
 end loop;
 return new;
end $$;
revoke all on function public.feria_escarapelas_estudiante_actualizado() from public,anon,authenticated;
drop trigger if exists feria_escarapelas_estudiante_actualizado on public.estudiantes;
create trigger feria_escarapelas_estudiante_actualizado after update of activo on public.estudiantes
for each row execute function public.feria_escarapelas_estudiante_actualizado();
create or replace function public.feria_actualizar_escarapelas_integrantes()
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden sincronizar escarapelas';end if;
 for r in select id from public.feria_proyectos order by id loop perform public.feria_sincronizar_expositores(r.id);end loop;
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_actualizar_escarapelas_integrantes() from public,anon;
grant execute on function public.feria_actualizar_escarapelas_integrantes() to authenticated;
-- Reconciliar de inmediato los equipos ya editados.
do $$declare r record;begin
 for r in select id from public.feria_proyectos order by id loop perform public.feria_sincronizar_expositores(r.id);end loop;
end $$;
notify pgrst,'reload schema';
commit;
