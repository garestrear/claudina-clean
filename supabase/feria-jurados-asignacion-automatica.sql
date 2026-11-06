-- Ejecutar después de feria-evaluacion-jurados.sql y feria-jurados-cuentas.sql.
-- Asigna los inscritos actuales y los nuevos, sin crear contraseñas ni enviar correos.
begin;
-- La primera activación incluye a todos los jurados ya inscritos. Reejecutar
-- este archivo no vuelve a habilitar a quienes después sean deshabilitados.
do $$begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='feria_evaluacion_config' and column_name='asignacion_automatica') then
  alter table public.feria_evaluacion_config add column asignacion_automatica boolean not null default true;
  update public.feria_jurados set habilitado=true;
 end if;
end $$;
alter table public.feria_jurados add column if not exists cuenta_id uuid unique references auth.users(id) on delete set null;
alter table public.feria_jurados alter column habilitado set default true;

create or replace function public.feria_asignar_jurados_interno()
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.feria_evaluacion_config;proyectos jsonb;candidato record;agregadas integer:=0;faltantes integer;total integer;
begin
 perform pg_advisory_xact_lock(20261106,333);
 select * into c from public.feria_evaluacion_config for update;
 if not coalesce(c.asignacion_automatica,false) then return jsonb_build_object('automatica',false);end if;
 -- Solo proyectos estudiantiles evaluables. Los invitados y los
 -- emprendimientos familiares participan en la feria sin jurados.
 select coalesce(jsonb_agg(p),'[]'::jsonb) into proyectos
 from jsonb_array_elements(public.feria_evaluacion_proyectos()) p
 where p->>'origen'='claudina' and p->>'categoria'<>'familias'
 and coalesce(p->>'titulo','') !~* '^\[Emprendimiento familiar\]';
 -- Redistribuye únicamente las visitas sin notas. Los borradores y las
 -- evaluaciones definitivas conservan su id, jurado, horario y contenido.
 delete from public.feria_evaluacion_visitas v where not exists(select 1 from public.feria_evaluaciones e where e.visita_id=v.id);
 loop
  select p.value as proyecto,j.id as jurado_id,r.ronda,
   c.inicio+r.ronda*interval '11 minutes' as inicio into candidato
  from jsonb_array_elements(proyectos) p(value)
  cross join public.feria_jurados j
  cross join generate_series(0,9) r(ronda)
  where j.habilitado
   and c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes'<=c.fin
   and (select count(*) from public.feria_evaluacion_visitas x where x.origen=p.value->>'origen' and x.proyecto_id=(p.value->>'id')::uuid)<3
   and not exists(select 1 from public.feria_evaluacion_visitas x where x.jurado_id=j.id and (x.ronda=r.ronda or (x.origen=p.value->>'origen' and x.proyecto_id=(p.value->>'id')::uuid)))
   and not exists(select 1 from public.feria_evaluacion_visitas x where x.origen=p.value->>'origen' and x.proyecto_id=(p.value->>'id')::uuid and x.ronda=r.ronda)
   and not (((p.value->>'origen')||':'||(p.value->>'id'))=any(j.conflictos))
   and not exists(select 1 from auth.users u where (u.id=nullif(to_jsonb(j)->>'cuenta_id','')::uuid or lower(trim(u.email))=lower(trim(j.correo))) and (u.id=nullif(p.value->>'asesor_id','')::uuid or u.id=nullif(p.value->>'autor_id','')::uuid))
   and exists(select 1 from public.feria_programacion reserva join public.feria_espacios espacio on espacio.id=reserva.espacio_id and espacio.activo
    where reserva.activo and reserva.origen=p.value->>'origen' and reserva.proyecto_id=(p.value->>'id')::uuid and reserva.fecha=c.fecha
    and reserva.inicio<=c.inicio+r.ronda*interval '11 minutes' and reserva.fin>=c.inicio+r.ronda*interval '11 minutes'+interval '10 minutes')
  order by
   -- Primero cubrir proyectos con menos visitas; después equilibrar cargas.
   (select count(*) from public.feria_evaluacion_visitas x where x.origen=p.value->>'origen' and x.proyecto_id=(p.value->>'id')::uuid),
   (select count(*) from public.feria_evaluacion_visitas x where x.jurado_id=j.id),
   (select count(*) from jsonb_array_elements_text(coalesce(p.value->'areas','[]'::jsonb)) a where a=any(j.areas)) desc,
   r.ronda,p.value->>'id',j.id limit 1;
  exit when not found;
  insert into public.feria_evaluacion_visitas(jurado_id,origen,proyecto_id,ronda,fecha,inicio,fin)
  values(candidato.jurado_id,candidato.proyecto->>'origen',(candidato.proyecto->>'id')::uuid,candidato.ronda,c.fecha,candidato.inicio,candidato.inicio+interval '10 minutes');
  agregadas:=agregadas+1;
 end loop;
 total:=jsonb_array_length(proyectos)*3;
 select coalesce(sum(greatest(0,3-(select count(*) from public.feria_evaluacion_visitas v where v.origen=p->>'origen' and v.proyecto_id=(p->>'id')::uuid))),0) into faltantes from jsonb_array_elements(proyectos)p;
 update public.feria_evaluacion_config set version=version+1;
 return jsonb_build_object('automatica',true,'visitas_repartidas',agregadas,'visitas_objetivo',total,'pendientes',faltantes);
end $$;
revoke all on function public.feria_asignar_jurados_interno() from public,anon,authenticated;

create or replace function public.feria_jurados_asignar_automaticamente()
returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden actualizar las asignaciones';end if;
 return public.feria_asignar_jurados_interno();
end $$;
revoke all on function public.feria_jurados_asignar_automaticamente() from public,anon;
grant execute on function public.feria_jurados_asignar_automaticamente() to authenticated;

create or replace function public.feria_jurados_bloquear_asignacion()
returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(20261106,333);return null;
end $$;
create or replace function public.feria_jurados_auto_asignar()
returns trigger language plpgsql security definer set search_path='' as $$begin
 perform public.feria_asignar_jurados_interno();return null;
end $$;
revoke all on function public.feria_jurados_bloquear_asignacion(),public.feria_jurados_auto_asignar() from public,anon,authenticated;
drop trigger if exists feria_jurados_bloquear_asignacion on public.feria_jurados;
create trigger feria_jurados_bloquear_asignacion before insert or update on public.feria_jurados for each statement execute function public.feria_jurados_bloquear_asignacion();
drop trigger if exists feria_jurados_auto_asignar on public.feria_jurados;
create trigger feria_jurados_auto_asignar after insert or update of habilitado,areas,conflictos,cuenta_id on public.feria_jurados for each statement execute function public.feria_jurados_auto_asignar();
-- Los cambios de aula y la aprobación de proyectos también completan pendientes.
drop trigger if exists feria_reservas_auto_asignar on public.feria_programacion;
create trigger feria_reservas_auto_asignar after insert or update or delete on public.feria_programacion for each statement execute function public.feria_jurados_auto_asignar();
create or replace function public.feria_jurado_habilitar(persona uuid,datos jsonb,habilitar boolean)
returns void language plpgsql security definer set search_path='' as $$
declare correo_n text;usuario uuid;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden habilitar jurados';end if;
 perform pg_advisory_xact_lock(20261106,333);
 correo_n:=lower(trim(datos->>'correo'));
 if habilitar is null or persona is null or correo_n is null or correo_n!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(correo_n)>254 or length(trim(coalesce(datos->>'nombre','')))=0 or length(datos->>'nombre')>150 or length(coalesce(datos->>'institucion',''))>150 or length(coalesce(datos->>'profesion',''))>150 or length(coalesce(datos->>'telefono',''))>50 then raise exception 'Completa nombre y correo válidos';end if;
 if jsonb_typeof(datos->'areas') is distinct from 'array' or jsonb_typeof(datos->'conflictos') is distinct from 'array' then raise exception 'Áreas y conflictos no válidos';end if;
 if jsonb_array_length(datos->'conflictos')>500 or exists(select 1 from jsonb_array_elements_text(datos->'areas')a where a not in('science','technology','engineering','arts','mathematics','emprendimiento')) then raise exception 'Áreas o conflictos no válidos';end if;
 if exists(select 1 from public.feria_evaluacion_visitas v join public.feria_evaluaciones e on e.visita_id=v.id where v.jurado_id=persona and (not habilitar or (v.origen||':'||v.proyecto_id)=any(array(select jsonb_array_elements_text(datos->'conflictos'))))) then raise exception 'Conserva las visitas que ya tienen notas o borrador; no puedes deshabilitar al jurado ni añadirles un conflicto';end if;
 if exists(select 1 from public.feria_jurados where id=persona and lower(trim(correo))<>correo_n) then raise exception 'No se puede cambiar el correo del jurado; registra otra cuenta';end if;
 insert into public.feria_jurados(id,nombre,correo,institucion,profesion,telefono,habilitado,areas,conflictos)
 values(persona,trim(datos->>'nombre'),correo_n,coalesce(datos->>'institucion',''),coalesce(datos->>'profesion',''),coalesce(datos->>'telefono',''),habilitar,array(select jsonb_array_elements_text(datos->'areas')),array(select jsonb_array_elements_text(datos->'conflictos')))
 on conflict(id) do update set nombre=excluded.nombre,institucion=excluded.institucion,profesion=excluded.profesion,telefono=excluded.telefono,habilitado=excluded.habilitado,areas=excluded.areas,conflictos=excluded.conflictos;
 update public.feria_evaluacion_config set version=version+1;
end $$;


drop trigger if exists feria_proyectos_auto_asignar on public.feria_proyectos;
create trigger feria_proyectos_auto_asignar after insert or update of estado,asesor_id,autor on public.feria_proyectos for each statement execute function public.feria_jurados_auto_asignar();
select public.feria_asignar_jurados_interno();
notify pgrst,'reload schema';
commit;
