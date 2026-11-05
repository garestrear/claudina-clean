-- Ejecutar después del módulo de espacios. Repetible.
begin;
select pg_advisory_xact_lock(20261106);
create or replace function public.feria_responsable_asesor()
returns trigger language plpgsql security definer set search_path='' as $$
declare asesor uuid;nombre_anterior text;
begin
 if not new.activo or new.tipo<>'proyecto' or new.origen<>'claudina' then return new;end if;
 if new.docente_id is null and (TG_OP='INSERT' or (new.origen,new.proyecto_id) is distinct from (old.origen,old.proyecto_id)) then
  select p.asesor_id into asesor from public.feria_proyectos p join public.perfiles pf on pf.id=p.asesor_id and pf.rol='profesor' where p.id=new.proyecto_id;
  new.docente_id:=asesor;
 end if;
 if TG_OP='UPDATE' and new.docente_id is distinct from old.docente_id then
  select nombre into nombre_anterior from public.perfiles where id=old.docente_id;
  if new.responsable=nombre_anterior then new.responsable:='';end if;
 end if;
 if btrim(coalesce(new.responsable,''))='' and new.docente_id is not null then
  select nombre into new.responsable from public.perfiles where id=new.docente_id;
 end if;
 return new;
end $$;
revoke all on function public.feria_responsable_asesor() from public,anon,authenticated;
drop trigger if exists feria_responsable_asesor on public.feria_programacion;
create trigger feria_responsable_asesor before insert or update on public.feria_programacion for each row execute function public.feria_responsable_asesor();
-- Completar las reservas existentes sin docente, preservando asignaciones manuales.
update public.feria_programacion r set docente_id=p.asesor_id,version=r.version+1,actualizado_en=now()
from public.feria_proyectos p join public.perfiles pf on pf.id=p.asesor_id and pf.rol='profesor'
where r.activo and r.tipo='proyecto' and r.origen='claudina' and r.proyecto_id=p.id and r.docente_id is null;
create or replace function public.feria_espacios_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden organizar los espacios de la feria';end if;
 return jsonb_build_object('espacios',coalesce((select jsonb_agg(to_jsonb(e) order by e.orden,e.nombre) from public.feria_espacios e),'[]'::jsonb),
 'programacion',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('espacio_nombre',e.nombre,'proyecto_vigente',case when r.tipo='actividad' then true when r.origen='claudina' then exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado') else exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado') end) order by r.fecha,r.inicio,e.orden,r.titulo) from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id),'[]'::jsonb),
 'proyectos',coalesce((select jsonb_agg(x.d order by x.titulo) from (
 select p.titulo,jsonb_build_object('id',p.id,'origen','claudina','titulo',p.titulo,'grado',p.grado,'asesor_id',p.asesor_id,'institucion','C.E.R. Claudina Múnera') d from public.feria_proyectos p where p.estado='aprobado'
 union all select p.datos->>'titulo',jsonb_build_object('id',p.id,'origen','invitados','titulo',p.datos->>'titulo','institucion',p.datos->>'institucion') from public.feria_proyectos_externos p where p.estado='aprobado')x),'[]'::jsonb),
 'docentes',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre) from public.perfiles p where p.rol='profesor'),'[]'::jsonb));
end $$;


notify pgrst,'reload schema';
commit;
