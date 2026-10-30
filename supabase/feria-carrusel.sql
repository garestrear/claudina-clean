-- Ejecutar después de feria-espacios-programacion.sql y feria-integrantes.sql.
begin;
create table if not exists public.feria_planes_carrusel(
 fecha date not null,inicio time not null,fin time not null check(fin>inicio),
 datos jsonb not null,firma text not null,version integer not null default 1,
 actualizado_en timestamptz not null default now(),primary key(fecha,inicio,fin)
);
alter table public.feria_planes_carrusel enable row level security;
revoke all on public.feria_planes_carrusel from public,anon,authenticated;
create or replace function public.feria_carrusel_contexto(dia date,desde time,hasta time)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare aulas jsonb;visitantes jsonb;docentes jsonb;guardado public.feria_planes_carrusel;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden organizar el carrusel';end if;
 if dia is null or desde is null or hasta is null or hasta<=desde then raise exception 'Revisa el horario del carrusel';end if;
 -- Un bloque debe tener las mismas exposiciones durante todo el recorrido.
 if exists(select 1 from public.feria_programacion r where r.activo and r.tipo='proyecto' and r.fecha=dia and r.inicio<hasta and r.fin>desde
 and ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')))
 and (r.inicio>desde or r.fin<hasta)) then raise exception 'Las exposiciones cambian dentro de este bloque. Divide el horario en tramos con las mismas aulas y proyectos';end if;
 select coalesce(jsonb_agg(x.d order by x.orden,x.nombre,x.id),'[]'::jsonb) into aulas from (
 select e.id,e.orden,e.nombre,jsonb_build_object('id',e.id,'nombre',e.nombre,'aforo',e.aforo,'proyectos',count(distinct (r.origen,r.proyecto_id)),'requiere_lider',count(distinct (r.origen,r.proyecto_id))>1) d
 from public.feria_espacios e join public.feria_programacion r on r.espacio_id=e.id and r.activo and r.tipo='proyecto' and r.fecha=dia and r.inicio<=desde and r.fin>=hasta
 where e.activo and ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')))
 group by e.id) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.grado,e.nombre,e.id),'[]'::jsonb) into visitantes
 from public.estudiantes e where e.activo and not exists(select 1 from public.feria_proyectos p where p.estado='aprobado' and p.titulo not like '[Emprendimiento familiar] %' and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre,p.id),'[]'::jsonb) into docentes from public.perfiles p where p.rol='profesor';
 select * into guardado from public.feria_planes_carrusel p where p.fecha=dia and p.inicio=desde and p.fin=hasta;
 return jsonb_build_object('aulas',aulas,'visitantes',visitantes,'docentes',docentes,'plan',guardado.datos,'firma_guardada',guardado.firma,'version',coalesce(guardado.version,0),'firma',md5(jsonb_build_array(aulas,visitantes,docentes)::text));
end $$;
create or replace function public.feria_carrusel_guardar(dia date,desde time,hasta time,datos jsonb,firma_actual text,version_esperada integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;n integer;lideres integer;v integer;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden guardar el carrusel';end if;
 perform pg_advisory_xact_lock(20261106);
 if exists(select 1 from public.feria_planes_carrusel p where p.fecha=dia and p.inicio<hasta and p.fin>desde and (p.inicio<>desde or p.fin<>hasta)) then raise exception 'Ya existe un plan que se cruza con este horario. Edita el bloque existente o usa horarios separados';end if;
 ctx:=public.feria_carrusel_contexto(dia,desde,hasta);
 if ctx->>'firma' is distinct from firma_actual then raise exception 'Cambiaron las aulas, proyectos, estudiantes o docentes. Actualiza y vuelve a generar los grupos';end if;
 if (ctx->>'version')::integer is distinct from version_esperada then raise exception 'Otro docente cambió el plan. Actualiza antes de guardar';end if;
 n:=jsonb_array_length(ctx->'aulas');select count(*) into lideres from jsonb_array_elements(ctx->'aulas') a where (a->>'requiere_lider')::boolean;
 if n=0 then raise exception 'Primero ubica los proyectos aprobados en los espacios';end if;
 if jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>1000000 or jsonb_typeof(datos->'lideres') is distinct from 'array' or jsonb_typeof(datos->'grupos') is distinct from 'array' then raise exception 'Plan no válido';end if;
 if jsonb_array_length(datos->'lideres')<>lideres or jsonb_array_length(datos->'grupos')<>n or (datos->>'minutos') is null or (datos->>'minutos')::integer not between 5 and 60 then raise exception 'Revisa líderes, grupos y duración de las rotaciones';end if;
 if exists(select 1 from jsonb_array_elements(datos->'lideres') l where not exists(select 1 from jsonb_array_elements(ctx->'aulas') a where a->>'id'=l->>'espacio_id' and(a->>'requiere_lider')::boolean))
 or (select count(distinct l->>'espacio_id') from jsonb_array_elements(datos->'lideres') l)<>lideres then raise exception 'Solo las aulas con más de un proyecto simultáneo requieren líder fijo';end if;
 if exists(select 1 from jsonb_array_elements(datos->'grupos') g where (g->>'numero') is null or (g->>'numero')::integer not between 1 and n or jsonb_typeof(g->'estudiantes_ids') is distinct from 'array')
 or (select count(distinct (g->>'numero')::integer) from jsonb_array_elements(datos->'grupos') g)<>n then raise exception 'Revisa la numeración y los integrantes de los grupos';end if;
 if (select coalesce(max(jsonb_array_length(g->'estudiantes_ids'))-min(jsonb_array_length(g->'estudiantes_ids')),0) from jsonb_array_elements(datos->'grupos') g)>1 then raise exception 'Los grupos deben tener tamaños equilibrados (diferencia máxima de un estudiante)';end if;
 if (select count(*) from jsonb_array_elements(datos->'grupos') g cross join lateral jsonb_array_elements_text(g->'estudiantes_ids') s)<>jsonb_array_length(ctx->'visitantes')
 or (select count(distinct s) from jsonb_array_elements(datos->'grupos') g cross join lateral jsonb_array_elements_text(g->'estudiantes_ids') s)<>jsonb_array_length(ctx->'visitantes')
 or exists(select 1 from jsonb_array_elements(datos->'grupos') g cross join lateral jsonb_array_elements_text(g->'estudiantes_ids') s where not exists(select 1 from jsonb_array_elements(ctx->'visitantes') e where e->>'id'=s)) then raise exception 'Cada estudiante sin exposición debe aparecer exactamente una vez; los expositores permanecen en sus stands';end if;
 if exists(select 1 from (select nullif(l->>'docente_id','') id from jsonb_array_elements(datos->'lideres') l union all select nullif(g->>'docente_id','') from jsonb_array_elements(datos->'grupos') g) t where t.id is not null and not exists(select 1 from public.perfiles p where p.id::text=t.id and p.rol='profesor')) then raise exception 'Selecciona docentes válidos';end if;
 if exists(select 1 from (select nullif(l->>'docente_id','') id from jsonb_array_elements(datos->'lideres') l union all select nullif(g->>'docente_id','') from jsonb_array_elements(datos->'grupos') g) t where t.id is not null group by t.id having count(*)>1) then raise exception 'Un docente no puede liderar dos aulas ni acompañar un grupo mientras es líder fijo';end if;
 insert into public.feria_planes_carrusel(fecha,inicio,fin,datos,firma) values(dia,desde,hasta,datos,firma_actual)
 on conflict(fecha,inicio,fin) do update set datos=excluded.datos,firma=excluded.firma,version=public.feria_planes_carrusel.version+1,actualizado_en=now();
 return public.feria_carrusel_contexto(dia,desde,hasta);
end $$;
revoke all on function public.feria_carrusel_contexto(date,time,time),public.feria_carrusel_guardar(date,time,time,jsonb,text,integer) from public,anon;
grant execute on function public.feria_carrusel_contexto(date,time,time),public.feria_carrusel_guardar(date,time,time,jsonb,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
