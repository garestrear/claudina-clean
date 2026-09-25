-- Ejecutar una vez en SQL Editor de Supabase.
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('evento','tarea','motivacion')),
  titulo text not null check (char_length(trim(titulo)) between 1 and 120),
  contenido text not null check (char_length(trim(contenido)) between 1 and 1000),
  grado integer check (grado between 1 and 8), -- NULL: todos los grados
  fecha_evento date,
  publicado boolean not null default true,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.avisos enable row level security;

create policy "estudiante ve avisos de su grado" on public.avisos
for select to authenticated using (
  public.es_profesor() or (
    publicado and exists (
      select 1 from public.estudiantes e
      where e.auth_user_id = auth.uid() and e.activo
        and (avisos.grado is null or avisos.grado = e.grado)
    )
  )
);

create policy "profesor crea avisos" on public.avisos
for insert to authenticated with check (public.es_profesor() and creado_por = auth.uid());

create policy "profesor modifica avisos" on public.avisos
for update to authenticated using (public.es_profesor()) with check (public.es_profesor());

create policy "profesor borra avisos" on public.avisos
for delete to authenticated using (public.es_profesor());
