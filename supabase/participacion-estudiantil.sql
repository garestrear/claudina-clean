-- Ejecutar una vez después de security.sql y cuentas-estudiantes.sql.
-- Solo estudiantes vinculados y activos pueden valorar o reportar.
drop policy if exists "crear valoracion propia" on public.valoraciones;
create policy "crear valoracion estudiante activo" on public.valoraciones
for insert to authenticated with check (
  autor=auth.uid() and exists (
    select 1 from public.estudiantes e join public.registros_aseo r
      on r.grupo=case when e.grado=6 then '6' else '7-8' end
    where e.auth_user_id=auth.uid() and e.activo and r.id=registro_id
  )
);
drop policy if exists "editar valoracion propia" on public.valoraciones;
create policy "editar valoracion estudiante activo" on public.valoraciones
for update to authenticated using (autor=auth.uid()) with check (
  autor=auth.uid() and exists (
    select 1 from public.estudiantes e join public.registros_aseo r
      on r.grupo=case when e.grado=6 then '6' else '7-8' end
    where e.auth_user_id=auth.uid() and e.activo and r.id=registro_id
  )
);
drop policy if exists "crear reporte propio" on public.reportes;
create policy "crear reporte estudiante activo" on public.reportes
for insert to authenticated with check (
  autor=auth.uid() and estado='pendiente' and exists (
    select 1 from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo
      and (registro_id is null or exists (
        select 1 from public.registros_aseo r where r.id=registro_id
          and r.grupo=case when e.grado=6 then '6' else '7-8' end))
  )
);
-- Un alumno solo ve las fotos asociadas con sus propios reportes,
-- mientras el profesor sigue pudiendo consultar las evidencias de aseo.
drop policy if exists "evidencias lectura autenticada" on public.evidencias;
create policy "evidencias reporte propio lectura" on public.evidencias
for select to authenticated using (exists (
  select 1 from public.reportes r where r.id=reporte_id and r.autor=auth.uid()
));
-- Los metadatos de una foto estudiantil deben pertenecer al reporte propio.
drop policy if exists "crear evidencia propia" on public.evidencias;
create policy "crear evidencia reporte propio" on public.evidencias
for insert to authenticated with check (
  subido_por=auth.uid() and reporte_id is not null and registro_id is null
  and exists (select 1 from public.reportes r where r.id=reporte_id and r.autor=auth.uid())
);
