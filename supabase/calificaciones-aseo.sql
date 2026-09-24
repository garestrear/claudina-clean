-- Ejecutar una vez antes de publicar la vista de calificaciones.
-- El estudiante solo puede consultar sus propias participaciones; los profesores, todas.
drop policy if exists "participaciones lectura autenticada" on public.participaciones;
drop policy if exists "participaciones lectura propia o profesor" on public.participaciones;
create policy "participaciones lectura propia o profesor" on public.participaciones
for select to authenticated using (
  public.es_profesor() or exists (
    select 1 from public.estudiantes e
    where e.id=estudiante_id and e.auth_user_id=auth.uid()
  )
);

-- La regla se cumple también si otro cliente intenta guardar directamente en Supabase.
create or replace function public.calificacion_aseo_obligatoria()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.estado in ('ausente','no_cumplio') then
    new.calificacion:=2;
  elsif new.estado='cumplio' and new.calificacion is null then
    new.calificacion:=5;
  end if;
  return new;
end;
$$;
drop trigger if exists calificacion_aseo_obligatoria on public.participaciones;
create trigger calificacion_aseo_obligatoria before insert or update on public.participaciones
for each row execute function public.calificacion_aseo_obligatoria();

-- Historial: aplica 2/10 a incumplimientos y ausencias anteriores.
update public.participaciones set calificacion=2
where estado in ('ausente','no_cumplio') and calificacion is distinct from 2;
