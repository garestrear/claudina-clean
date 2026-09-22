-- Ejecutar después de participacion-estudiantil.sql.
-- Ventana de valoración: días calendario 1 a 4 después del aseo,
-- según la fecha de Colombia. La nota oficial del profesor no se toca.
drop policy if exists "crear valoracion estudiante activo" on public.valoraciones;
create policy "crear valoracion estudiante activo" on public.valoraciones
for insert to authenticated with check (
  autor=auth.uid() and exists (
    select 1 from public.estudiantes e join public.registros_aseo r
      on r.grupo=case when e.grado=6 then '6' else '7-8' end
    where e.auth_user_id=auth.uid() and e.activo and r.id=registro_id
      and r.fecha between (timezone('America/Bogota',now())::date - 4)
                      and (timezone('America/Bogota',now())::date - 1)
  )
);
drop policy if exists "editar valoracion estudiante activo" on public.valoraciones;
create policy "editar valoracion estudiante activo" on public.valoraciones
for update to authenticated using (autor=auth.uid()) with check (
  autor=auth.uid() and exists (
    select 1 from public.estudiantes e join public.registros_aseo r
      on r.grupo=case when e.grado=6 then '6' else '7-8' end
    where e.auth_user_id=auth.uid() and e.activo and r.id=registro_id
      and r.fecha between (timezone('America/Bogota',now())::date - 4)
                      and (timezone('America/Bogota',now())::date - 1)
  )
);

-- Evidencia separada de un reporte de problema o de la foto del profesor.
create table if not exists public.evidencias_aseo_estudiante (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id),
  fecha date not null,
  path text not null,
  subido_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(estudiante_id,fecha)
);
alter table public.evidencias_aseo_estudiante enable row level security;
grant select,insert on public.evidencias_aseo_estudiante to authenticated;
drop policy if exists "profesor ve evidencias estudiantiles" on public.evidencias_aseo_estudiante;
create policy "profesor ve evidencias estudiantiles" on public.evidencias_aseo_estudiante
for select to authenticated using (public.es_profesor());
drop policy if exists "estudiante ve evidencia propia" on public.evidencias_aseo_estudiante;
create policy "estudiante ve evidencia propia" on public.evidencias_aseo_estudiante
for select to authenticated using (subido_por=auth.uid() and exists (
  select 1 from public.estudiantes e where e.id=estudiante_id and e.auth_user_id=auth.uid()
));
drop policy if exists "estudiante sube aseo en su turno" on public.evidencias_aseo_estudiante;
create policy "estudiante sube aseo en su turno" on public.evidencias_aseo_estudiante
for insert to authenticated with check (
  subido_por=auth.uid()
  and fecha=timezone('America/Bogota',now())::date
  and path like auth.uid()::text || '/aseo/' || fecha::text || '/%'
  and exists (
    select 1 from public.estudiantes e join public.asignaciones a on a.estudiante_id=e.id
    where e.id=estudiante_id and e.auth_user_id=auth.uid() and e.activo
      and a.dia=extract(isodow from timezone('America/Bogota',now()))::int
  )
);
