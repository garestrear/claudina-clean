-- Ejecutar una vez en SQL Editor antes de publicar esta versión.
create table if not exists public.mensajes_estudiantes (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users(id),
  titulo text not null check (char_length(trim(titulo)) between 1 and 120),
  contenido text not null check (char_length(trim(contenido)) between 1 and 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  created_at timestamptz not null default now(),
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz
);

create index if not exists mensajes_estudiantes_estado_fecha
on public.mensajes_estudiantes (estado,created_at desc);

alter table public.mensajes_estudiantes enable row level security;

create policy "estudiante ve propios y aprobados" on public.mensajes_estudiantes
for select to authenticated using (
  public.es_profesor() or autor = auth.uid() or
  (estado = 'aprobado' and exists (
    select 1 from public.estudiantes e
    where e.auth_user_id = auth.uid() and e.activo
  ))
);

create policy "estudiante propone mensaje" on public.mensajes_estudiantes
for insert to authenticated with check (
  autor = auth.uid() and estado = 'pendiente'
  and revisado_por is null and revisado_at is null
  and exists (
    select 1 from public.estudiantes e
    where e.auth_user_id = auth.uid() and e.activo
  )
);

create policy "profesor modera mensajes" on public.mensajes_estudiantes
for update to authenticated using (public.es_profesor()) with check (public.es_profesor());

create policy "profesor borra mensajes" on public.mensajes_estudiantes
for delete to authenticated using (public.es_profesor());
