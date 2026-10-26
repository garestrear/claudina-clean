-- Ejecutar completo en Supabase > SQL Editor después de docentes-administracion.sql.
begin;
create or replace function public.eliminar_invitacion_profesor(invitacion uuid)
returns void language plpgsql security definer set search_path='' as $$
declare pendiente public.invitaciones_profesor;
begin
 if auth.uid() is null or not coalesce(public.es_administrador(),false) then raise exception 'Solo administradores pueden eliminar invitaciones';end if;
 select * into pendiente from public.invitaciones_profesor where id=invitacion for update;
 if not found then raise exception 'La invitación ya fue eliminada. Actualiza la lista';end if;
 if pendiente.usada or exists(select 1 from auth.users u join public.perfiles p on p.id=u.id where lower(u.email)=pendiente.email and p.rol='profesor') then
  raise exception 'Este docente ya tiene acceso. Usa Eliminar docente en Docentes registrados';
 end if;
 delete from public.invitaciones_profesor where id=invitacion;
end $$;
revoke all on function public.eliminar_invitacion_profesor(uuid) from public,anon;
grant execute on function public.eliminar_invitacion_profesor(uuid) to authenticated;
-- Comparte el bloqueo de la invitación con la cancelación para evitar activaciones simultáneas.
create or replace function public.procesar_invitacion_profesor()
returns trigger language plpgsql security definer set search_path='' as $$
declare invitacion public.invitaciones_profesor;
begin
 select * into invitacion from public.invitaciones_profesor
 where email=lower(new.email) and usada=false order by created_at desc limit 1 for update;
 if invitacion.id is not null then
  insert into public.perfiles(id,nombre,rol) values(new.id,invitacion.nombre,'profesor')
  on conflict(id) do update set nombre=excluded.nombre,rol='profesor';
  update public.invitaciones_profesor set usada=true,usada_en=now() where id=invitacion.id;
 end if;
 return new;
end $$;
revoke all on function public.procesar_invitacion_profesor() from public,anon,authenticated;
commit;
