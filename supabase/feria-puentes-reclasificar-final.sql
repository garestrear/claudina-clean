-- Ejecutar después de feria-puentes-gran-final.sql. Conserva todos los intentos.
begin;
-- La excepción permite únicamente descalificar con motivo; el resto del archivo
-- eliminatorio y sus intentos permanecen protegidos.
create or replace function public.feria_puentes_proteger_eliminatoria() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final') then raise exception 'La eliminatoria está cerrada';end if;return new;
 end if;
 if old.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final') then
  if tg_op='UPDATE' then
   if coalesce(public.es_profesor(),false) and old.estado<>'descalificado' and new.estado='descalificado'
    and length(trim(coalesce(new.motivo_fin,''))) between 5 and 1000
    and (to_jsonb(new)-array['estado','motivo_fin','version','actualizado_en'])=(to_jsonb(old)-array['estado','motivo_fin','version','actualizado_en']) then return new;end if;
  end if;
  raise exception 'La eliminatoria está cerrada; solo puedes descalificar con motivo y recalcular la final';
 end if;
 if tg_op='DELETE' and old.fase='final' then raise exception 'Los finalistas no se eliminan; se conserva su historial';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
-- Se conserva la validación y la auditoría originales de la descalificación.
do $$begin
 if to_regprocedure('public.feria_puentes_descalificar_sin_recalculo(uuid,integer,uuid,text)') is null then
  alter function public.feria_puentes_descalificar(uuid,integer,uuid,text) rename to feria_puentes_descalificar_sin_recalculo;
 end if;
end $$;
create or replace function public.feria_puentes_descalificar(puente uuid,version_esperada integer,solicitud_id uuid,motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_puentes;destino text;cantidad integer;antes jsonb;recalcular boolean;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden descalificar puentes';end if;
 perform pg_advisory_xact_lock(20261106,444);
 -- El reintento valida actor y petición, sin repetir una reclasificación ya hecha.
 if exists(select 1 from public.feria_puentes_auditoria where solicitud=solicitud_id) then
  return public.feria_puentes_descalificar_sin_recalculo(puente,version_esperada,solicitud_id,motivo);
 end if;
 select * into p from public.feria_puentes where id=puente for update;
 recalcular:=p.fase='eliminatoria' and exists(select 1 from public.feria_puentes where fase='final');
 if recalcular and exists(select 1 from public.feria_puentes_rondas where resultado='pendiente') then raise exception 'Resuelve o cancela la prueba en curso antes de recalcular los finalistas';end if;
 select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) into antes from public.feria_puentes f where f.fase='final';
 perform public.feria_puentes_descalificar_sin_recalculo(puente,version_esperada,solicitud_id,motivo);
 if recalcular then
  -- Cupos y desempates: cualquier error revierte también la descalificación.
  for destino,cantidad in values('puentes_juvenil',5),('puentes_infantil',6) loop
   if (select count(*) from public.feria_puentes_candidatos_final() c where c.categoria=destino)<cantidad then raise exception 'No quedan suficientes puentes evaluados para completar los cupos de %. No se aplicó la descalificación',destino;end if;
   if exists(select 1 from public.feria_puentes_candidatos_final() a join public.feria_puentes_candidatos_final() b on a.categoria=b.categoria and a.total=b.total
    where a.categoria=destino and a.orden<=cantidad and b.orden>cantidad and (a.masa_g is null or b.masa_g is null or a.masa_g=b.masa_g)) then raise exception 'Resuelve el empate en el corte de % antes de recalcular. No se aplicó la descalificación',destino;end if;
  end loop;
  -- Retira de la competencia sin borrar ni sus fichas ni sus intentos finales.
  update public.feria_puentes f set estado='descalificado',motivo_fin='Retirado de la final por descalificación en eliminatoria: '||trim(motivo),version=f.version+1,actualizado_en=now()
  where f.fase='final' and f.estado<>'descalificado' and not exists(select 1 from public.feria_puentes_candidatos_final() c where c.puente_id=f.puente_eliminatoria_id and c.orden<=case c.categoria when 'puentes_juvenil' then 5 else 6 end);
  -- Los nuevos finalistas empiezan de cero. Los que continúan mantienen sus IDs y marcas.
  insert into public.feria_puentes(origen,proyecto_id,categoria,titulo,integrantes,codigo,masa_g,largo_cm,ancho_cm,prediccion_kg,estado,creado_por,integrantes_ids,foto_path,fase,puente_eliminatoria_id,puesto_clasificacion)
  select e.origen,null,e.categoria,e.titulo,e.integrantes,e.codigo,e.masa_g,e.largo_cm,e.ancho_cm,e.prediccion_kg,'pendiente',e.creado_por,e.integrantes_ids,e.foto_path,'final',e.id,c.orden
  from public.feria_puentes_candidatos_final() c join public.feria_puentes e on e.id=c.puente_id
  where c.orden<=case c.categoria when 'puentes_juvenil' then 5 else 6 end
   and not exists(select 1 from public.feria_puentes f where f.puente_eliminatoria_id=e.id);
  update public.feria_puentes f set puesto_clasificacion=c.orden from public.feria_puentes_candidatos_final() c
  where f.fase='final' and f.puente_eliminatoria_id=c.puente_id and c.orden<=case c.categoria when 'puentes_juvenil' then 5 else 6 end and f.puesto_clasificacion is distinct from c.orden;
  update public.feria_puentes_mesa m set puente_id=null,ronda_id=null,operador=null where m.id and exists(select 1 from public.feria_puentes f where f.id=m.puente_id and f.estado='descalificado');
  update public.feria_puentes_auditoria set datos=datos||jsonb_build_object('final_antes',antes,'final_despues',(select jsonb_agg(to_jsonb(f)) from public.feria_puentes f where f.fase='final')) where solicitud=solicitud_id;
 end if;
 return public.feria_puentes_inscripcion_contexto();
end $$;
revoke all on function public.feria_puentes_descalificar_sin_recalculo(uuid,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.feria_puentes_descalificar(uuid,integer,uuid,text) from public,anon;
grant execute on function public.feria_puentes_descalificar(uuid,integer,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
