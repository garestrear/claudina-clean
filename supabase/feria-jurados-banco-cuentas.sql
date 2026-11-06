-- Ejecutar después de feria-jurados-cuentas.sql y asignación automática.
-- No crea contraseñas con SQL ni envía correos. Las crea el servidor de la app.
begin;
create table if not exists public.feria_jurado_cuentas_disponibles(
 usuario text primary key check(usuario ~ '^jurado(0[1-9]|1[0-9]|20)$'),
 cuenta_id uuid not null unique references auth.users(id),
 jurado_id uuid unique references public.feria_jurados(id),
 asignada_en timestamptz
);
alter table public.feria_jurado_cuentas_disponibles enable row level security;
revoke all on public.feria_jurado_cuentas_disponibles from public,anon,authenticated;
grant select on public.feria_jurado_cuentas_disponibles to service_role;

create or replace function public.feria_jurado_banco_registrar(usuario_nuevo text,cuenta uuid)
returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(20261106,333);
 if usuario_nuevo !~ '^jurado(0[1-9]|1[0-9]|20)$' or not exists(select 1 from auth.users u where u.id=cuenta and u.email=usuario_nuevo||'@jurados.claudina.invalid' and u.email_confirmed_at is not null) or exists(select 1 from public.perfiles where id=cuenta) or exists(select 1 from public.feria_jurados where cuenta_id=cuenta) then raise exception 'Cuenta de reserva inválida';end if;
 insert into public.feria_jurado_cuentas_disponibles(usuario,cuenta_id) values(usuario_nuevo,cuenta)
 on conflict(usuario) do nothing;
 if not exists(select 1 from public.feria_jurado_cuentas_disponibles where usuario=usuario_nuevo and cuenta_id=cuenta) then raise exception 'Usuario de reserva ya ocupado';end if;
end $$;
revoke all on function public.feria_jurado_banco_registrar(text,uuid) from public,anon,authenticated;
grant execute on function public.feria_jurado_banco_registrar(text,uuid) to service_role;

create or replace function public.feria_jurado_banco_listar()
returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden consultar las cuentas';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('usuario',c.usuario,'jurado_id',c.jurado_id,'nombre',j.nombre) order by c.usuario),'[]'::jsonb) from public.feria_jurado_cuentas_disponibles c left join public.feria_jurados j on j.id=c.jurado_id);
end $$;
create or replace function public.feria_jurado_banco_asignar(persona uuid,usuario_nuevo text)
returns void language plpgsql security definer set search_path='' as $$
declare cuenta uuid;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden asignar cuentas';end if;
 perform pg_advisory_xact_lock(20261106,333);
 select cuenta_id into cuenta from public.feria_jurado_cuentas_disponibles where usuario=usuario_nuevo and jurado_id is null for update;
 if cuenta is null then raise exception 'El usuario ya está asignado o no está disponible';end if;
 perform public.feria_jurado_cuenta_vincular(persona,cuenta,usuario_nuevo);
 update public.feria_jurado_cuentas_disponibles set jurado_id=persona,asignada_en=now() where usuario=usuario_nuevo and jurado_id is null;
end $$;
revoke all on function public.feria_jurado_banco_listar(),public.feria_jurado_banco_asignar(uuid,text) from public,anon;
grant execute on function public.feria_jurado_banco_listar(),public.feria_jurado_banco_asignar(uuid,text) to authenticated;

-- Corrige el UPDATE que impedía guardar jurados con safeupdate activo.
do $$declare f record;d text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname in ('feria_asignar_jurados_interno','feria_jurado_habilitar','feria_jurado_cuenta_vincular','feria_evaluacion_categoria','feria_evaluacion_plan','feria_evaluacion_reasignar') loop
  d:=pg_get_functiondef(f.oid);
  d:=replace(d,'update public.feria_evaluacion_config set version=version+1;','update public.feria_evaluacion_config set version=version+1 where id=true;');
  d:=replace(d,'update public.feria_evaluacion_config set fecha=dia,inicio=desde,fin=hasta,version=version+1;','update public.feria_evaluacion_config set fecha=dia,inicio=desde,fin=hasta,version=version+1 where id=true;');
  execute d;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
