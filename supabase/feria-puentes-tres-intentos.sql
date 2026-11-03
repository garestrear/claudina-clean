-- Tres intentos por puente: carga libre elegida en cada turno y suma de cargas válidas.
-- Ejecutar DESPUÉS de feria-puentes-inscripcion.sql. Conserva el historial anterior.
-- Las rondas anuladas anteriormente no consumen intento; las nuevas correcciones
-- conservan el intento consumido. Una cancelación de montaje no consume intento.
begin;
alter table public.feria_puentes_rondas add column if not exists cuenta_intento boolean;
update public.feria_puentes_rondas set cuenta_intento=(resultado<>'anulada') where cuenta_intento is null;
alter table public.feria_puentes_rondas alter column cuenta_intento set default true;
alter table public.feria_puentes_rondas alter column cuenta_intento set not null;
-- Libera puentes que esperaban una nueva carga bajo la modalidad anterior.
update public.feria_puentes p set estado=case when (select count(*) from public.feria_puentes_rondas r where r.puente_id=p.id and r.cuenta_intento)>=3 then 'finalizado' else 'pendiente' end,
 motivo_fin=case when (select count(*) from public.feria_puentes_rondas r where r.puente_id=p.id and r.cuenta_intento)>=3 then 'Tres intentos completados' else null end
 where p.estado='en_prueba' and not exists(select 1 from public.feria_puentes_rondas r where r.puente_id=p.id and r.resultado='pendiente');
create or replace function public.feria_puentes_contexto() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden acceder al concurso de puentes';end if;
 return jsonb_build_object('modalidad','tres_intentos','ahora',clock_timestamp(),'usuario',auth.uid(),'config',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.feria_puentes_config c),'mesa',(select to_jsonb(m) from public.feria_puentes_mesa m),'puentes',(select coalesce(jsonb_agg(to_jsonb(p) order by p.titulo),'[]'::jsonb) from public.feria_puentes p),'rondas',(select coalesce(jsonb_agg(to_jsonb(r) order by r.inicio,r.numero),'[]'::jsonb) from public.feria_puentes_rondas r));
end $$;
create or replace function public.feria_puentes_accion(accion text,datos jsonb,version_esperada integer,solicitud_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.feria_puentes_mesa;p public.feria_puentes;r public.feria_puentes_rondas;c public.feria_puentes_config;cat text;carga numeric;anterior numeric;ev public.feria_puentes_auditoria;razon text;t timestamptz;intentos integer;
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
  if exists(select 1 from public.feria_puentes_rondas where resultado='pendiente') then raise exception 'Resuelve el intento en curso antes de cambiar';end if;
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
    select count(*) into intentos from public.feria_puentes_rondas where puente_id=p.id and cuenta_intento;
    if intentos>=3 then raise exception 'El puente ya completó sus tres intentos';end if;
    carga:=nullif(datos->>'carga_kg','')::numeric;
    if carga is null or carga<=0 or carga='NaN'::numeric or carga>c.limite or carga<>round(carga,3) then raise exception 'Escribe una carga positiva, con hasta tres decimales y sin superar el límite del montaje';end if;
    t:=clock_timestamp();
    insert into public.feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador) values(p.id,(select coalesce(max(numero),0)+1 from public.feria_puentes_rondas where puente_id=p.id),carga,t,t+interval '5 seconds',auth.uid()) returning * into r;
    update public.feria_puentes set estado='en_prueba' where id=p.id;
    update public.feria_puentes_mesa set ronda_id=r.id where id;
   elsif accion in('validar','fallo','cancelar') then
    if r.id is null or r.resultado<>'pendiente' then raise exception 'No hay una ronda pendiente';end if;
    if accion='validar' and clock_timestamp()<r.fin then raise exception 'Espera los cinco segundos completos';end if;
    razon:=trim(coalesce(datos->>'motivo',''));if accion='cancelar' and length(razon)<5 then raise exception 'Indica el motivo de la cancelación';end if;
    update public.feria_puentes_rondas set resultado=case accion when 'validar' then 'valida' when 'fallo' then 'fallo' else 'anulada' end,validado_por=auth.uid(),motivo=nullif(razon,'') where id=r.id;
    if accion='cancelar' then update public.feria_puentes_rondas set cuenta_intento=false where id=r.id;end if;
    select count(*) into intentos from public.feria_puentes_rondas where puente_id=p.id and cuenta_intento;
    if intentos>=3 or (accion='fallo' and coalesce((datos->>'roto')::boolean,false)) then
     update public.feria_puentes set estado='finalizado',motivo_fin=case when accion='fallo' and coalesce((datos->>'roto')::boolean,false) then 'Rotura del puente' else 'Tres intentos completados' end where id=p.id;
    else
     update public.feria_puentes set estado='pendiente',motivo_fin=null where id=p.id;
    end if;
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
