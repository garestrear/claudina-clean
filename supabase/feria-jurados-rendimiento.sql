-- Corrige el timeout al registrar jurados. Ejecutar después de la asignación automática.
-- No borra jurados, notas ni borradores. No ejecuta un reparto al instalarse.
begin;
create or replace function public.feria_asignar_jurados_interno()
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.feria_evaluacion_config;proyectos jsonb;candidato record;agregadas integer:=0;faltantes integer;total integer;
begin
 perform pg_advisory_xact_lock(20261106,333);
 select * into c from public.feria_evaluacion_config where id=true for update;
 if not coalesce(c.asignacion_automatica,false) then return jsonb_build_object('automatica',false);end if;
 select coalesce(jsonb_agg(p),'[]'::jsonb) into proyectos from jsonb_array_elements(public.feria_evaluacion_proyectos()) p
 where p->>'origen'='claudina' and p->>'categoria'<>'familias' and coalesce(p->>'titulo','') !~* '^\[Emprendimiento familiar\]';
 -- Materializar una sola vez los datos y la ocupación; no recalcular cientos
 -- de conteos y reservas por cada candidato de cada visita.
 drop table if exists pg_temp.feria_reparto_p;
 drop table if exists pg_temp.feria_reparto_j;
 drop table if exists pg_temp.feria_reparto_pares;
 delete from public.feria_evaluacion_visitas v where not exists(select 1 from public.feria_evaluaciones e where e.visita_id=v.id);
 create temporary table feria_reparto_p on commit drop as
 select p->>'origen' origen,(p->>'id')::uuid id,p,
  (select count(*)::integer from public.feria_evaluacion_visitas v where v.origen=p->>'origen' and v.proyecto_id=(p->>'id')::uuid) n,
  coalesce((select bit_or(1<<v.ronda) from public.feria_evaluacion_visitas v where v.origen=p->>'origen' and v.proyecto_id=(p->>'id')::uuid),0) ocupadas,
  coalesce((select bit_or(1<<r.ronda) from generate_series(0,9) r(ronda) where c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes'<=c.fin
   and exists(select 1 from public.feria_programacion res join public.feria_espacios e on e.id=res.espacio_id and e.activo where res.activo and res.origen=p->>'origen' and res.proyecto_id=(p->>'id')::uuid and res.fecha=c.fecha and res.inicio<=c.inicio+r.ronda*interval '11 minutes' and res.fin>=c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes')),0) disponibles
 from jsonb_array_elements(proyectos)p;
 create unique index on feria_reparto_p(origen,id);
 create temporary table feria_reparto_j on commit drop as
 select j.id,j.areas,j.conflictos,
  array(select u.id from auth.users u where u.id=nullif(to_jsonb(j)->>'cuenta_id','')::uuid or lower(trim(u.email))=lower(trim(j.correo))) cuentas,
  (select count(*)::integer from public.feria_evaluacion_visitas v where v.jurado_id=j.id) n,
  coalesce((select bit_or(1<<v.ronda) from public.feria_evaluacion_visitas v where v.jurado_id=j.id),0) ocupadas
 from public.feria_jurados j where j.habilitado;
 create unique index on feria_reparto_j(id);
 create temporary table feria_reparto_pares on commit drop as
 select p.origen,p.id proyecto,j.id jurado,
  (select count(*)::integer from jsonb_array_elements_text(coalesce(p.p->'areas','[]'::jsonb)) a where a=any(j.areas)) afinidad
 from pg_temp.feria_reparto_p p cross join pg_temp.feria_reparto_j j
 where not ((p.origen||':'||p.id)=any(j.conflictos))
  and not (coalesce(nullif(p.p->>'asesor_id','')::uuid=any(j.cuentas),false) or coalesce(nullif(p.p->>'autor_id','')::uuid=any(j.cuentas),false))
  and not exists(select 1 from public.feria_evaluacion_visitas v where v.jurado_id=j.id and v.origen=p.origen and v.proyecto_id=p.id);
 create index on feria_reparto_pares(jurado,origen,proyecto);
 loop
  select x.*,r.ronda into candidato from pg_temp.feria_reparto_pares x
  join pg_temp.feria_reparto_p p on p.origen=x.origen and p.id=x.proyecto
  join pg_temp.feria_reparto_j j on j.id=x.jurado cross join generate_series(0,9)r(ronda)
  where p.n<3 and j.n<10 and (p.disponibles & ~p.ocupadas & ~j.ocupadas & (1<<r.ronda))<>0
  order by p.n,j.n,x.afinidad desc,r.ronda,x.proyecto,x.jurado limit 1;
  exit when not found;
  insert into public.feria_evaluacion_visitas(jurado_id,origen,proyecto_id,ronda,fecha,inicio,fin)
  values(candidato.jurado,candidato.origen,candidato.proyecto,candidato.ronda,c.fecha,c.inicio+candidato.ronda*interval '11 minutes',c.inicio+candidato.ronda*interval '11 minutes'+interval '10 minutes');
  update pg_temp.feria_reparto_p set n=n+1,ocupadas=ocupadas|(1<<candidato.ronda) where origen=candidato.origen and id=candidato.proyecto;
  update pg_temp.feria_reparto_j set n=n+1,ocupadas=ocupadas|(1<<candidato.ronda) where id=candidato.jurado;
  delete from pg_temp.feria_reparto_pares where jurado=candidato.jurado and origen=candidato.origen and proyecto=candidato.proyecto;
  agregadas:=agregadas+1;
 end loop;
 -- La optimización también utiliza datos en memoria, sin consultas por cada permutación.
 if to_regprocedure('public.feria_optimizar_recorridos_aulas()') is not null then perform public.feria_optimizar_recorridos_aulas();end if;
 total:=jsonb_array_length(proyectos)*3;
 select coalesce(sum(greatest(0,3-n)),0) into faltantes from pg_temp.feria_reparto_p;
 update public.feria_evaluacion_config set version=version+1 where id=true;
 return jsonb_build_object('automatica',true,'visitas_repartidas',agregadas,'visitas_objetivo',total,'pendientes',faltantes);
end $$;
revoke all on function public.feria_asignar_jurados_interno() from public,anon,authenticated;

create or replace function public.feria_optimizar_recorridos_aulas()
returns integer language plpgsql security definer set search_path='' as $$
declare j record;v record;res record;c public.feria_evaluacion_config;
 ids uuid[];originales integer[];orden integer[];prueba integer[];mejor integer[];permitidas integer[];salas text[][];fijas boolean[];
 i integer;a integer;b integer;k integer;ia integer;ib integer;prev integer;prev_r integer;coste integer;mejor_coste integer;coste_prueba integer;cambios integer:=0;cantidad integer;
 fila public.feria_evaluacion_visitas;
begin
 perform pg_advisory_xact_lock(20261106,333);
 select * into c from public.feria_evaluacion_config where id=true;
 drop table if exists pg_temp.feria_ruta_movidas;
 create temporary table feria_ruta_movidas (like public.feria_evaluacion_visitas including defaults) on commit drop;
 for j in select distinct jurado_id from public.feria_evaluacion_visitas order by jurado_id loop
  ids:=array[]::uuid[];originales:=array[]::integer[];orden:=array_fill(0,array[10]);permitidas:=array_fill(0,array[10]);salas:=array_fill(''::text,array[10,10]);fijas:=array_fill(false,array[10]);cantidad:=0;
  -- Como máximo diez visitas: construir disponibilidad una vez por visita.
  for v in select vv.*,exists(select 1 from public.feria_evaluaciones e where e.visita_id=vv.id) fija from public.feria_evaluacion_visitas vv where vv.jurado_id=j.jurado_id order by vv.ronda loop
   cantidad:=cantidad+1;i:=cantidad;ids:=array_append(ids,v.id);originales:=array_append(originales,v.ronda);orden[v.ronda+1]:=i;fijas[i]:=v.fija;
   for res in select r.ronda,min(pr.espacio_id::text) sala from generate_series(0,9) r(ronda)
    join public.feria_programacion pr on pr.activo and pr.origen=v.origen and pr.proyecto_id=v.proyecto_id and pr.fecha=v.fecha and pr.inicio<=c.inicio+r.ronda*interval '11 minutes' and pr.fin>=c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes'
    join public.feria_espacios esp on esp.id=pr.espacio_id and esp.activo
    where c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes'<=c.fin
     and not exists(select 1 from public.feria_evaluacion_visitas x where x.jurado_id<>j.jurado_id and x.origen=v.origen and x.proyecto_id=v.proyecto_id and x.ronda=r.ronda)
    group by r.ronda loop
    salas[i][res.ronda+1]:=res.sala;permitidas[i]:=permitidas[i]|(1<<res.ronda);
   end loop;
   -- Si la reserva cambió, una visita con notas sigue anclada a su horario.
   if v.fija then permitidas[i]:=1<<v.ronda;end if;
  end loop;
  loop
   coste:=0;prev:=0;prev_r:=0;
   for k in 1..10 loop
    if orden[k]>0 then
     if prev>0 and (salas[orden[k]][k] is distinct from salas[prev][prev_r] or k<>prev_r+1) then coste:=coste+1;end if;
     prev:=orden[k];prev_r:=k;
    end if;
   end loop;
   mejor_coste:=coste;mejor:=orden;
   -- Evaluar intercambios en arrays: no recorrer tablas ni repetir reservas.
   for a in 1..10 loop
    ia:=orden[a];continue when ia=0 or fijas[ia];
    for b in 1..10 loop
     ib:=orden[b];continue when a=b or (ib>0 and fijas[ib]);
     continue when (permitidas[ia] & (1<<(b-1)))=0 or (ib>0 and (permitidas[ib] & (1<<(a-1)))=0);
     prueba:=orden;prueba[a]:=ib;prueba[b]:=ia;coste_prueba:=0;prev:=0;prev_r:=0;
     for k in 1..10 loop
      if prueba[k]>0 then
       if prev>0 and (salas[prueba[k]][k] is distinct from salas[prev][prev_r] or k<>prev_r+1) then coste_prueba:=coste_prueba+1;end if;
       prev:=prueba[k];prev_r:=k;
      end if;
     end loop;
     if coste_prueba<mejor_coste then mejor_coste:=coste_prueba;mejor:=prueba;end if;
    end loop;
   end loop;
   exit when mejor_coste>=coste;orden:=mejor;cambios:=cambios+1;
  end loop;
  -- Guardar solo al terminar; cada movimiento conserva el id y todos sus datos.
  for i in 1..cantidad loop
   a:=array_position(orden,i)-1;
   if a<>originales[i] then
    select * into fila from public.feria_evaluacion_visitas where id=ids[i];
    -- Posponer inserciones hasta haber retirado todas las visitas que se mueven.
    fila.ronda:=a;fila.inicio:=c.inicio+a*interval '11 minutes';fila.fin:=fila.inicio+interval '10 minutes';
    insert into pg_temp.feria_ruta_movidas select fila.*;
    delete from public.feria_evaluacion_visitas where id=ids[i] and not exists(select 1 from public.feria_evaluaciones e where e.visita_id=ids[i]);
   end if;
  end loop;
  if to_regclass('pg_temp.feria_ruta_movidas') is not null then
   insert into public.feria_evaluacion_visitas select * from pg_temp.feria_ruta_movidas;
   delete from pg_temp.feria_ruta_movidas;
  end if;
 end loop;
 return cambios;
end $$;
revoke all on function public.feria_optimizar_recorridos_aulas() from public,anon,authenticated;
-- Un UPSERT dispara eventos de INSERT y UPDATE de sentencia. Usar el cambio
-- real de la fila evita repartir dos veces y omite actualizaciones sin cambios.
create or replace function public.feria_jurados_repartir_cambio_real()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' and new.habilitado is not distinct from old.habilitado
  and new.areas is not distinct from old.areas and new.conflictos is not distinct from old.conflictos
  and new.cuenta_id is not distinct from old.cuenta_id then return null;end if;
 perform public.feria_asignar_jurados_interno();return null;
end $$;
revoke all on function public.feria_jurados_repartir_cambio_real() from public,anon,authenticated;
drop trigger if exists feria_jurados_auto_asignar on public.feria_jurados;
create trigger feria_jurados_auto_asignar after insert or update of habilitado,areas,conflictos,cuenta_id on public.feria_jurados for each row execute function public.feria_jurados_repartir_cambio_real();
notify pgrst,'reload schema';
commit;
