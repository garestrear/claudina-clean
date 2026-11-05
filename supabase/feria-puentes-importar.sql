-- Ejecutar después de feria-puentes-descalificacion.sql y feria-puentes-duracion.sql.
begin;
-- Corrige la función instalada sin reemplazar otras mejoras de la mesa.
do $$declare definicion text;bloque text:=$b$if p.masa_g is null then raise exception 'Registra el peso del puente en la mesa antes de iniciar, para resolver empates';end if;$b$;
begin
 definicion:=pg_get_functiondef('public.feria_puentes_accion(text,jsonb,integer,uuid)'::regprocedure);
 if position(bloque in definicion)>0 then execute replace(definicion,bloque,'-- La masa es opcional; no bloquea el inicio.');end if;
end $$;
alter table public.feria_puentes alter column masa_g drop not null;
alter table public.feria_puentes alter column largo_cm drop not null;
alter table public.feria_puentes alter column ancho_cm drop not null;
create table if not exists public.feria_puentes_importaciones(
 id uuid primary key,docente uuid not null,archivo text not null,sha256 text not null,fuente jsonb not null,filas jsonb not null,creado_en timestamptz not null default now()
);
alter table public.feria_puentes_importaciones enable row level security;
revoke all on public.feria_puentes_importaciones from public,anon,authenticated;
alter table public.feria_puentes_rondas add column if not exists importacion_id uuid references public.feria_puentes_importaciones(id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('feria-puentes-importaciones','feria-puentes-importaciones',false,10485760,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']) on conflict(id) do nothing;
drop policy if exists "docentes leen excel puentes" on storage.objects;
create policy "docentes leen excel puentes" on storage.objects for select to authenticated using(bucket_id='feria-puentes-importaciones' and public.es_profesor());
drop policy if exists "docentes cargan excel puentes" on storage.objects;
create policy "docentes cargan excel puentes" on storage.objects for insert to authenticated with check(bucket_id='feria-puentes-importaciones' and public.es_profesor() and split_part(name,'/',1)=auth.uid()::text);
create or replace function public.feria_puentes_importar(lote uuid,archivo text,sha256 text,fuente jsonb,filas jsonb,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.feria_puentes_mesa;p public.feria_puentes;r public.feria_puentes_rondas;prev public.feria_puentes_importaciones;
 f jsonb;i jsonb;n integer;carga numeric;total numeric;reportado numeric;razon text;t timestamptz;descalificado boolean;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo los docentes pueden importar resultados';end if;
 perform pg_advisory_xact_lock(20261106,444);
 if lote is null or sha256 is null or sha256!~'^[a-f0-9]{64}$' or archivo is null or not starts_with(archivo,auth.uid()::text||'/') or not exists(select 1 from storage.objects o where o.bucket_id='feria-puentes-importaciones' and o.name=archivo) then raise exception 'Sube y conserva primero el Excel original';end if;
 if jsonb_typeof(fuente) is distinct from 'object' or jsonb_typeof(filas) is distinct from 'array' or jsonb_array_length(filas) not between 1 and 300 or octet_length(filas::text)+octet_length(fuente::text)>2000000 then raise exception 'Revisa la vista previa de la importación';end if;
 select * into prev from public.feria_puentes_importaciones x where x.id=lote;
 if prev.id is not null then
  if prev.docente<>auth.uid() or prev.sha256<>sha256 or prev.archivo<>archivo or prev.filas<>filas or prev.fuente<>fuente then raise exception 'Identificador de importación ya utilizado';end if;
  return public.feria_puentes_contexto();
 end if;
 select * into m from public.feria_puentes_mesa where id for update;
 if m.version is distinct from version_esperada then raise exception 'El concurso cambió. Actualiza y revisa las coincidencias antes de importar';end if;
 if exists(select 1 from public.feria_puentes_rondas where resultado='pendiente') then raise exception 'Resuelve la prueba en curso antes de importar';end if;
 if (select count(distinct x->>'puente_id') from jsonb_array_elements(filas) x)<>jsonb_array_length(filas) then raise exception 'No asignes dos filas al mismo puente';end if;
 insert into public.feria_puentes_importaciones(id,docente,archivo,sha256,fuente,filas) values(lote,auth.uid(),archivo,sha256,fuente,filas);
 for f in select value from jsonb_array_elements(filas) loop
  select * into p from public.feria_puentes where id=(f->>'puente_id')::uuid for update;
  if p.id is null or p.version is distinct from (f->>'version')::integer or f->>'revisado' is distinct from 'true' then raise exception 'Confirma la coincidencia y la versión del puente de cada fila';end if;
  if jsonb_typeof(f->'intentos') is distinct from 'array' or jsonb_array_length(f->'intentos') not between 1 and 3 then raise exception 'Cada puente debe tener de uno a tres intentos realizados';end if;
  total:=0;n:=0;
  for i in select value from jsonb_array_elements(f->'intentos') loop
   n:=n+1;carga:=nullif(i->>'carga_kg','')::numeric;
   if i->>'resultado' is null or i->>'resultado' not in('valida','fallo') or carga is null or carga<=0 or carga='NaN'::numeric or carga>9999999.999 or carga<>round(carga,3) then raise exception 'Indica el peso de cada intento realizado, incluso si falló. No se inventan pesos de celdas vacías';end if;
   if i->>'resultado'='valida' then total:=total+carga;end if;
   select * into r from public.feria_puentes_rondas where puente_id=p.id and numero=n;
   if r.id is not null then
    if r.carga_kg<>carga or r.resultado<>(i->>'resultado') or not r.cuenta_intento then raise exception 'El puente % ya tiene un intento % diferente. No se sobrescribe: coteja el registro existente',p.titulo,n;end if;
   else
    t:=clock_timestamp();
    insert into public.feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador,validado_por,resultado,motivo,cuenta_intento,importacion_id)
    values(p.id,n,carga,t,t+interval '10 seconds',auth.uid(),auth.uid(),i->>'resultado','Importado de Excel. Inicio/fin son marcas técnicas de carga; la hora y duración real de la prueba no fueron registradas.',true,lote);
   end if;
  end loop;
  if exists(select 1 from public.feria_puentes_rondas rr where rr.puente_id=p.id and rr.numero>n) then raise exception 'El puente % tiene más intentos que la fila del archivo. No se eliminan datos',p.titulo;end if;
  reportado:=nullif(f->>'total_reportado','')::numeric;
  if reportado is not null and (reportado='NaN'::numeric or reportado<>total) and (f->>'aceptar_total_calculado' is distinct from 'true' or length(trim(coalesce(f->>'motivo_total','')))<5) then raise exception 'El total reportado de % difiere de los intentos válidos. Revisa y justifica la diferencia',p.titulo;end if;
  descalificado:=coalesce((f->>'descalificado')::boolean,false);razon:=trim(coalesce(f->>'motivo_descalificacion',''));
  if descalificado and length(razon)<5 then raise exception 'Indica el motivo de descalificación de %',p.titulo;end if;
  if p.estado='descalificado' and not descalificado then raise exception 'El puente % ya está descalificado. No se revierte automáticamente su descalificación',p.titulo;end if;
  update public.feria_puentes set estado=case when descalificado then 'descalificado' else 'finalizado' end,motivo_fin=case when descalificado then razon else coalesce(nullif(trim(f->>'motivo_finalizacion'),''),'Resultados históricos importados de Excel') end,version=version+1,actualizado_en=now() where id=p.id;
 end loop;
 update public.feria_puentes_mesa set version=version+1 where id;
 return public.feria_puentes_contexto();
end $$;
revoke all on function public.feria_puentes_importar(uuid,text,text,jsonb,jsonb,integer) from public,anon;
grant execute on function public.feria_puentes_importar(uuid,text,text,jsonb,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
