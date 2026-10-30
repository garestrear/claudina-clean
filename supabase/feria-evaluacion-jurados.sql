-- Ejecutar después de feria-jurados.sql, feria-placas.sql y
-- feria-espacios-programacion.sql. Repetible, conserva proyectos y notas.
begin;
alter table public.feria_jurados add column if not exists habilitado boolean not null default false;
alter table public.feria_jurados add column if not exists areas text[] not null default '{}';
alter table public.feria_jurados add column if not exists conflictos text[] not null default '{}';
create table if not exists public.feria_evaluacion_config(
 id boolean primary key default true check(id),fecha date not null default '2026-11-06',
 inicio time not null default '08:00',fin time not null default '10:00',version integer not null default 1,
 check(fin>inicio and fin-inicio between interval '110 minutes' and interval '120 minutes')
);
insert into public.feria_evaluacion_config(id) values(true) on conflict do nothing;
create table if not exists public.feria_evaluacion_categorias(
 origen text not null check(origen in('claudina','invitados')),proyecto_id uuid not null,
 categoria text not null check(categoria in('stem','arte','emprendimiento','familias','puentes_juvenil','puentes_infantil')),primary key(origen,proyecto_id)
);
create table if not exists public.feria_evaluacion_visitas(
 id uuid primary key default gen_random_uuid(),jurado_id uuid not null references public.feria_jurados(id),
 origen text not null check(origen in('claudina','invitados')),proyecto_id uuid not null,
 ronda integer not null check(ronda between 0 and 9),fecha date not null,inicio time not null,fin time not null,
 check(fin-inicio=interval '10 minutes'),unique(jurado_id,ronda),unique(origen,proyecto_id,ronda),unique(jurado_id,origen,proyecto_id)
);
create table if not exists public.feria_evaluaciones(
 visita_id uuid primary key references public.feria_evaluacion_visitas(id),
 notas jsonb not null default '[]',destacado text not null default '' check(length(destacado)<=2000),
 sugerencia text not null default '' check(length(sugerencia)<=2000),
 enviada boolean not null default false,puntaje numeric,version integer not null default 1,
 actualizado_en timestamptz not null default now(),solicitud uuid not null,
 check(not enviada or (puntaje between 20 and 100 and jsonb_array_length(notas)=5))
);
alter table public.feria_evaluacion_config enable row level security;
alter table public.feria_evaluacion_categorias enable row level security;
alter table public.feria_evaluacion_visitas enable row level security;
alter table public.feria_evaluaciones enable row level security;
revoke all on public.feria_evaluacion_config,public.feria_evaluacion_categorias,public.feria_evaluacion_visitas,public.feria_evaluaciones from public,anon,authenticated;

-- El rol de jurado se otorga por el comité, nunca por metadatos del navegador.
-- No cambia el rol institucional: los docentes conservan su cuenta actual.
create or replace function public.feria_mi_jurado()
returns uuid language sql stable security definer set search_path='' as $$
 select j.id from public.feria_jurados j join auth.users u on lower(trim(u.email))=lower(trim(j.correo))
 where u.id=auth.uid() and u.email_confirmed_at is not null and j.habilitado limit 1;
$$;
revoke all on function public.feria_mi_jurado() from public,anon;
grant execute on function public.feria_mi_jurado() to authenticated;

-- Fuente única: solamente aprobados, internos y externos. Sin correos ni teléfonos de menores.
create or replace function public.feria_evaluacion_proyectos()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('categoria',coalesce(c.categoria,pl.categoria,'stem'),
 'codigo',case pl.categoria when 'stem' then 'STEM' when 'arte' then 'ART' when 'familias' then 'FAM' else 'EMP' end||'-'||lpad(pl.numero_categoria::text,3,'0'),
 'ubicaciones',coalesce((select jsonb_agg(jsonb_build_object('espacio_id',r.espacio_id,'espacio_nombre',e.nombre,'fecha',r.fecha,'inicio',r.inicio,'fin',r.fin)) from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id and e.activo where r.origen=q.origen and r.proyecto_id=q.id and r.activo),'[]'::jsonb)) order by pl.numero_general,q.titulo),'[]'::jsonb)
 from (
 select 'claudina'::text origen,p.id,p.titulo,p.integrantes,p.propuesta,p.procedimiento,p.resultados_esperados,p.areas,p.asesor_id,p.autor autor_id from public.feria_proyectos p where p.estado='aprobado'
 union all
 select 'invitados',p.id,p.datos->>'titulo',p.datos->>'integrantes',p.datos->>'propuesta',p.datos->>'procedimiento',p.datos->>'resultados_esperados',array(select jsonb_array_elements_text(p.datos->'areas')),null::uuid,p.autor from public.feria_proyectos_externos p where p.estado='aprobado'
 )q left join public.feria_placas pl on pl.origen=q.origen and pl.proyecto_id=q.id
 left join public.feria_evaluacion_categorias c on c.origen=q.origen and c.proyecto_id=q.id;
$$;
revoke all on function public.feria_evaluacion_proyectos() from public,anon,authenticated;

create or replace function public.feria_evaluacion_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);j uuid:=public.feria_mi_jurado();proyectos jsonb;
begin
 if auth.uid() is null or not(docente or j is not null) then raise exception 'Tu cuenta no está habilitada como jurado. Contacta al comité de la feria';end if;
 select coalesce(jsonb_agg(p),'[]'::jsonb) into proyectos from jsonb_array_elements(public.feria_evaluacion_proyectos())p
 where docente or exists(select 1 from public.feria_evaluacion_visitas v where v.jurado_id=j and v.origen=p->>'origen' and v.proyecto_id=(p->>'id')::uuid);
 return jsonb_build_object('docente',docente,'mi_jurado',j,'config',(select to_jsonb(c) from public.feria_evaluacion_config c),
 'proyectos',proyectos,'jurados',case when docente then coalesce((select jsonb_agg(to_jsonb(x) order by x.nombre) from (select j.*,u.id usuario_id from public.feria_jurados j left join auth.users u on lower(trim(u.email))=lower(trim(j.correo)))x),'[]'::jsonb) else '[]'::jsonb end,
 'visitas',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('evaluacion',case when e.visita_id is not null then to_jsonb(e) end) order by v.ronda) from public.feria_evaluacion_visitas v left join public.feria_evaluaciones e on e.visita_id=v.id where docente or v.jurado_id=j),'[]'::jsonb));
end $$;

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
 if exists(select 1 from public.feria_evaluacion_visitas v where v.jurado_id=persona) then raise exception 'Este jurado tiene visitas. Reasigna o elimina su recorrido antes de cambiar su cuenta';end if;
 if exists(select 1 from public.feria_jurados where id=persona and lower(trim(correo))<>correo_n) then raise exception 'No se puede cambiar el correo del jurado; registra otra cuenta';end if;
 insert into public.feria_jurados(id,nombre,correo,institucion,profesion,telefono,habilitado,areas,conflictos)
 values(persona,trim(datos->>'nombre'),correo_n,coalesce(datos->>'institucion',''),coalesce(datos->>'profesion',''),coalesce(datos->>'telefono',''),habilitar,array(select jsonb_array_elements_text(datos->'areas')),array(select jsonb_array_elements_text(datos->'conflictos')))
 on conflict(id) do update set nombre=excluded.nombre,institucion=excluded.institucion,profesion=excluded.profesion,telefono=excluded.telefono,habilitado=excluded.habilitado,areas=excluded.areas,conflictos=excluded.conflictos;
 update public.feria_evaluacion_config set version=version+1;
end $$;

create or replace function public.feria_evaluacion_categoria(fuente text,proyecto uuid,categoria_nueva text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes';end if;
 perform pg_advisory_xact_lock(20261106,333);
 if categoria_nueva is null or categoria_nueva not in('stem','arte','emprendimiento','familias','puentes_juvenil','puentes_infantil') or not exists(select 1 from jsonb_array_elements(public.feria_evaluacion_proyectos())p where p->>'origen'=fuente and (p->>'id')::uuid=proyecto) then raise exception 'Proyecto o categoría no válidos';end if;
 if exists(select 1 from public.feria_evaluacion_visitas v join public.feria_evaluaciones e on e.visita_id=v.id where v.origen=fuente and v.proyecto_id=proyecto) then raise exception 'Ya hay evaluaciones; no se puede cambiar la rúbrica';end if;
 insert into public.feria_evaluacion_categorias values(fuente,proyecto,categoria_nueva) on conflict(origen,proyecto_id) do update set categoria=excluded.categoria;
 update public.feria_evaluacion_config set version=version+1;
end $$;

create or replace function public.feria_evaluacion_plan(dia date,desde time,hasta time,visitas jsonb,version_esperada integer)
returns void language plpgsql security definer set search_path='' as $$
declare c public.feria_evaluacion_config;v record;p jsonb;j public.feria_jurados;u uuid;proyectos jsonb;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden asignar recorridos';end if;
 perform pg_advisory_xact_lock(20261106,333);
 select * into c from public.feria_evaluacion_config for update;
 if version_esperada is distinct from c.version then raise exception 'El plan cambió. Actualiza antes de guardar';end if;
 if dia is null or desde is null or hasta is null or hasta-desde not between interval '110 minutes' and interval '120 minutes' then raise exception 'La franja debe durar entre 110 y 120 minutos';end if;
 if jsonb_typeof(visitas) is distinct from 'array' or jsonb_array_length(visitas)>5000 then raise exception 'Plan no válido';end if;
 if exists(select 1 from public.feria_evaluaciones) then raise exception 'Ya hay calificaciones; usa la reasignación individual para conservarlas';end if;
 proyectos:=public.feria_evaluacion_proyectos();
 if jsonb_array_length(proyectos)=0 or jsonb_array_length(visitas)<>jsonb_array_length(proyectos)*3 then raise exception 'Cada proyecto aprobado necesita exactamente tres visitas';end if;
 -- Reemplazo atómico: cualquier error revierte también el borrado.
 delete from public.feria_evaluacion_visitas;
 for v in select * from jsonb_to_recordset(visitas) as x(jurado_id uuid,origen text,proyecto_id uuid,ronda integer) loop
  select value into p from jsonb_array_elements(proyectos) where value->>'origen'=v.origen and (value->>'id')::uuid=v.proyecto_id;
  select * into j from public.feria_jurados where id=v.jurado_id and habilitado;
  if p is null or j.id is null or v.ronda is null or v.ronda not between 0 and 9 then raise exception 'Proyecto, jurado o ronda no válido';end if;
  select id into u from auth.users where lower(trim(email))=lower(trim(j.correo));
  if u is not null and (u=nullif(p->>'asesor_id','')::uuid or u=nullif(p->>'autor_id','')::uuid) or (v.origen||':'||v.proyecto_id)=any(j.conflictos) then raise exception 'Un asesor, autor o jurado con conflicto no puede evaluar este proyecto';end if;
  if not exists(select 1 from public.feria_programacion r join public.feria_espacios e on e.id=r.espacio_id and e.activo where r.origen=v.origen and r.proyecto_id=v.proyecto_id and r.activo and r.fecha=dia and r.inicio<=desde+v.ronda*interval '11 minutes' and r.fin>=desde+v.ronda*interval '11 minutes'+interval '10 minutes') then raise exception 'El proyecto no tiene aula reservada durante la visita';end if;
  insert into public.feria_evaluacion_visitas(jurado_id,origen,proyecto_id,ronda,fecha,inicio,fin) values(v.jurado_id,v.origen,v.proyecto_id,v.ronda,dia,desde+v.ronda*interval '11 minutes',desde+v.ronda*interval '11 minutes'+interval '10 minutes');
 end loop;
 if exists(select 1 from jsonb_array_elements(proyectos) zz where (select count(*) from public.feria_evaluacion_visitas vv where vv.origen=zz->>'origen' and vv.proyecto_id=(zz->>'id')::uuid)<>3) then raise exception 'Cada proyecto necesita tres jurados distintos';end if;
 update public.feria_evaluacion_config set fecha=dia,inicio=desde,fin=hasta,version=version+1;
end $$;

create or replace function public.feria_evaluacion_reasignar(visita uuid,nuevo_jurado uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.feria_evaluacion_visitas;j public.feria_jurados;p jsonb;u uuid;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes';end if;
 perform pg_advisory_xact_lock(20261106,333);
 select * into v from public.feria_evaluacion_visitas where id=visita for update;
 if v.id is null or exists(select 1 from public.feria_evaluaciones where visita_id=visita) then raise exception 'Solo se reasignan visitas sin calificación ni borrador';end if;
 select * into j from public.feria_jurados where id=nuevo_jurado and habilitado;
 if j.id is null or (select count(*) from public.feria_evaluacion_visitas where jurado_id=nuevo_jurado)>=10 then raise exception 'Jurado no habilitado o con diez visitas';end if;
 select value into p from jsonb_array_elements(public.feria_evaluacion_proyectos()) where value->>'origen'=v.origen and (value->>'id')::uuid=v.proyecto_id;
 select id into u from auth.users where lower(trim(email))=lower(trim(j.correo));
 if p is null or (u is not null and (u=nullif(p->>'asesor_id','')::uuid or u=nullif(p->>'autor_id','')::uuid)) or (v.origen||':'||v.proyecto_id)=any(j.conflictos) then raise exception 'Proyecto no vigente o conflicto del jurado';end if;
 update public.feria_evaluacion_visitas set jurado_id=nuevo_jurado where id=visita;
 update public.feria_evaluacion_config set version=version+1;
end $$;

create or replace function public.feria_evaluacion_guardar(visita uuid,datos jsonb,enviar boolean,version_esperada integer,solicitud_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.feria_evaluacion_visitas;e public.feria_evaluaciones;p jsonb;pesos int[];nota int;suma numeric:=0;i integer;
begin
 perform pg_advisory_xact_lock(20261106,333);
 select * into v from public.feria_evaluacion_visitas where id=visita for update;
 if v.id is null or v.jurado_id is distinct from public.feria_mi_jurado() then raise exception 'Esta visita no está asignada a tu cuenta de jurado';end if;
 select value into p from jsonb_array_elements(public.feria_evaluacion_proyectos()) where value->>'origen'=v.origen and (value->>'id')::uuid=v.proyecto_id;
 if p is null then raise exception 'El proyecto ya no está aprobado';end if;
 if not exists(select 1 from public.feria_programacion r join public.feria_espacios s on s.id=r.espacio_id and s.activo where r.origen=v.origen and r.proyecto_id=v.proyecto_id and r.activo and r.fecha=v.fecha and r.inicio<=v.inicio and r.fin>=v.fin) then raise exception 'La ubicación cambió; solicita al comité revisar la visita';end if;
 -- Revalida conflictos también si el proyecto cambió de asesor después de asignar.
 if (nullif(p->>'asesor_id','')::uuid=auth.uid() or nullif(p->>'autor_id','')::uuid=auth.uid()) or exists(select 1 from public.feria_jurados j where j.id=v.jurado_id and (v.origen||':'||v.proyecto_id)=any(j.conflictos)) then raise exception 'Existe un conflicto con este proyecto';end if;
 select * into e from public.feria_evaluaciones where visita_id=visita for update;
 if solicitud_id is not null and e.solicitud=solicitud_id then return to_jsonb(e);end if;
 if enviar is null or solicitud_id is null or version_esperada is distinct from coalesce(e.version,0) then raise exception 'La evaluación cambió. Actualiza antes de guardar';end if;
 if e.enviada then raise exception 'La evaluación ya fue enviada';end if;
 if jsonb_typeof(datos->'notas') is distinct from 'array' or jsonb_array_length(datos->'notas')<>5 then raise exception 'Se requieren cinco criterios';end if;
 pesos:=case p->>'categoria' when 'arte' then array[15,15,25,25,20] when 'emprendimiento' then array[20,25,20,20,15] when 'familias' then array[20,25,20,20,15] when 'puentes_juvenil' then array[25,25,25,10,15] when 'puentes_infantil' then array[20,25,25,15,15] else array[15,20,25,20,20] end;
 for i in 0..4 loop
  if datos->'notas'->i='null'::jsonb and not enviar then continue;end if;
  if coalesce((datos->'notas'->>i),'')!~'^[1-5]$' then raise exception 'Califica todos los criterios de 1 a 5';end if;
  nota:=(datos->'notas'->>i)::integer;suma:=suma+nota*pesos[i+1]/5.0;
 end loop;
 if length(coalesce(datos->>'destacado',''))>2000 or length(coalesce(datos->>'sugerencia',''))>2000 then raise exception 'Comentarios demasiado largos';end if;
 insert into public.feria_evaluaciones(visita_id,notas,destacado,sugerencia,enviada,puntaje,solicitud)
 values(visita,datos->'notas',coalesce(datos->>'destacado',''),coalesce(datos->>'sugerencia',''),enviar,case when enviar then round(suma,2) end,solicitud_id)
 on conflict(visita_id) do update set notas=excluded.notas,destacado=excluded.destacado,sugerencia=excluded.sugerencia,enviada=excluded.enviada,puntaje=excluded.puntaje,solicitud=excluded.solicitud,version=feria_evaluaciones.version+1,actualizado_en=now() returning * into e;
 return to_jsonb(e);
end $$;
revoke all on function public.feria_evaluacion_contexto(),public.feria_jurado_habilitar(uuid,jsonb,boolean),public.feria_evaluacion_categoria(text,uuid,text),public.feria_evaluacion_plan(date,time,time,jsonb,integer),public.feria_evaluacion_reasignar(uuid,uuid),public.feria_evaluacion_guardar(uuid,jsonb,boolean,integer,uuid) from public,anon;
grant execute on function public.feria_evaluacion_contexto(),public.feria_jurado_habilitar(uuid,jsonb,boolean),public.feria_evaluacion_categoria(text,uuid,text),public.feria_evaluacion_plan(date,time,time,jsonb,integer),public.feria_evaluacion_reasignar(uuid,uuid),public.feria_evaluacion_guardar(uuid,jsonb,boolean,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
