-- Ejecutar después de feria-agenda-general.sql, feria-carrusel.sql y feria-puestos-automaticos.sql.
-- Conserva las reservas existentes: moverlas desde Programación si corresponde.
begin;
select pg_advisory_xact_lock(20261106);
-- El bloque general no reserva aulas. Las actividades posteriores conservan su programación.
update public.feria_agenda_general set inicio='10:15',fin='11:40',
 titulo='Segunda franja de exposiciones en carrusel',
 detalle='Proyectos invitados y proyectos de estudiantes programados en esta franja. Los estudiantes sin exposición en este horario participan como visitantes.',version=version+1
 where codigo='charlas' and reserva_id is null and
 (inicio,fin,titulo) is distinct from ('10:15'::time,'11:40'::time,'Segunda franja de exposiciones en carrusel');
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
 from public.estudiantes e where e.activo and not exists(select 1 from public.feria_proyectos p where p.estado='aprobado' and p.titulo not like '[Emprendimiento familiar] %' and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) and exists(select 1 from public.feria_programacion r where r.activo and r.tipo='proyecto' and r.origen='claudina' and r.proyecto_id=p.id and r.fecha=dia and r.inicio<hasta and r.fin>desde));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre,p.id),'[]'::jsonb) into docentes from public.perfiles p where p.rol='profesor';
 select * into guardado from public.feria_planes_carrusel p where p.fecha=dia and p.inicio=desde and p.fin=hasta;
 return jsonb_build_object('aulas',aulas,'visitantes',visitantes,'docentes',docentes,'plan',guardado.datos,'firma_guardada',guardado.firma,'version',coalesce(guardado.version,0),'firma',md5(jsonb_build_array(aulas,visitantes,docentes)::text));
end $$;
create or replace function public.feria_asignar_aula(fuente text,proyecto uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare aula uuid;ubicacion uuid;nombre text;horario jsonb;dia date;desde time;hasta time;
begin
 perform pg_advisory_xact_lock(20261106);
 horario:=public.feria_tramo_exposiciones();if fuente='invitados' then horario:=horario||jsonb_build_object('inicio','10:15','fin','11:40');end if;dia:=(horario->>'fecha')::date;desde:=(horario->>'inicio')::time;hasta:=(horario->>'fin')::time;
 if fuente='claudina' then select titulo into nombre from public.feria_proyectos where id=proyecto and estado='aprobado';
 elsif fuente='invitados' then select datos->>'titulo' into nombre from public.feria_proyectos_externos where id=proyecto and estado='aprobado';
 else raise exception 'Origen no válido';end if;
 if nombre is null then return null;end if;
 -- Las ubicaciones existentes, incluidas las movidas manualmente, se conservan.
 select id into ubicacion from public.feria_programacion where activo and origen=fuente and proyecto_id=proyecto and fecha=dia limit 1;
 if ubicacion is not null then return ubicacion;end if;
 select e.id into aula from public.feria_espacios e
 cross join lateral (
  select coalesce(max((select count(*) from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio<=p.momento and r.fin>p.momento)),0) ocupados
  from (select desde momento union select r.inicio from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio>=desde and r.inicio<hasta) p
 ) carga
 where e.activo and e.cupos>1 and carga.ocupados<e.cupos
 and not exists(select 1 from public.feria_programacion r where r.activo and r.espacio_id=e.id and r.fecha=dia and r.inicio<hasta and r.fin>desde and r.exclusivo)
 order by (carga.ocupados+1)::numeric/e.cupos, carga.ocupados,e.orden,e.nombre,e.id limit 1;
 if aula is null then return null;end if;
 insert into public.feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo,creado_por)
 values(aula,dia,desde,hasta,'proyecto',fuente,proyecto,nombre,
 (select id from public.perfiles where id=auth.uid())) returning id into ubicacion;
 return ubicacion;
end $$;
revoke all on function public.feria_asignar_aula(text,uuid) from public,anon,authenticated;


create or replace function public.feria_lista_expositores()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden consultar expositores';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('estudiante_id',e.id,'nombre',e.nombre,'grado',e.grado,'proyecto_id',p.id,'proyecto',p.titulo,'salon',a.nombre,'mesa',r.puesto,'fecha',r.fecha,'inicio',r.inicio,'fin',r.fin) order by r.fecha,r.inicio,e.grado,e.nombre,p.id)
 from public.feria_programacion r join public.feria_proyectos p on r.origen='claudina' and r.proyecto_id=p.id
 join public.estudiantes e on e.id=p.estudiante_id or e.id=any(p.integrantes_ids)
 join public.feria_espacios a on a.id=r.espacio_id
 where r.activo and r.tipo='proyecto' and p.estado='aprobado' and p.titulo not like '[Emprendimiento familiar] %'),'[]'::jsonb);
end $$;
revoke all on function public.feria_lista_expositores() from public,anon;
grant execute on function public.feria_lista_expositores() to authenticated;
notify pgrst,'reload schema';
commit;
