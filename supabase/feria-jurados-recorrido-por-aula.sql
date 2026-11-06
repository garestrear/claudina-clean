-- Ejecutar después de feria-jurados-asignacion-automatica.sql.
-- Conserva proyectos asignados y todas las visitas con notas/borradores.
begin;
create or replace function public.feria_costo_recorrido_aulas(jurado uuid,visita_a uuid default null,ronda_a integer default null,visita_b uuid default null,ronda_b integer default null)
returns integer language sql stable security definer set search_path='' as $$
 with cambios as (
  select v.*,case when v.id=visita_a then ronda_a when v.id=visita_b then ronda_b else v.ronda end nueva
  from public.feria_evaluacion_visitas v where v.jurado_id=jurado
 ),salas as (
  select v.nueva,(select r.espacio_id::text from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id and e.activo
   cross join public.feria_evaluacion_config c
   where r.activo and r.origen=v.origen and r.proyecto_id=v.proyecto_id and r.fecha=v.fecha
    and r.inicio<=c.inicio+v.nueva*interval '11 minutes' and r.fin>=c.inicio+v.nueva*interval '11 minutes'+interval '10 minutes'
   order by r.espacio_id limit 1) sala from cambios v
 ),pasos as(select *,lag(sala) over(order by nueva) anterior,lag(nueva) over(order by nueva) anterior_ronda from salas)
 select coalesce(sum(case when anterior_ronda is null then 0 when sala is distinct from anterior or nueva<>anterior_ronda+1 then 1 else 0 end),0)::integer from pasos;
$$;
revoke all on function public.feria_costo_recorrido_aulas(uuid,uuid,integer,uuid,integer) from public,anon,authenticated;

create or replace function public.feria_optimizar_recorridos_aulas()
returns integer language plpgsql security definer set search_path='' as $$
declare j record;par record;a public.feria_evaluacion_visitas;b public.feria_evaluacion_visitas;c public.feria_evaluacion_config;costo integer;cambios integer:=0;
begin
 perform pg_advisory_xact_lock(20261106,333);
 select * into c from public.feria_evaluacion_config where id=true;
 for j in select distinct jurado_id from public.feria_evaluacion_visitas order by jurado_id loop
  loop
   costo:=public.feria_costo_recorrido_aulas(j.jurado_id);exit when costo=0;
   -- Mover a una ronda libre o intercambiar dos visitas del mismo jurado.
   -- Solo se aceptan cambios que reduzcan bloques separados y sin cruces.
   select va.id a_id,vb.id b_id,r.ronda destino into par
   from public.feria_evaluacion_visitas va cross join generate_series(0,9) r(ronda)
   left join public.feria_evaluacion_visitas vb on vb.jurado_id=va.jurado_id and vb.ronda=r.ronda
   where va.jurado_id=j.jurado_id and va.ronda<>r.ronda
    and not exists(select 1 from public.feria_evaluaciones e where e.visita_id=va.id or e.visita_id=vb.id)
    and c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes'<=c.fin
    and not exists(select 1 from public.feria_evaluacion_visitas x where x.id<>va.id and (vb.id is null or x.id<>vb.id) and ((x.origen=va.origen and x.proyecto_id=va.proyecto_id and x.ronda=r.ronda) or (vb.id is not null and x.origen=vb.origen and x.proyecto_id=vb.proyecto_id and x.ronda=va.ronda)))
    and exists(select 1 from public.feria_programacion res join public.feria_espacios e on e.id=res.espacio_id and e.activo where res.activo and res.origen=va.origen and res.proyecto_id=va.proyecto_id and res.fecha=va.fecha and res.inicio<=c.inicio+r.ronda*interval '11 minutes' and res.fin>=c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes')
    and (vb.id is null or exists(select 1 from public.feria_programacion res join public.feria_espacios e on e.id=res.espacio_id and e.activo where res.activo and res.origen=vb.origen and res.proyecto_id=vb.proyecto_id and res.fecha=vb.fecha and res.inicio<=c.inicio+va.ronda*interval '11 minutes' and res.fin>=c.inicio+va.ronda*interval '11 minutes'+interval '10 minutes'))
    and public.feria_costo_recorrido_aulas(j.jurado_id,va.id,r.ronda,vb.id,va.ronda)<costo
   order by public.feria_costo_recorrido_aulas(j.jurado_id,va.id,r.ronda,vb.id,va.ronda),va.ronda,r.ronda limit 1;
   exit when not found;
   select * into a from public.feria_evaluacion_visitas where id=par.a_id;
   select * into b from public.feria_evaluacion_visitas where id=par.b_id;
   -- Reinsertar con los mismos ids evita colisiones transitorias en los índices
   -- únicos. Estas visitas no tienen evaluaciones y todo es transaccional.
   delete from public.feria_evaluacion_visitas where id=a.id or id=b.id;
   if b.id is not null then
    b.ronda:=a.ronda;b.inicio:=c.inicio+b.ronda*interval '11 minutes';b.fin:=b.inicio+interval '10 minutes';
    insert into public.feria_evaluacion_visitas select b.*;
   end if;
   a.ronda:=par.destino;a.inicio:=c.inicio+a.ronda*interval '11 minutes';a.fin:=a.inicio+interval '10 minutes';
   insert into public.feria_evaluacion_visitas select a.*;
   cambios:=cambios+1;
  end loop;
 end loop;
 return cambios;
end $$;
revoke all on function public.feria_optimizar_recorridos_aulas() from public,anon,authenticated;
-- Incorporar la optimización a cada reparto automático futuro, sin reemplazar
-- otras correcciones que ya tenga instalada la función de asignación.
do $$declare d text;begin
 select pg_get_functiondef('public.feria_asignar_jurados_interno()'::regprocedure) into d;
 if position('perform public.feria_optimizar_recorridos_aulas()' in d)=0 then
  if position(' total:=jsonb_array_length(proyectos)*3;' in d)=0 then raise exception 'Actualiza primero feria-jurados-asignacion-automatica.sql';end if;
  d:=replace(d,' total:=jsonb_array_length(proyectos)*3;',' perform public.feria_optimizar_recorridos_aulas(); total:=jsonb_array_length(proyectos)*3;');execute d;
 end if;
end $$;
select public.feria_optimizar_recorridos_aulas() as cambios_de_orden;
update public.feria_evaluacion_config set version=version+1 where id=true;
notify pgrst,'reload schema';
commit;
