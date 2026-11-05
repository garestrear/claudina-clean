-- Ejecutar después de feria-espacios-programacion.sql y feria-asignacion-automatica.sql.
-- Repetible: completa las mesas vacías sin cambiar las asignaciones existentes.
begin;
select pg_advisory_xact_lock(20261106);
alter table public.feria_programacion add column if not exists puesto_automatico boolean not null default false;
create or replace function public.feria_numerar_puesto()
returns trigger language plpgsql security definer set search_path='' as $$
declare numero integer:=1;
begin
 perform pg_advisory_xact_lock(20261106);
 if not new.activo or new.tipo<>'proyecto' then return new;end if;
 if TG_OP='UPDATE' then
  if new.puesto is distinct from old.puesto then new.puesto_automatico:=false;
  elsif old.puesto_automatico and (new.espacio_id,new.fecha,new.inicio,new.fin) is distinct from (old.espacio_id,old.fecha,old.inicio,old.fin) then new.puesto:='';end if;
 end if;
 if btrim(coalesce(new.puesto,''))<>'' then return new;end if;
 while exists(select 1 from public.feria_programacion r where r.activo and r.id<>new.id and r.espacio_id=new.espacio_id and r.fecha=new.fecha and r.inicio<new.fin and r.fin>new.inicio and lower(btrim(r.puesto))=lower('Mesa '||numero)) loop
  numero:=numero+1;
 end loop;
 new.puesto:='Mesa '||numero;new.puesto_automatico:=true;
 return new;
end $$;
revoke all on function public.feria_numerar_puesto() from public,anon,authenticated;
drop trigger if exists feria_puesto_automatico on public.feria_programacion;
create trigger feria_puesto_automatico before insert or update on public.feria_programacion for each row execute function public.feria_numerar_puesto();
-- Orden estable. Cada actualización ve los números asignados previamente.
do $$declare r record;begin
 for r in select id from public.feria_programacion where activo and tipo='proyecto' and btrim(puesto)='' order by fecha,inicio,espacio_id,origen,titulo,id loop
  update public.feria_programacion set puesto='',version=version+1,actualizado_en=now() where id=r.id;
 end loop;
end $$;

create or replace function public.feria_programacion_guardar(reserva uuid,datos jsonb,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare anterior public.feria_programacion;e public.feria_espacios;dia date;desde time;hasta time;exclusiva boolean;clase text;fuente text;proyecto uuid;titulo_n text;puesto_n text;responsable_n text;docente uuid;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden programar la feria';end if;
 if reserva is null or version_esperada is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>16000 then raise exception 'Datos de programación no válidos';end if;
 perform pg_advisory_xact_lock(20261106);
 select * into anterior from public.feria_programacion where id=reserva for update;
 if (anterior.id is null and version_esperada<>0) or(anterior.id is not null and (anterior.version<>version_esperada or not anterior.activo)) then raise exception 'La reserva cambió o fue cancelada. Actualiza antes de guardar';end if;
 select * into e from public.feria_espacios where id=(datos->>'espacio_id')::uuid;
 if e.id is null or not e.activo then raise exception 'Selecciona un espacio habilitado';end if;
 dia:=(datos->>'fecha')::date;desde:=(datos->>'inicio')::time;hasta:=(datos->>'fin')::time;
 if dia is null or desde is null or hasta is null or hasta<=desde then raise exception 'El horario final debe ser posterior al inicial';end if;
 clase:=datos->>'tipo';exclusiva:=coalesce((datos->>'exclusivo')::boolean,false);fuente:=nullif(datos->>'origen','');proyecto:=nullif(datos->>'proyecto_id','')::uuid;
 titulo_n:=trim(datos->>'titulo');puesto_n:=coalesce(trim(datos->>'puesto'),'');responsable_n:=coalesce(trim(datos->>'responsable'),'');docente:=nullif(datos->>'docente_id','')::uuid;
 if clase is null or clase not in('proyecto','actividad') then raise exception 'Selecciona proyecto o actividad';end if;
 if clase='proyecto' then
  if fuente='claudina' then select p.titulo into titulo_n from public.feria_proyectos p where p.id=proyecto and p.estado='aprobado';
  elsif fuente='invitados' then select p.datos->>'titulo' into titulo_n from public.feria_proyectos_externos p where p.id=proyecto and p.estado='aprobado';
  else raise exception 'Selecciona el origen del proyecto';end if;
  if titulo_n is null then raise exception 'Solo se pueden ubicar proyectos aprobados';end if;
  if exists(select 1 from public.feria_programacion r where r.activo and r.id<>reserva and r.origen=fuente and r.proyecto_id=proyecto and r.fecha=dia and r.inicio<hasta and r.fin>desde) then raise exception 'Este proyecto ya tiene una ubicación en ese horario';end if;
 else fuente:=null;proyecto:=null;end if;
 if titulo_n is null or length(titulo_n) not between 3 and 200 or length(puesto_n)>80 or length(responsable_n)>200 or length(coalesce(datos->>'notas',''))>2000 then raise exception 'Revisa el título, puesto, responsable y notas';end if;
 if docente is not null and not exists(select 1 from public.perfiles p where p.id=docente and p.rol='profesor') then raise exception 'Selecciona un docente responsable válido';end if;
 if responsable_n='' and docente is not null then select p.nombre into responsable_n from public.perfiles p where p.id=docente;end if;
 if exists(select 1 from public.feria_programacion r where r.activo and r.id<>reserva and r.espacio_id=e.id and r.fecha=dia and r.inicio<hasta and r.fin>desde and(exclusiva or r.exclusivo)) then raise exception 'El espacio está ocupado por una reserva exclusiva o la actividad requiere el espacio libre';end if;
 -- Al mover una mesa automática, elegir un número libre en el nuevo horario/aula.
 if anterior.puesto_automatico and puesto_n=anterior.puesto
 and (e.id,dia,desde,hasta) is distinct from (anterior.espacio_id,anterior.fecha,anterior.inicio,anterior.fin) then puesto_n:='';end if;
 if puesto_n<>'' and exists(select 1 from public.feria_programacion r where r.activo and r.id<>reserva and r.espacio_id=e.id and r.fecha=dia and r.inicio<hasta and r.fin>desde and lower(r.puesto)=lower(puesto_n)) then raise exception 'Ese puesto o mesa ya está ocupado en este horario';end if;
 if not exclusiva and e.cupos is not null and exists(
 select 1 from (select desde momento union select r.inicio from public.feria_programacion r where r.activo and r.id<>reserva and r.espacio_id=e.id and r.fecha=dia and r.inicio>=desde and r.inicio<hasta)punto
 where (select count(*) from public.feria_programacion r where r.activo and r.id<>reserva and r.espacio_id=e.id and r.fecha=dia and r.inicio<=punto.momento and r.fin>punto.momento)>=e.cupos
 ) then raise exception 'El espacio alcanzó el máximo de puestos simultáneos para ese horario';end if;
 if anterior.id is null then
 insert into public.feria_programacion(id,espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo,exclusivo,puesto,responsable,docente_id,notas,creado_por)
 values(reserva,e.id,dia,desde,hasta,clase,fuente,proyecto,titulo_n,exclusiva,puesto_n,responsable_n,docente,coalesce(trim(datos->>'notas'),''),auth.uid());
 else update public.feria_programacion set espacio_id=e.id,fecha=dia,inicio=desde,fin=hasta,tipo=clase,origen=fuente,proyecto_id=proyecto,titulo=titulo_n,exclusivo=exclusiva,puesto=puesto_n,responsable=responsable_n,docente_id=docente,notas=coalesce(trim(datos->>'notas'),''),version=anterior.version+1,actualizado_en=now() where id=reserva;end if;
 return public.feria_espacios_contexto();
end $$;
notify pgrst,'reload schema';
commit;
