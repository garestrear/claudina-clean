-- Ejecutar completo en Supabase > SQL Editor, después de docentes-administracion.sql.
-- Retira el rol docente conservando la cuenta y la autoría de los registros históricos.
begin;
create or replace function public.eliminar_docente(docente uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare destino uuid; candidatos uuid[]; transferidos integer:=0;
begin
 perform pg_advisory_xact_lock(402619,1);
 if auth.uid() is null or not coalesce(public.es_administrador(),false) then raise exception 'Solo administradores pueden eliminar docentes';end if;
 if docente=auth.uid() then raise exception 'No puedes eliminar tu propio acceso docente';end if;
 perform 1 from public.perfiles where id=docente and rol='profesor' for update;
 if not found then raise exception 'El docente ya no está registrado';end if;
 select array_agg(p.id) into candidatos from public.perfiles p left join auth.users u on u.id=p.id
 where p.rol='profesor' and (lower(u.email)='gustavo.restrepo@claudinamunera.edu.co'
 or lower(trim(p.nombre)) in ('gustavo restrepo','gustavo adolfo restrepo arboleda','gustavo restrepo arboleda'));
 if docente=any(coalesce(candidatos,array[]::uuid[])) then raise exception 'Gustavo Restrepo debe permanecer para recibir las asesorías';end if;
 if exists(select 1 from public.administradores_docentes where id=docente) and
 (select count(*) from public.administradores_docentes a join public.perfiles p on p.id=a.id where p.rol='profesor')<=1 then raise exception 'Debe quedar al menos un administrador';end if;
 if exists(select 1 from public.feria_proyectos where asesor_id=docente) then
  if coalesce(cardinality(candidatos),0)<>1 then raise exception 'No se pudo identificar una única cuenta docente de Gustavo Restrepo. Revisa su nombre y correo antes de eliminar';end if;
  destino:=candidatos[1];
  perform 1 from public.perfiles where id=destino and rol='profesor' for update;
  if not found then raise exception 'Gustavo Restrepo ya no está disponible';end if;
  update public.feria_proyectos set asesor_id=destino,version=version+1,actualizado_en=now() where asesor_id=docente;
  get diagnostics transferidos=row_count;
 end if;
 -- Evita que una invitación pendiente vuelva a concederle el rol docente.
 delete from public.invitaciones_profesor where lower(email)=(select lower(email) from auth.users where id=docente);
 delete from public.administradores_docentes where id=docente;
 update public.perfiles set rol='estudiante' where id=docente;
 return jsonb_build_object('proyectos_transferidos',transferidos);
end $$;
revoke all on function public.eliminar_docente(uuid) from public,anon;
grant execute on function public.eliminar_docente(uuid) to authenticated;
-- Valida también formularios que quedaron abiertos antes de retirar un docente.
create or replace function public.validar_asesor_docente()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.asesor_id is not null then
  perform 1 from public.perfiles where id=new.asesor_id and rol='profesor' for share;
  if not found then raise exception 'El asesor ya no está disponible. Actualiza la lista de docentes';end if;
 end if;
 return new;
end $$;
revoke all on function public.validar_asesor_docente() from public,anon,authenticated;
drop trigger if exists validar_asesor_docente on public.feria_proyectos;
create trigger validar_asesor_docente before insert or update of asesor_id on public.feria_proyectos
for each row execute function public.validar_asesor_docente();
commit;
