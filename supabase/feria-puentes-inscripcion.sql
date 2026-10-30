-- Inscripción independiente de puentes. Actualización acumulativa.
-- Ejecutar completo en Supabase. Requiere estudiantes, es_profesor y Storage.
-- Crea el módulo si no existe y conserva puentes, rondas y resultados anteriores.
begin;
create table if not exists public.feria_puentes_config(categoria text primary key check(categoria in('puentes_infantil','puentes_juvenil')),inicial numeric(10,3),incremento numeric(10,3),limite numeric(10,3),separacion numeric(8,2),check(inicial>0 and incremento>0 and limite>=inicial and separacion>0 and inicial<>'NaN'::numeric and incremento<>'NaN'::numeric and limite<>'NaN'::numeric and separacion<>'NaN'::numeric));
insert into public.feria_puentes_config(categoria) values('puentes_infantil'),('puentes_juvenil') on conflict do nothing;
create table if not exists public.feria_puentes(id uuid primary key default gen_random_uuid(),origen text not null check(origen in('claudina','invitados')),proyecto_id uuid not null,categoria text not null references public.feria_puentes_config(categoria),titulo text not null,integrantes text not null default '',codigo text not null default '',masa_g numeric(10,3) not null check(masa_g>0 and masa_g<>'NaN'::numeric),largo_cm numeric(8,2) not null check(largo_cm>0 and largo_cm<>'NaN'::numeric),ancho_cm numeric(8,2) not null check(ancho_cm>0 and ancho_cm<>'NaN'::numeric),prediccion_kg numeric(10,3) check(prediccion_kg>=0 and prediccion_kg<>'NaN'::numeric),estado text not null default 'pendiente' check(estado in('pendiente','en_prueba','finalizado')),motivo_fin text,creado_por uuid not null,unique(origen,proyecto_id));
-- Permite inscribir sin proyecto, sin masa ni medidas iniciales.
alter table public.feria_puentes alter column proyecto_id drop not null;
alter table public.feria_puentes alter column masa_g drop not null;
alter table public.feria_puentes alter column largo_cm drop not null;
alter table public.feria_puentes alter column ancho_cm drop not null;
alter table public.feria_puentes add column if not exists integrantes_ids uuid[] not null default '{}';
alter table public.feria_puentes add column if not exists foto_path text;
alter table public.feria_puentes add column if not exists version integer not null default 1;
alter table public.feria_puentes add column if not exists actualizado_en timestamptz not null default now();
create index if not exists feria_puentes_equipo_idx on public.feria_puentes using gin(integrantes_ids);
create table if not exists public.feria_puentes_rondas(id uuid primary key default gen_random_uuid(),puente_id uuid not null references public.feria_puentes(id),numero integer not null,carga_kg numeric(10,3) not null check(carga_kg>0),inicio timestamptz not null,fin timestamptz not null,resultado text not null default 'pendiente' check(resultado in('pendiente','valida','fallo','anulada')),operador uuid not null,validado_por uuid,motivo text,unique(puente_id,numero),check(fin>=inicio+interval '5 seconds'));
create table if not exists public.feria_puentes_mesa(id boolean primary key default true check(id),version integer not null default 0,puente_id uuid references public.feria_puentes(id),ronda_id uuid references public.feria_puentes_rondas(id),operador uuid);
insert into public.feria_puentes_mesa(id) values(true) on conflict do nothing;
create table if not exists public.feria_puentes_auditoria(solicitud uuid primary key,actor uuid not null,accion text not null,datos jsonb not null,fecha timestamptz not null default now());
alter table public.feria_puentes_config enable row level security;
alter table public.feria_puentes enable row level security;
alter table public.feria_puentes_rondas enable row level security;
alter table public.feria_puentes_mesa enable row level security;
alter table public.feria_puentes_auditoria enable row level security;
revoke all on public.feria_puentes_config,public.feria_puentes,public.feria_puentes_rondas,public.feria_puentes_mesa,public.feria_puentes_auditoria from public,anon,authenticated;
create or replace function public.feria_puentes_contexto() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden acceder al concurso de puentes';end if;
 return jsonb_build_object('ahora',clock_timestamp(),'usuario',auth.uid(),'config',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.feria_puentes_config c),'mesa',(select to_jsonb(m) from public.feria_puentes_mesa m),'puentes',(select coalesce(jsonb_agg(to_jsonb(p) order by p.titulo),'[]'::jsonb) from public.feria_puentes p),'rondas',(select coalesce(jsonb_agg(to_jsonb(r) order by r.inicio,r.numero),'[]'::jsonb) from public.feria_puentes_rondas r));
end $$;
create or replace function public.feria_puentes_accion(accion text,datos jsonb,version_esperada integer,solicitud_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.feria_puentes_mesa;p public.feria_puentes;r public.feria_puentes_rondas;c public.feria_puentes_config;cat text;carga numeric;anterior numeric;ev public.feria_puentes_auditoria;razon text;t timestamptz;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden modificar el concurso';end if;
 perform pg_advisory_xact_lock(20261106,444);
 if solicitud_id is null or datos is null or jsonb_typeof(datos)<>'object' or accion is null then raise exception 'Solicitud no válida';end if;
 select * into ev from public.feria_puentes_auditoria where solicitud=solicitud_id;
 if ev.solicitud is not null then
  if ev.actor<>auth.uid() or ev.accion<>accion or ev.datos<>datos then raise exception 'Identificador de solicitud ya usado';end if;
  return public.feria_puentes_contexto();
 end if;
 select * into m from public.feria_puentes_mesa where id for update;
 if version_esperada is distinct from m.version then raise exception 'El concurso cambió. Actualiza antes de guardar';end if;
 select * into r from public.feria_puentes_rondas where id=m.ronda_id;
 if accion='configurar' then
  cat:=datos->>'categoria';select * into c from public.feria_puentes_config where categoria=cat;
  if c.categoria is null then raise exception 'Categoría no válida';end if;
  if exists(select 1 from public.feria_puentes_rondas rr join public.feria_puentes pp on pp.id=rr.puente_id where pp.categoria=cat) then raise exception 'La categoría ya inició sus pruebas; no se pueden cambiar las cargas';end if;
  if nullif(datos->>'inicial','')::numeric is null or nullif(datos->>'incremento','')::numeric is null or nullif(datos->>'limite','')::numeric is null or nullif(datos->>'separacion','')::numeric is null then raise exception 'Completa carga inicial, incremento, límite y separación';end if;
  update public.feria_puentes_config set inicial=(datos->>'inicial')::numeric,incremento=(datos->>'incremento')::numeric,limite=(datos->>'limite')::numeric,separacion=(datos->>'separacion')::numeric where categoria=cat;
 elsif accion='inscribir' then
  raise exception 'Actualiza Claudina App y usa Inscribir puente: ya no se vincula a un proyecto';
 elsif accion='medir' then
  select * into p from public.feria_puentes where id=(datos->>'puente_id')::uuid for update;
  if p.id is null then raise exception 'Puente no disponible';end if;
  if exists(select 1 from public.feria_puentes_rondas where puente_id=p.id) then raise exception 'La ficha ya tiene rondas y no se puede modificar';end if;
  update public.feria_puentes set masa_g=nullif(datos->>'masa_g','')::numeric,
   largo_cm=nullif(datos->>'largo_cm','')::numeric,ancho_cm=nullif(datos->>'ancho_cm','')::numeric,
   prediccion_kg=nullif(datos->>'prediccion_kg','')::numeric,version=version+1,actualizado_en=now() where id=p.id;
 elsif accion='seleccionar' then
  if r.resultado='pendiente' then raise exception 'Resuelve la ronda actual antes de cambiar de puente';end if;
  select * into p from public.feria_puentes where id=(datos->>'puente_id')::uuid;
  if p.id is null or p.estado='finalizado' then raise exception 'Puente no disponible';end if;
  if exists(select 1 from public.feria_puentes where estado='en_prueba' and id<>p.id) then raise exception 'Finaliza el puente en prueba antes de cambiar';end if;
  update public.feria_puentes_mesa set puente_id=p.id,ronda_id=null,operador=auth.uid() where id;
 elsif accion in('iniciar','validar','fallo','cancelar','finalizar','relevar') then
  select * into p from public.feria_puentes where id=m.puente_id;
  if p.id is null or p.estado='finalizado' then raise exception 'Selecciona un puente pendiente';end if;
  if accion='relevar' then
   if r.resultado='pendiente' and clock_timestamp()<r.fin then raise exception 'Espera a que termine la cuenta antes del relevo';end if;
   razon:=trim(coalesce(datos->>'motivo',''));if length(razon)<5 then raise exception 'Indica el motivo del relevo';end if;
   update public.feria_puentes_mesa set operador=auth.uid() where id;
  else
   if m.operador is distinct from auth.uid() then raise exception 'Otra cuenta controla la mesa. Solicita un relevo';end if;
   select * into c from public.feria_puentes_config where categoria=p.categoria;
   if accion='iniciar' then
    if r.resultado='pendiente' then raise exception 'Ya hay una ronda en curso';end if;
    if c.inicial is null or c.incremento is null or c.limite is null or c.separacion is null then raise exception 'Configura primero las cargas de la categoría';end if;
    if p.masa_g is null then raise exception 'Registra el peso del puente en la mesa antes de iniciar, para resolver empates';end if;
    select max(carga_kg) into anterior from public.feria_puentes_rondas where puente_id=p.id and resultado='valida';
    carga:=least(coalesce(anterior+c.incremento,c.inicial),c.limite);
    if anterior>=c.limite then raise exception 'Ya se alcanzó el límite del montaje';end if;
    t:=clock_timestamp();
    insert into public.feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador) values(p.id,(select coalesce(max(numero),0)+1 from public.feria_puentes_rondas where puente_id=p.id),carga,t,t+interval '5 seconds',auth.uid()) returning * into r;
    update public.feria_puentes set estado='en_prueba' where id=p.id;
    update public.feria_puentes_mesa set ronda_id=r.id where id;
   elsif accion in('validar','fallo','cancelar') then
    if r.id is null or r.resultado<>'pendiente' then raise exception 'No hay una ronda pendiente';end if;
    if accion='validar' and clock_timestamp()<r.fin then raise exception 'Espera los cinco segundos completos';end if;
    razon:=trim(coalesce(datos->>'motivo',''));if accion='cancelar' and length(razon)<5 then raise exception 'Indica el motivo de la cancelación';end if;
    update public.feria_puentes_rondas set resultado=case accion when 'validar' then 'valida' when 'fallo' then 'fallo' else 'anulada' end,validado_por=auth.uid(),motivo=nullif(razon,'') where id=r.id;
    if accion='fallo' or (accion='validar' and r.carga_kg>=c.limite) then update public.feria_puentes set estado='finalizado',motivo_fin=case when accion='fallo' then 'Falla del puente' else 'Límite del montaje' end where id=p.id;end if;
   elsif accion='finalizar' then
    if r.resultado='pendiente' then raise exception 'Resuelve la ronda antes de finalizar';end if;
    razon:=trim(coalesce(datos->>'motivo',''));if length(razon)<5 then raise exception 'Indica el motivo de finalización';end if;
    update public.feria_puentes set estado='finalizado',motivo_fin=razon where id=p.id;
   end if;
  end if;
 elsif accion='anular' then
  if r.resultado='pendiente' then raise exception 'Resuelve la ronda actual antes de corregir';end if;
  select * into r from public.feria_puentes_rondas where id=(datos->>'ronda_id')::uuid;
  razon:=trim(coalesce(datos->>'motivo',''));
  if r.id is null or r.resultado not in('valida','fallo') or length(razon)<5 then raise exception 'Selecciona una ronda registrada e indica el motivo de corrección';end if;
  if exists(select 1 from public.feria_puentes pp where pp.id=r.puente_id and pp.estado<>'finalizado') then raise exception 'Finaliza la prueba antes de corregir su historial';end if;
  update public.feria_puentes_rondas set resultado='anulada',motivo=razon,validado_por=auth.uid() where id=r.id;
 else raise exception 'Acción no válida';end if;
 update public.feria_puentes_mesa set version=version+1 where id;
 insert into public.feria_puentes_auditoria(solicitud,actor,accion,datos) values(solicitud_id,auth.uid(),accion,datos);
 return public.feria_puentes_contexto();
end $$;
revoke all on function public.feria_puentes_contexto(),public.feria_puentes_accion(text,jsonb,integer,uuid) from public,anon;
grant execute on function public.feria_puentes_contexto(),public.feria_puentes_accion(text,jsonb,integer,uuid) to authenticated;


-- No depende de perfiles editables, proyectos aprobados ni asesores.
create or replace function public.feria_puentes_estudiante()
returns uuid language sql stable security definer set search_path='' as $$
 select e.id from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo limit 1;
$$;
revoke all on function public.feria_puentes_estudiante() from public,anon,authenticated;

create or replace function public.feria_puentes_estudiantes_grado(grado_elegido integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(coalesce(public.es_profesor(),false) or public.feria_puentes_estudiante() is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 if grado_elegido is null or grado_elegido not between 0 and 8 then raise exception 'Escoge un grupo válido';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.activo and e.grado=grado_elegido),'[]'::jsonb);
end $$;
revoke all on function public.feria_puentes_estudiantes_grado(integer) from public,anon;
grant execute on function public.feria_puentes_estudiantes_grado(integer) to authenticated;

create or replace function public.feria_puentes_inscripcion_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid:=public.feria_puentes_estudiante();
begin
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 return jsonb_build_object('docente',docente,'usuario',auth.uid(),
 'ficha',(select jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) from public.estudiantes e where e.id=ficha),
 'companeros',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e join public.estudiantes f on f.id=ficha where e.activo and e.id<>ficha and (e.grado=f.grado or(e.grado in(7,8) and f.grado in(7,8)))),'[]'::jsonb),
 'puentes',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'bloqueado',exists(select 1 from public.feria_puentes_rondas r where r.puente_id=p.id),
  'equipo',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb)) order by p.actualizado_en desc,p.id)
 from public.feria_puentes p where docente or ficha=any(p.integrantes_ids)),'[]'::jsonb));
end $$;

create or replace function public.feria_puentes_guardar(puente uuid,datos jsonb,version_esperada integer,solicitud_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid:=public.feria_puentes_estudiante();
 p public.feria_puentes;ev public.feria_puentes_auditoria;equipo uuid[];nombres text;cat text;foto text;masa numeric;payload jsonb;
begin
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 if puente is null or solicitud_id is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>20000 then raise exception 'Solicitud no válida';end if;
 perform pg_advisory_xact_lock(20261106,444);
 payload:=jsonb_build_object('puente',puente,'datos',datos);
 select * into ev from public.feria_puentes_auditoria where solicitud=solicitud_id;
 if ev.solicitud is not null then
  if ev.actor<>auth.uid() or ev.accion<>'guardar_inscripcion' or ev.datos<>payload then raise exception 'Identificador de solicitud ya usado';end if;
  return public.feria_puentes_inscripcion_contexto();
 end if;
 select * into p from public.feria_puentes where id=puente for update;
 if p.id is not null and not docente and not coalesce(ficha=any(p.integrantes_ids),false) then raise exception 'Solo el equipo o un docente pueden editar este puente';end if;
 if version_esperada is distinct from coalesce(p.version,0) then raise exception 'La inscripción cambió. Actualiza la lista y vuelve a abrirla';end if;
 if exists(select 1 from public.feria_puentes_rondas where puente_id=puente) then raise exception 'La ficha ya tiene rondas y no se puede modificar';end if;
 if datos-array['titulo','categoria','integrantes_ids','masa_g','foto_path']<>'{}'::jsonb then raise exception 'Campos de inscripción no válidos';end if;
 if jsonb_typeof(datos->'titulo') is distinct from 'string' or length(trim(datos->>'titulo')) not between 1 and 150 then raise exception 'Escribe el nombre del puente (máximo 150 caracteres)';end if;
 cat:=datos->>'categoria';if cat is null or cat not in('puentes_infantil','puentes_juvenil') then raise exception 'Escoge la categoría infantil o juvenil';end if;
 if jsonb_typeof(datos->'integrantes_ids') is distinct from 'array' then raise exception 'Escoge los integrantes de la lista';end if;
 if jsonb_array_length(datos->'integrantes_ids')>100 or exists(select 1 from jsonb_array_elements(datos->'integrantes_ids') x where jsonb_typeof(x) is distinct from 'string' or (x#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Integrantes no válidos';end if;
 select coalesce(array_agg(x::uuid),'{}'::uuid[]) into equipo from jsonb_array_elements_text(datos->'integrantes_ids') x;
 if not docente and not(ficha=any(equipo)) then equipo:=array_prepend(ficha,equipo);end if;
 if cardinality(equipo)=0 or cardinality(equipo)<>(select count(distinct x) from unnest(equipo) x) then raise exception 'Escoge al menos un estudiante, sin repetir integrantes';end if;
 if exists(select 1 from unnest(equipo) x where not exists(select 1 from public.estudiantes e where e.id=x and e.activo)) then raise exception 'Solo se pueden inscribir estudiantes activos del colegio';end if;
 select string_agg(e.nombre||' · '||case when e.grado=0 then 'TS y JR' else e.grado||'°' end,E'\n' order by e.nombre,e.id) into nombres from public.estudiantes e where e.id=any(equipo);
 masa:=nullif(datos->>'masa_g','')::numeric;
 if masa is not null and (masa<=0 or masa='NaN'::numeric or masa>9999999.999) then raise exception 'El peso debe ser positivo y estar expresado en gramos';end if;
 foto:=nullif(datos->>'foto_path','');
 if foto is not null and foto is distinct from p.foto_path and (
  split_part(foto,'/',1) is distinct from auth.uid()::text or split_part(foto,'/',2) is distinct from puente::text or
  not exists(select 1 from storage.objects where bucket_id='feria-puentes-fotos' and name=foto)) then raise exception 'La foto no está disponible para esta inscripción';end if;
 if p.id is null then
  insert into public.feria_puentes(id,origen,categoria,titulo,integrantes,integrantes_ids,masa_g,foto_path,creado_por)
  values(puente,'claudina',cat,trim(datos->>'titulo'),nombres,equipo,masa,foto,auth.uid());
 else
  update public.feria_puentes set titulo=trim(datos->>'titulo'),categoria=cat,integrantes=nombres,integrantes_ids=equipo,masa_g=masa,foto_path=foto,version=version+1,actualizado_en=now() where id=puente;
 end if;
 update public.feria_puentes_mesa set version=version+1 where id;
 insert into public.feria_puentes_auditoria(solicitud,actor,accion,datos) values(solicitud_id,auth.uid(),'guardar_inscripcion',payload);
 return public.feria_puentes_inscripcion_contexto();
end $$;
revoke all on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_guardar(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_guardar(uuid,jsonb,integer,uuid) to authenticated;

-- Fotos privadas: sin enlaces públicos ni posibilidad de sobrescribir un objeto.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feria-puentes-fotos','feria-puentes-fotos',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create or replace function public.feria_puentes_foto_visible(ruta text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (coalesce(public.es_profesor(),false) or exists(
  select 1 from public.feria_puentes p where p.foto_path=ruta and public.feria_puentes_estudiante()=any(p.integrantes_ids)) or
  (split_part(ruta,'/',1)=auth.uid()::text and public.feria_puentes_estudiante() is not null));
$$;
create or replace function public.feria_puentes_foto_sin_uso(ruta text)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.feria_puentes where foto_path=ruta);
$$;
-- Wrapper autorizado para políticas de subida, sin exponer la ficha interna.
create or replace function public.feria_puentes_puede_inscribir()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (coalesce(public.es_profesor(),false) or public.feria_puentes_estudiante() is not null);
$$;
revoke all on function public.feria_puentes_foto_visible(text),public.feria_puentes_foto_sin_uso(text),public.feria_puentes_puede_inscribir() from public,anon;
grant execute on function public.feria_puentes_foto_visible(text),public.feria_puentes_foto_sin_uso(text),public.feria_puentes_puede_inscribir() to authenticated;
drop policy if exists puentes_foto_lectura on storage.objects;
create policy puentes_foto_lectura on storage.objects for select to authenticated using(bucket_id='feria-puentes-fotos' and public.feria_puentes_foto_visible(name));
drop policy if exists puentes_foto_subida on storage.objects;
create policy puentes_foto_subida on storage.objects for insert to authenticated with check(bucket_id='feria-puentes-fotos' and split_part(name,'/',1)=auth.uid()::text and public.feria_puentes_puede_inscribir());
drop policy if exists puentes_foto_borrador on storage.objects;
create policy puentes_foto_borrador on storage.objects for delete to authenticated using(bucket_id='feria-puentes-fotos' and split_part(name,'/',1)=auth.uid()::text and public.feria_puentes_foto_sin_uso(name));
notify pgrst,'reload schema';
commit;
