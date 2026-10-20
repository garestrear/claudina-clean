-- Ejecutar completo en Supabase SQL Editor. No borra ni modifica intentos.
-- Clasificación para estudiantes activos: solo nombres, grados y puntajes.
begin;
create or replace function public.ingles_clasificacion(actividad text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ficha public.estudiantes;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 if ficha.id is null or not exists(
  select 1 from public.ingles_actividades a
  where a.id=actividad and a.publicada and ficha.grado=any(a.grados)
 ) then raise exception 'La clasificación no está disponible para tu cuenta';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.puesto,r.grado,r.nombre,r.id) from (
  select e.id,e.nombre,e.grado,p.intentos,p.aciertos,p.total,p.mejor_aciertos,
   dense_rank() over(order by p.mejor_aciertos::numeric/nullif(p.total,0) desc nulls last) as puesto
  from public.ingles_progreso p
  join public.estudiantes e on e.id=p.estudiante_id
  join public.ingles_actividades a on a.id=p.actividad_id
  where p.actividad_id=actividad and e.activo and e.grado=any(a.grados)
 ) r),'[]'::jsonb);
end;
$$;
revoke all on function public.ingles_clasificacion(text) from public,anon;
grant execute on function public.ingles_clasificacion(text) to authenticated;
notify pgrst, 'reload schema';
commit;
