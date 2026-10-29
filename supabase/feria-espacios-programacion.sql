-- Claudina App · Espacios y programación de Feria STEAM.
-- Ejecutar completo después de los módulos de feria e instituciones invitadas.
-- Repetible: no reemplaza nombres, capacidades ni reservas existentes.
begin;
create table if not exists public.feria_espacios(
 id uuid primary key default gen_random_uuid(),codigo text not null unique,
 nombre text not null check(length(trim(nombre)) between 2 and 120),
 tipo text not null check(tipo in('salon','restaurante','patio','otro')),
 cupos integer check(cupos between 1 and 200),aforo integer check(aforo between 1 and 2000),
 electricidad boolean not null default false,cubierto boolean not null default true,
 notas text not null default '' check(length(notas)<=2000),activo boolean not null default true,
 orden integer not null default 100,version integer not null default 1,
 actualizado_en timestamptz not null default now()
);
create table if not exists public.feria_programacion(
 id uuid primary key default gen_random_uuid(),espacio_id uuid not null references public.feria_espacios(id),
 fecha date not null,inicio time not null,fin time not null check(fin>inicio),
 tipo text not null check(tipo in('proyecto','actividad')),
 origen text check(origen in('claudina','invitados')),proyecto_id uuid,
 titulo text not null check(length(trim(titulo)) between 3 and 200),
 exclusivo boolean not null default false,puesto text not null default '' check(length(puesto)<=80),
 responsable text not null default '' check(length(responsable)<=200),docente_id uuid references public.perfiles(id) on delete set null,
 notas text not null default '' check(length(notas)<=2000),activo boolean not null default true,
 version integer not null default 1,creado_por uuid references public.perfiles(id) on delete set null,
 creado_en timestamptz not null default now(),actualizado_en timestamptz not null default now(),
 check((tipo='proyecto' and origen is not null and proyecto_id is not null) or(tipo='actividad' and origen is null and proyecto_id is null))
);
create index if not exists feria_programacion_espacio_hora on public.feria_programacion(espacio_id,fecha,inicio,fin) where activo;
create index if not exists feria_programacion_proyecto on public.feria_programacion(origen,proyecto_id,fecha) where activo;
alter table public.feria_espacios enable row level security;
alter table public.feria_programacion enable row level security;
revoke all on public.feria_espacios,public.feria_programacion from public,anon,authenticated;
insert into public.feria_espacios(codigo,nombre,tipo,orden)
 select 'salon-'||i,'Salón '||i,'salon',i from generate_series(1,9)i on conflict(codigo) do nothing;
insert into public.feria_espacios(codigo,nombre,tipo,orden,cubierto)
 values('restaurante','Restaurante','restaurante',10,true),('patio','Patio','patio',11,false)
 on conflict(codigo) do nothing;

create or replace function public.feria_espacios_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden organizar los espacios de la feria';end if;
 return jsonb_build_object('espacios',coalesce((select jsonb_agg(to_jsonb(e) order by e.orden,e.nombre) from public.feria_espacios e),'[]'::jsonb),
 'programacion',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('espacio_nombre',e.nombre,'proyecto_vigente',case when r.tipo='actividad' then true when r.origen='claudina' then exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado') else exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado') end) order by r.fecha,r.inicio,e.orden,r.titulo) from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id),'[]'::jsonb),
 'proyectos',coalesce((select jsonb_agg(x.d order by x.titulo) from (
 select p.titulo,jsonb_build_object('id',p.id,'origen','claudina','titulo',p.titulo,'grado',p.grado,'institucion','C.E.R. Claudina Múnera') d from public.feria_proyectos p where p.estado='aprobado'
 union all select p.datos->>'titulo',jsonb_build_object('id',p.id,'origen','invitados','titulo',p.datos->>'titulo','institucion',p.datos->>'institucion') from public.feria_proyectos_externos p where p.estado='aprobado')x),'[]'::jsonb),
 'docentes',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre) from public.perfiles p where p.rol='profesor'),'[]'::jsonb));
end $$;

create or replace function public.feria_espacio_guardar(espacio uuid,datos jsonb,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.feria_espacios;n text;t text;c integer;a integer;habilitado boolean;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden modificar espacios';end if;
 if espacio is null or version_esperada is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>12000 then raise exception 'Datos de espacio no válidos';end if;
 perform pg_advisory_xact_lock(20261106);
 select * into e from public.feria_espacios where id=espacio for update;
 if (e.id is null and version_esperada<>0) or(e.id is not null and e.version<>version_esperada) then raise exception 'El espacio cambió. Actualiza antes de guardar';end if;
 n:=trim(datos->>'nombre');t:=datos->>'tipo';c:=nullif(datos->>'cupos','')::integer;a:=nullif(datos->>'aforo','')::integer;habilitado:=coalesce((datos->>'activo')::boolean,true);
 if n is null or length(n) not between 2 and 120 or t is null or t not in('salon','restaurante','patio','otro') or(c is not null and c not between 1 and 200) or(a is not null and a not between 1 and 2000) or length(coalesce(datos->>'notas',''))>2000 then raise exception 'Revisa el nombre, tipo, cupos y aforo del espacio';end if;
 if not habilitado and exists(select 1 from public.feria_programacion r where r.espacio_id=espacio and r.activo) then raise exception 'El espacio tiene reservas activas. Reubícalas o cancélalas antes de deshabilitarlo';end if;
 if c is not null and exists(
 select 1 from public.feria_programacion punto where punto.espacio_id=espacio and punto.activo and not punto.exclusivo and
 (select count(*) from public.feria_programacion r where r.espacio_id=espacio and r.activo and not r.exclusivo and r.fecha=punto.fecha and r.inicio<=punto.inicio and r.fin>punto.inicio)>c
 ) then raise exception 'Los cupos nuevos son menores que las reservas simultáneas existentes';end if;
 if e.id is null then
 insert into public.feria_espacios(id,codigo,nombre,tipo,cupos,aforo,electricidad,cubierto,notas,activo)
 values(espacio,'extra-'||espacio,n,t,c,a,coalesce((datos->>'electricidad')::boolean,false),coalesce((datos->>'cubierto')::boolean,true),coalesce(trim(datos->>'notas'),''),habilitado);
 else update public.feria_espacios set nombre=n,tipo=t,cupos=c,aforo=a,electricidad=coalesce((datos->>'electricidad')::boolean,false),cubierto=coalesce((datos->>'cubierto')::boolean,true),notas=coalesce(trim(datos->>'notas'),''),activo=habilitado,version=e.version+1,actualizado_en=now() where id=espacio;end if;
 return public.feria_espacios_contexto();
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

create or replace function public.feria_programacion_cancelar(reserva uuid,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden cancelar reservas';end if;
 perform pg_advisory_xact_lock(20261106);
 update public.feria_programacion set activo=false,version=version+1,actualizado_en=now() where id=reserva and version=version_esperada and activo;
 if not found then raise exception 'La reserva cambió. Actualiza la programación';end if;
 return public.feria_espacios_contexto();
end $$;
revoke all on function public.feria_espacios_contexto(),public.feria_espacio_guardar(uuid,jsonb,integer),public.feria_programacion_guardar(uuid,jsonb,integer),public.feria_programacion_cancelar(uuid,integer) from public,anon;
grant execute on function public.feria_espacios_contexto(),public.feria_espacio_guardar(uuid,jsonb,integer),public.feria_programacion_guardar(uuid,jsonb,integer),public.feria_programacion_cancelar(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
