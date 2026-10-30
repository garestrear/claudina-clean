-- Requiere feria-evaluacion-jurados.sql. Repetible; conserva los registros.
begin;
create table if not exists public.feria_puentes_config(categoria text primary key check(categoria in('puentes_infantil','puentes_juvenil')),inicial numeric(10,3),incremento numeric(10,3),limite numeric(10,3),separacion numeric(8,2),check(inicial>0 and incremento>0 and limite>=inicial and separacion>0 and inicial<>'NaN'::numeric and incremento<>'NaN'::numeric and limite<>'NaN'::numeric and separacion<>'NaN'::numeric));
insert into public.feria_puentes_config(categoria) values('puentes_infantil'),('puentes_juvenil') on conflict do nothing;
create table if not exists public.feria_puentes(id uuid primary key default gen_random_uuid(),origen text not null check(origen in('claudina','invitados')),proyecto_id uuid not null,categoria text not null references public.feria_puentes_config(categoria),titulo text not null,integrantes text not null default '',codigo text not null default '',masa_g numeric(10,3) not null check(masa_g>0 and masa_g<>'NaN'::numeric),largo_cm numeric(8,2) not null check(largo_cm>0 and largo_cm<>'NaN'::numeric),ancho_cm numeric(8,2) not null check(ancho_cm>0 and ancho_cm<>'NaN'::numeric),prediccion_kg numeric(10,3) check(prediccion_kg>=0 and prediccion_kg<>'NaN'::numeric),estado text not null default 'pendiente' check(estado in('pendiente','en_prueba','finalizado')),motivo_fin text,creado_por uuid not null,unique(origen,proyecto_id));
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
 return jsonb_build_object('ahora',clock_timestamp(),'usuario',auth.uid(),'config',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.feria_puentes_config c),'mesa',(select to_jsonb(m) from public.feria_puentes_mesa m),'puentes',(select coalesce(jsonb_agg(to_jsonb(p) order by p.titulo),'[]'::jsonb) from public.feria_puentes p),'rondas',(select coalesce(jsonb_agg(to_jsonb(r) order by r.inicio,r.numero),'[]'::jsonb) from public.feria_puentes_rondas r),'proyectos',public.feria_evaluacion_proyectos());
end $$;
create or replace function public.feria_puentes_accion(accion text,datos jsonb,version_esperada integer,solicitud_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.feria_puentes_mesa;p public.feria_puentes;r public.feria_puentes_rondas;c public.feria_puentes_config;proyecto jsonb;cat text;carga numeric;anterior numeric;ev public.feria_puentes_auditoria;razon text;t timestamptz;
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
  select value into proyecto from jsonb_array_elements(public.feria_evaluacion_proyectos()) where value->>'origen'=datos->>'origen' and value->>'id'=datos->>'proyecto_id';
  if proyecto is null then raise exception 'Selecciona un proyecto aprobado';end if;
  cat:=datos->>'categoria';if cat not in('puentes_infantil','puentes_juvenil') or cat is null then raise exception 'Categoría no válida';end if;
  if nullif(datos->>'masa_g','')::numeric is null or nullif(datos->>'largo_cm','')::numeric is null or nullif(datos->>'ancho_cm','')::numeric is null then raise exception 'Completa masa y dimensiones';end if;
  if exists(select 1 from public.feria_puentes pp join public.feria_puentes_rondas rr on rr.puente_id=pp.id where pp.origen=datos->>'origen' and pp.proyecto_id=(datos->>'proyecto_id')::uuid) then raise exception 'La ficha ya tiene rondas y no se puede modificar';end if;
  insert into public.feria_puentes(origen,proyecto_id,categoria,titulo,integrantes,codigo,masa_g,largo_cm,ancho_cm,prediccion_kg,creado_por)
  values(datos->>'origen',(datos->>'proyecto_id')::uuid,cat,proyecto->>'titulo',coalesce(proyecto->>'integrantes',''),coalesce(proyecto->>'codigo',''),(datos->>'masa_g')::numeric,(datos->>'largo_cm')::numeric,(datos->>'ancho_cm')::numeric,nullif(datos->>'prediccion_kg','')::numeric,auth.uid())
  on conflict(origen,proyecto_id) do update set categoria=excluded.categoria,titulo=excluded.titulo,integrantes=excluded.integrantes,codigo=excluded.codigo,masa_g=excluded.masa_g,largo_cm=excluded.largo_cm,ancho_cm=excluded.ancho_cm,prediccion_kg=excluded.prediccion_kg;
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
    if not exists(select 1 from jsonb_array_elements(public.feria_evaluacion_proyectos()) x where x->>'origen'=p.origen and x->>'id'=p.proyecto_id::text) then raise exception 'El proyecto ya no está aprobado';end if;
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
notify pgrst,'reload schema';
commit;
