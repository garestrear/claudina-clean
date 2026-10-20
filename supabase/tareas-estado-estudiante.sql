-- Ejecutar completo en Supabase SQL Editor. Repetible; no modifica las tareas.
begin;
create table if not exists public.tareas_estado_estudiante (
 estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
 tarea_id uuid not null references public.avisos(id) on delete cascade,
 hecha_at timestamptz not null default now(),
 primary key(estudiante_id,tarea_id)
);
alter table public.tareas_estado_estudiante enable row level security;
revoke all on public.tareas_estado_estudiante from public,anon,authenticated;

create or replace function public.tareas_estado_listar()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ficha public.estudiantes;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 if ficha.id is null then raise exception 'Solo estudiantes con ficha activa';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('tarea_id',e.tarea_id,'hecha_at',e.hecha_at) order by e.tarea_id)
  from public.tareas_estado_estudiante e join public.avisos a on a.id=e.tarea_id
  where e.estudiante_id=ficha.id and a.publicado and a.tipo='tarea'
   and (a.grado is null or a.grado=ficha.grado)),'[]'::jsonb);
end;
$$;

create or replace function public.tarea_marcar_hecha(tarea uuid,hecha boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ficha public.estudiantes;momento timestamptz;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 if ficha.id is null then raise exception 'Solo estudiantes con ficha activa';end if;
 if hecha is null then raise exception 'Selecciona el estado de la tarea';end if;
 perform 1 from public.avisos a where a.id=tarea and a.publicado and a.tipo='tarea'
  and (a.grado is null or a.grado=ficha.grado) for share;
 if not found then raise exception 'La tarea no está disponible para tu grado';end if;
 if hecha then
  insert into public.tareas_estado_estudiante(estudiante_id,tarea_id) values(ficha.id,tarea)
   on conflict(estudiante_id,tarea_id) do nothing;
  select hecha_at into momento from public.tareas_estado_estudiante where estudiante_id=ficha.id and tarea_id=tarea;
 else
  delete from public.tareas_estado_estudiante where estudiante_id=ficha.id and tarea_id=tarea;
 end if;
 return jsonb_build_object('tarea_id',tarea,'hecha',hecha,'hecha_at',momento);
end;
$$;
revoke all on function public.tareas_estado_listar(),public.tarea_marcar_hecha(uuid,boolean) from public,anon;
grant execute on function public.tareas_estado_listar(),public.tarea_marcar_hecha(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
