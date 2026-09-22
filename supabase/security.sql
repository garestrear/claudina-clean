-- Claudina Clean · seguridad RLS + Storage
-- Ejecutar UNA VEZ después de supabase/schema.sql

-- 1) Activar RLS
alter table public.perfiles enable row level security;
alter table public.estudiantes enable row level security;
alter table public.asignaciones enable row level security;
alter table public.registros_aseo enable row level security;
alter table public.participaciones enable row level security;
alter table public.tareas enable row level security;
alter table public.evidencias enable row level security;
alter table public.valoraciones enable row level security;
alter table public.reportes enable row level security;

-- 2) Función segura para saber si el usuario autenticado es profesor
create or replace function public.es_profesor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'profesor'
  );
$$;

revoke all on function public.es_profesor() from public;
grant execute on function public.es_profesor() to authenticated;

-- 3) Perfiles
create policy "perfil propio lectura" on public.perfiles
for select to authenticated using (id = auth.uid() or public.es_profesor());
create policy "profesor administra perfiles" on public.perfiles
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 4) Datos de estudiantes y asignaciones: lectura autenticada; escritura profesor
create policy "estudiantes lectura autenticada" on public.estudiantes
for select to authenticated using (true);
create policy "profesor administra estudiantes" on public.estudiantes
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());
create policy "asignaciones lectura autenticada" on public.asignaciones
for select to authenticated using (true);
create policy "profesor administra asignaciones" on public.asignaciones
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 5) Registros oficiales, participaciones y tareas
create policy "registros lectura autenticada" on public.registros_aseo
for select to authenticated using (true);
create policy "profesor administra registros" on public.registros_aseo
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());
create policy "participaciones lectura autenticada" on public.participaciones
for select to authenticated using (true);
create policy "profesor administra participaciones" on public.participaciones
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());
create policy "tareas lectura autenticada" on public.tareas
for select to authenticated using (true);
create policy "profesor administra tareas" on public.tareas
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 6) Valoraciones: estudiante crea/lee la propia; profesor ve todas
create policy "valoracion propia lectura" on public.valoraciones
for select to authenticated using (autor = auth.uid() or public.es_profesor());
create policy "crear valoracion propia" on public.valoraciones
for insert to authenticated with check (autor = auth.uid());
create policy "editar valoracion propia" on public.valoraciones
for update to authenticated using (autor = auth.uid()) with check (autor = auth.uid());
create policy "profesor administra valoraciones" on public.valoraciones
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 7) Reportes: estudiante crea y consulta los propios; profesor administra todos
create policy "reporte propio lectura" on public.reportes
for select to authenticated using (autor = auth.uid() or public.es_profesor());
create policy "crear reporte propio" on public.reportes
for insert to authenticated with check (autor = auth.uid() and estado = 'pendiente');
create policy "profesor administra reportes" on public.reportes
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 8) Evidencias (metadatos)
create policy "evidencias lectura autenticada" on public.evidencias
for select to authenticated using (true);
create policy "crear evidencia propia" on public.evidencias
for insert to authenticated with check (subido_por = auth.uid());
create policy "profesor administra evidencias" on public.evidencias
for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- 9) Bucket PRIVADO
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('evidencias','evidencias',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false;

-- Cada usuario sube a su carpeta: evidencias/<uid>/archivo
create policy "subir evidencia carpeta propia" on storage.objects
for insert to authenticated
with check (
  bucket_id='evidencias'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "leer evidencia propia o profesor" on storage.objects
for select to authenticated
using (
  bucket_id='evidencias'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.es_profesor())
);
create policy "profesor elimina evidencias" on storage.objects
for delete to authenticated
using (bucket_id='evidencias' and public.es_profesor());

-- NOTA: después de crear la primera cuenta del profesor,
-- su fila en public.perfiles debe tener rol='profesor'.
