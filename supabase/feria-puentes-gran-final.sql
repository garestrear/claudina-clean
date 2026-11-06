-- Ejecutar después de las migraciones actuales de puentes (incluida orden-turnos).
-- Conserva íntegros los registros eliminatorios. No inicia la final hasta confirmarla.
begin;
alter table public.feria_puentes add column if not exists fase text not null default 'eliminatoria' check(fase in('eliminatoria','final'));
alter table public.feria_puentes add column if not exists puente_eliminatoria_id uuid unique references public.feria_puentes(id);
alter table public.feria_puentes add column if not exists puesto_clasificacion integer;
alter table public.feria_puentes drop constraint if exists feria_puentes_fase_origen_check;
alter table public.feria_puentes add constraint feria_puentes_fase_origen_check check((fase='final')=(puente_eliminatoria_id is not null));
alter table public.feria_puentes_mesa add column if not exists fase text not null default 'eliminatoria' check(fase in('eliminatoria','final'));
-- Renombra una sola vez las funciones instaladas para conservar duración, masa y demás reglas.
do $$ begin
 if to_regprocedure('public.feria_puentes_contexto_sin_fases()') is null then
  alter function public.feria_puentes_contexto() rename to feria_puentes_contexto_sin_fases;
  alter function public.feria_puentes_accion(text,jsonb,integer,uuid) rename to feria_puentes_accion_sin_fases;
  alter function public.feria_puentes_inscripcion_contexto() rename to feria_puentes_inscripcion_contexto_sin_fases;
 end if;
end $$;
create or replace function public.feria_puentes_contexto() returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; fase_actual text; ids uuid[];
begin
 ctx:=public.feria_puentes_contexto_sin_fases();
 select fase into fase_actual from public.feria_puentes_mesa where id;
 select coalesce(array_agg(id),'{}'::uuid[]) into ids from public.feria_puentes where fase=fase_actual;
 return ctx||jsonb_build_object('fases',true,'fase',fase_actual,'final_preparada',exists(select 1 from public.feria_puentes where fase='final'),
 'puentes',coalesce((select jsonb_agg(p) from jsonb_array_elements(ctx->'puentes') p where (p->>'id')::uuid=any(ids)),'[]'::jsonb),
 'rondas',coalesce((select jsonb_agg(r) from jsonb_array_elements(ctx->'rondas') r where (r->>'puente_id')::uuid=any(ids)),'[]'::jsonb));
end $$;
create or replace function public.feria_puentes_inscripcion_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;
begin
 ctx:=public.feria_puentes_inscripcion_contexto_sin_fases();
 return ctx||jsonb_build_object('puentes',coalesce((select jsonb_agg(p) from jsonb_array_elements(ctx->'puentes') p where p->>'fase'='eliminatoria'),'[]'::jsonb));
end $$;
-- Después de preparar la final, la eliminatoria queda como archivo de consulta.
create or replace function public.feria_puentes_proteger_eliminatoria() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final') then raise exception 'La eliminatoria está cerrada';end if;return new;
 end if;
 if old.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final') then raise exception 'La eliminatoria está cerrada; sus resultados se conservan';end if;
 if tg_op='DELETE' and old.fase='final' then raise exception 'Los finalistas no se eliminan; usa finalizar o descalificar para conservar el historial';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists feria_puentes_archivo on public.feria_puentes;
create trigger feria_puentes_archivo before insert or update or delete on public.feria_puentes for each row execute function public.feria_puentes_proteger_eliminatoria();
create or replace function public.feria_puentes_proteger_rondas() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if tg_op='INSERT' then pid:=new.puente_id;else pid:=old.puente_id;end if;
 if exists(select 1 from public.feria_puentes where id=pid and fase='eliminatoria') and exists(select 1 from public.feria_puentes where fase='final') then raise exception 'La eliminatoria está cerrada; sus intentos se conservan';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists feria_puentes_rondas_archivo on public.feria_puentes_rondas;
create trigger feria_puentes_rondas_archivo before insert or update or delete on public.feria_puentes_rondas for each row execute function public.feria_puentes_proteger_rondas();
create or replace function public.feria_puentes_candidatos_final() returns table(puente_id uuid,categoria text,total numeric,masa_g numeric,orden bigint) language sql stable security definer set search_path='' as $$
 with marcas as (
 select p.id,p.categoria,p.masa_g,p.titulo,coalesce(sum(r.carga_kg) filter(where r.resultado='valida'),0) total
 from public.feria_puentes p join public.feria_puentes_rondas r on r.puente_id=p.id
 where p.fase='eliminatoria' and p.estado<>'descalificado'
 group by p.id having bool_or(r.resultado in('valida','fallo')))
 select id,categoria,total,masa_g,row_number() over(partition by categoria order by total desc,masa_g asc nulls last,titulo,id) from marcas;
$$;
revoke all on function public.feria_puentes_candidatos_final() from public,anon,authenticated;
create or replace function public.feria_puentes_accion(accion text,datos jsonb,version_esperada integer,solicitud_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.feria_puentes_mesa;ev public.feria_puentes_auditoria;destino text;pid uuid;cantidad integer;
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
 if accion in('preparar-final','fase') then
  if exists(select 1 from public.feria_puentes_rondas where resultado='pendiente') then raise exception 'Resuelve el intento en curso antes de cambiar de fase';end if;
  if accion='preparar-final' then
   if not exists(select 1 from public.feria_puentes where fase='final') then
    -- Verifica cupos y empates ANTES de crear la primera ficha finalista.
    for destino,cantidad in values('puentes_juvenil',5),('puentes_infantil',6) loop
     if (select count(*) from public.feria_puentes_candidatos_final() c where c.categoria=destino)<cantidad then raise exception 'No hay suficientes puentes evaluados para completar los cupos de %',destino;end if;
     if exists(select 1 from public.feria_puentes_candidatos_final() a join public.feria_puentes_candidatos_final() b on a.categoria=b.categoria and a.total=b.total
       where a.categoria=destino and a.orden<=cantidad and b.orden>cantidad
       and (a.masa_g is null or b.masa_g is null or a.masa_g=b.masa_g)) then raise exception 'Resuelve el empate en el corte de clasificación de % antes de preparar la final (revisa las masas)',destino;end if;
    end loop;
    insert into public.feria_puentes(origen,proyecto_id,categoria,titulo,integrantes,codigo,masa_g,largo_cm,ancho_cm,prediccion_kg,estado,creado_por,integrantes_ids,foto_path,fase,puente_eliminatoria_id,puesto_clasificacion)
    select p.origen,null,p.categoria,p.titulo,p.integrantes,p.codigo,p.masa_g,p.largo_cm,p.ancho_cm,p.prediccion_kg,'pendiente',p.creado_por,p.integrantes_ids,p.foto_path,'final',p.id,c.orden
    from public.feria_puentes_candidatos_final() c join public.feria_puentes p on p.id=c.puente_id
    where c.orden<=case c.categoria when 'puentes_juvenil' then 5 else 6 end;
   end if;
   destino:='final';
  else destino:=datos->>'fase';end if;
  if destino is null or destino not in('eliminatoria','final') then raise exception 'Fase no válida';end if;
  if destino='final' and not exists(select 1 from public.feria_puentes where fase='final') then raise exception 'Prepara primero la gran final';end if;
  update public.feria_puentes_mesa set fase=destino,puente_id=null,ronda_id=null,operador=null,version=version+1 where id;
  insert into public.feria_puentes_auditoria(solicitud,actor,accion,datos) values(solicitud_id,auth.uid(),accion,datos);
  return public.feria_puentes_contexto();
 end if;
 if m.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final') then raise exception 'La eliminatoria está cerrada. Cambia a Gran final para registrar pruebas';end if;
 pid:=coalesce(nullif(datos->>'puente_id','')::uuid,m.puente_id);
 if accion='anular' then select puente_id into pid from public.feria_puentes_rondas where id=(datos->>'ronda_id')::uuid;end if;
 if pid is not null and not exists(select 1 from public.feria_puentes where id=pid and fase=m.fase) then raise exception 'El puente no pertenece a la fase activa';end if;
 return public.feria_puentes_accion_sin_fases(accion,datos,version_esperada,solicitud_id);
end $$;
revoke all on function public.feria_puentes_contexto_sin_fases(),public.feria_puentes_accion_sin_fases(text,jsonb,integer,uuid),public.feria_puentes_inscripcion_contexto_sin_fases() from public,anon,authenticated;
revoke all on function public.feria_puentes_contexto(),public.feria_puentes_accion(text,jsonb,integer,uuid),public.feria_puentes_inscripcion_contexto() from public,anon;
grant execute on function public.feria_puentes_contexto(),public.feria_puentes_accion(text,jsonb,integer,uuid),public.feria_puentes_inscripcion_contexto() to authenticated;
notify pgrst,'reload schema';
commit;
