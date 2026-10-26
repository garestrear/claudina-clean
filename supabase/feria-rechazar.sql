-- Ejecutar completo después de feria-ciencia.sql y feria-invitados.sql.
-- Conserva los proyectos y el historial; no elimina ninguna inscripción.
begin;
alter table public.feria_proyectos drop constraint if exists feria_proyectos_estado_check;
alter table public.feria_proyectos add constraint feria_proyectos_estado_check check(estado in('borrador','enviado','ajustes','aprobado','rechazado'));
alter table public.feria_revisiones drop constraint if exists feria_revisiones_estado_check;
alter table public.feria_revisiones add constraint feria_revisiones_estado_check check(estado in('ajustes','aprobado','rechazado'));
alter table public.feria_proyectos_externos drop constraint if exists feria_proyectos_externos_estado_check;
alter table public.feria_proyectos_externos add constraint feria_proyectos_externos_estado_check check(estado in('borrador','enviado','ajustes','aprobado','rechazado'));
alter table public.feria_revisiones_externas drop constraint if exists feria_revisiones_externas_decision_check;
alter table public.feria_revisiones_externas add constraint feria_revisiones_externas_decision_check check(decision in('ajustes','aprobado','rechazado'));
create or replace function public.feria_revisar(proyecto uuid,version_esperada integer,decision text,comentario text,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;nombre text;previa public.feria_revisiones;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Cualquier docente puede revisar; ingresa con cuenta docente';end if;
 if solicitud is null or decision is null or decision not in('ajustes','aprobado','rechazado') or comentario is null or length(comentario)>4000 or(decision in('ajustes','rechazado') and length(trim(comentario))=0) then raise exception 'Escribe las observaciones o el motivo del rechazo';end if;
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is null or p.estado='borrador' then raise exception 'Este proyecto aún no está disponible para revisión';end if;
 select * into previa from public.feria_revisiones r where r.solicitud=feria_revisar.solicitud;
 if previa.id is not null then
  if previa.proyecto_id<>p.id or previa.revisor<>auth.uid() then raise exception 'Solicitud inválida';end if;
  return public.feria_proyecto(p.id);
 end if;
 if version_esperada is distinct from p.version then raise exception 'El proyecto cambió. Actualiza y revisa la versión más reciente';end if;
 if p.estado<>'enviado' and not(decision='rechazado' and p.estado in('ajustes','aprobado')) and not(p.estado='rechazado' and decision='ajustes') then raise exception 'El proyecto debe estar enviado para revisión';end if;
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
 if p.id is null or p.estado='borrador' then raise exception 'Proyecto no disponible';end if;
 select * into r from public.feria_revisiones_externas where feria_revisiones_externas.solicitud=feria_externa_revisar.solicitud;
 if r.id is not null then
  if r.proyecto_id=proyecto and r.autor=auth.uid() then return public.feria_externa_proyecto(proyecto);end if;
  raise exception 'Solicitud ya utilizada';
 end if;
 if p.version is distinct from version_esperada or (p.estado<>'enviado' and not(decision='rechazado' and p.estado in('ajustes','aprobado')) and not(p.estado='rechazado' and decision='ajustes')) then raise exception 'El proyecto cambió o no está enviado para revisión';end if;
 if decision is null or decision not in('ajustes','aprobado','rechazado') or solicitud is null or length(coalesce(comentario,''))>4000 or(decision in('ajustes','rechazado') and length(trim(coalesce(comentario,'')))=0) then raise exception 'Revisa la decisión y las observaciones';end if;
 insert into public.feria_revisiones_externas(proyecto_id,autor,decision,comentario,version_revisada,solicitud) values(proyecto,auth.uid(),decision,trim(coalesce(comentario,'')),p.version,solicitud);
 update public.feria_proyectos_externos f set estado=decision,version=f.version+1,actualizado_en=now() where id=proyecto;
 return public.feria_externa_proyecto(proyecto);
end $$;
-- Un formulario anterior no puede volver a enviar un rechazado sin decisión docente.
create or replace function public.feria_proteger_rechazado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.estado='rechazado' and not coalesce(public.es_profesor(),false) then
  raise exception 'Este proyecto fue rechazado. Un docente debe volver a considerarlo antes de editarlo';
 end if;
 return new;
end $$;
revoke all on function public.feria_proteger_rechazado() from public,anon,authenticated;
drop trigger if exists feria_proteger_rechazado on public.feria_proyectos;
create trigger feria_proteger_rechazado before update on public.feria_proyectos for each row execute function public.feria_proteger_rechazado();
drop trigger if exists feria_proteger_rechazado on public.feria_proyectos_externos;
create trigger feria_proteger_rechazado before update on public.feria_proyectos_externos for each row execute function public.feria_proteger_rechazado();
notify pgrst,'reload schema';
commit;
