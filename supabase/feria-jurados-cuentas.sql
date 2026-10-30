-- Ejecutar después de feria-evaluacion-jurados.sql. No envía correos.
begin;
alter table public.feria_jurados add column if not exists cuenta_id uuid unique references auth.users(id) on delete set null;
alter table public.feria_jurados add column if not exists usuario text unique check(usuario ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
alter table public.feria_jurados add column if not exists cambiar_password boolean not null default false;
-- Lectura exclusiva del servidor para administrar credenciales; sin contraseñas en esta tabla.
grant select on public.feria_jurados to service_role;
create table if not exists public.feria_jurado_intentos(clave text primary key,inicio timestamptz not null,intentos integer not null);
alter table public.feria_jurado_intentos enable row level security;
revoke all on public.feria_jurado_intentos from public,anon,authenticated;
create or replace function public.feria_jurado_intento(clave text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if clave is null or length(clave)<>64 then return false;end if;
 insert into public.feria_jurado_intentos values(clave,now(),1) on conflict on constraint feria_jurado_intentos_pkey do update set
 intentos=case when feria_jurado_intentos.inicio<now()-interval '10 minutes' then 1 else feria_jurado_intentos.intentos+1 end,
 inicio=case when feria_jurado_intentos.inicio<now()-interval '10 minutes' then now() else feria_jurado_intentos.inicio end returning intentos into n;
 delete from public.feria_jurado_intentos where inicio<now()-interval '1 day';
 return n<=20;
end $$;
create or replace function public.feria_jurado_cuenta_vincular(persona uuid,cuenta uuid,usuario_nuevo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(20261106,333);
 if not exists(select 1 from auth.users u where u.id=cuenta and u.email=usuario_nuevo||'@jurados.claudina.invalid' and u.email_confirmed_at is not null) or exists(select 1 from public.perfiles p where p.id=cuenta) then raise exception 'Cuenta de jurado no válida';end if;
 update public.feria_jurados set cuenta_id=cuenta,usuario=usuario_nuevo,cambiar_password=true where id=persona and habilitado and cuenta_id is null;
 if not found then raise exception 'Cuenta ya vinculada o jurado no habilitado';end if;
 update public.feria_evaluacion_config set version=version+1;
end $$;
create or replace function public.feria_jurado_password_cambiada(cuenta uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.feria_jurados set cambiar_password=false where cuenta_id=cuenta and habilitado;
 if not found then raise exception 'Cuenta no habilitada';end if;
end $$;
create or replace function public.feria_jurado_password_requerida(cuenta uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.feria_jurados set cambiar_password=true where cuenta_id=cuenta and habilitado;
 if not found then raise exception 'Cuenta no habilitada';end if;
end $$;
revoke all on function public.feria_jurado_intento(text),public.feria_jurado_cuenta_vincular(uuid,uuid,text),public.feria_jurado_password_cambiada(uuid),public.feria_jurado_password_requerida(uuid) from public,anon,authenticated;
grant execute on function public.feria_jurado_intento(text),public.feria_jurado_cuenta_vincular(uuid,uuid,text),public.feria_jurado_password_cambiada(uuid),public.feria_jurado_password_requerida(uuid) to service_role;
create or replace function public.feria_mi_jurado()
returns uuid language sql stable security definer set search_path='' as $$
 select j.id from public.feria_jurados j join auth.users u on (u.id=j.cuenta_id or lower(trim(u.email))=lower(trim(j.correo)))
 where u.id=auth.uid() and u.email_confirmed_at is not null and j.habilitado limit 1;
$$;
revoke all on function public.feria_mi_jurado() from public,anon;
grant execute on function public.feria_mi_jurado() to authenticated;

create or replace function public.feria_evaluacion_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);j uuid:=public.feria_mi_jurado();proyectos jsonb;
begin
 if auth.uid() is null or not(docente or j is not null) then raise exception 'Tu cuenta no está habilitada como jurado. Contacta al comité de la feria';end if;
 if exists(select 1 from public.feria_jurados jj where jj.id=j and jj.cuenta_id=auth.uid() and jj.cambiar_password) then return jsonb_build_object('requiere_cambio_password',true,'mi_jurado',j);end if;
 select coalesce(jsonb_agg(p),'[]'::jsonb) into proyectos from jsonb_array_elements(public.feria_evaluacion_proyectos())p
 where docente or exists(select 1 from public.feria_evaluacion_visitas v where v.jurado_id=j and v.origen=p->>'origen' and v.proyecto_id=(p->>'id')::uuid);
 return jsonb_build_object('docente',docente,'mi_jurado',j,'config',(select to_jsonb(c) from public.feria_evaluacion_config c),
 'proyectos',proyectos,'jurados',case when docente then coalesce((select jsonb_agg(to_jsonb(x) order by x.nombre) from (select j.*,u.id usuario_id from public.feria_jurados j left join auth.users u on lower(trim(u.email))=lower(trim(j.correo)))x),'[]'::jsonb) else '[]'::jsonb end,
 'visitas',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('evaluacion',case when e.visita_id is not null then to_jsonb(e) end) order by v.ronda) from public.feria_evaluacion_visitas v left join public.feria_evaluaciones e on e.visita_id=v.id where docente or v.jurado_id=j),'[]'::jsonb));
end $$;

create or replace function public.feria_evaluacion_guardar(visita uuid,datos jsonb,enviar boolean,version_esperada integer,solicitud_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.feria_evaluacion_visitas;e public.feria_evaluaciones;p jsonb;pesos int[];nota int;suma numeric:=0;i integer;
begin
 perform pg_advisory_xact_lock(20261106,333);
 if exists(select 1 from public.feria_jurados jj where jj.cuenta_id=auth.uid() and jj.cambiar_password) then raise exception 'Cambia tu contraseña inicial antes de evaluar';end if;
 select * into v from public.feria_evaluacion_visitas where id=visita for update;
 if v.id is null or v.jurado_id is distinct from public.feria_mi_jurado() then raise exception 'Esta visita no está asignada a tu cuenta de jurado';end if;
 select value into p from jsonb_array_elements(public.feria_evaluacion_proyectos()) where value->>'origen'=v.origen and (value->>'id')::uuid=v.proyecto_id;
 if p is null then raise exception 'El proyecto ya no está aprobado';end if;
 if not exists(select 1 from public.feria_programacion r join public.feria_espacios s on s.id=r.espacio_id and s.activo where r.origen=v.origen and r.proyecto_id=v.proyecto_id and r.activo and r.fecha=v.fecha and r.inicio<=v.inicio and r.fin>=v.fin) then raise exception 'La ubicación cambió; solicita al comité revisar la visita';end if;
 -- Revalida conflictos también si el proyecto cambió de asesor después de asignar.
 if exists(select 1 from public.feria_jurados jj join auth.users uu on lower(trim(uu.email))=lower(trim(jj.correo)) where jj.id=v.jurado_id and (uu.id=nullif(p->>'asesor_id','')::uuid or uu.id=nullif(p->>'autor_id','')::uuid)) or (nullif(p->>'asesor_id','')::uuid=auth.uid() or nullif(p->>'autor_id','')::uuid=auth.uid()) or exists(select 1 from public.feria_jurados j where j.id=v.jurado_id and (v.origen||':'||v.proyecto_id)=any(j.conflictos)) then raise exception 'Existe un conflicto con este proyecto';end if;
 select * into e from public.feria_evaluaciones where visita_id=visita for update;
 if solicitud_id is not null and e.solicitud=solicitud_id then return to_jsonb(e);end if;
 if enviar is null or solicitud_id is null or version_esperada is distinct from coalesce(e.version,0) then raise exception 'La evaluación cambió. Actualiza antes de guardar';end if;
 if e.enviada then raise exception 'La evaluación ya fue enviada';end if;
 if jsonb_typeof(datos->'notas') is distinct from 'array' or jsonb_array_length(datos->'notas')<>5 then raise exception 'Se requieren cinco criterios';end if;
 pesos:=case p->>'categoria' when 'arte' then array[15,15,25,25,20] when 'emprendimiento' then array[20,25,20,20,15] when 'familias' then array[20,25,20,20,15] when 'puentes_juvenil' then array[25,25,25,10,15] when 'puentes_infantil' then array[20,25,25,15,15] else array[15,20,25,20,20] end;
 for i in 0..4 loop
  if datos->'notas'->i='null'::jsonb and not enviar then continue;end if;
  if coalesce((datos->'notas'->>i),'')!~'^[1-5]$' then raise exception 'Califica todos los criterios de 1 a 5';end if;
  nota:=(datos->'notas'->>i)::integer;suma:=suma+nota*pesos[i+1]/5.0;
 end loop;
 if length(coalesce(datos->>'destacado',''))>2000 or length(coalesce(datos->>'sugerencia',''))>2000 then raise exception 'Comentarios demasiado largos';end if;
 insert into public.feria_evaluaciones(visita_id,notas,destacado,sugerencia,enviada,puntaje,solicitud)
 values(visita,datos->'notas',coalesce(datos->>'destacado',''),coalesce(datos->>'sugerencia',''),enviar,case when enviar then round(suma,2) end,solicitud_id)
 on conflict(visita_id) do update set notas=excluded.notas,destacado=excluded.destacado,sugerencia=excluded.sugerencia,enviada=excluded.enviada,puntaje=excluded.puntaje,solicitud=excluded.solicitud,version=feria_evaluaciones.version+1,actualizado_en=now() returning * into e;
 return to_jsonb(e);
end $$;
notify pgrst,'reload schema';
commit;
