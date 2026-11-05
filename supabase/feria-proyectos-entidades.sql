-- Ejecutar después de feria-carrusel-segunda-franja.sql y feria-evaluacion-jurados.sql.
begin;
alter table public.feria_programacion add column if not exists exposicion_invitada boolean not null default false;
do $migration$
declare d text;
begin
 select pg_get_functiondef('public.feria_programacion_guardar(uuid,jsonb,integer)'::regprocedure) into d;
 if position('set exposicion_invitada=' in d)=0 then
 d:=replace(d,'return public.feria_espacios_contexto();',
 $patch$update public.feria_programacion set exposicion_invitada=coalesce((datos->>'exposicion_invitada')::boolean,false) where id=reserva;
 return public.feria_espacios_contexto();$patch$);
 execute d;
 end if;
 -- Las familias participan en la exposición, sin asignación ni evaluación de jurados.
 select pg_get_functiondef('public.feria_evaluacion_proyectos()'::regprocedure) into d;
 if position('Sin jurado: familias' in d)=0 then
 d:=replace(d,'left join public.feria_evaluacion_categorias c on c.origen=q.origen and c.proyecto_id=q.id;',
 $patch$left join public.feria_evaluacion_categorias c on c.origen=q.origen and c.proyecto_id=q.id
 -- Sin jurado: familias y entidades marcadas en programación.
 where q.titulo not like '[Emprendimiento familiar] %' and coalesce(pl.categoria,'')<>'familias'
 and not exists(select 1 from public.feria_programacion r where r.activo and r.origen=q.origen and r.proyecto_id=q.id and r.exposicion_invitada);$patch$);
 execute d;
 end if;
end $migration$;
create or replace function public.feria_carrusel_contexto(dia date,desde time,hasta time)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare aulas jsonb;visitantes jsonb;docentes jsonb;guardado public.feria_planes_carrusel;fin_recorrido time;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden organizar el carrusel';end if;
 if dia is null or desde is null or hasta is null or hasta<=desde then raise exception 'Revisa el horario del carrusel';end if;
 -- Las cuatro visitas de veinte minutos terminan a las 11:35.
 fin_recorrido:=case when desde=time '10:15' and hasta between time '11:35' and time '11:40' then time '11:35' else hasta end;
 -- Un bloque debe tener las mismas exposiciones durante todo el recorrido.
 if exists(select 1 from public.feria_programacion r where r.activo and (r.tipo='proyecto' or r.exposicion_invitada) and r.fecha=dia and r.inicio<fin_recorrido and r.fin>desde
 and (r.exposicion_invitada or ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado'))))
 and (r.inicio>desde or r.fin<fin_recorrido)) then raise exception 'Las exposiciones cambian dentro de este bloque. Divide el horario en tramos con las mismas aulas y proyectos';end if;
 select coalesce(jsonb_agg(x.d order by x.orden,x.nombre,x.id),'[]'::jsonb) into aulas from (
 select e.id,e.orden,e.nombre,jsonb_build_object('id',e.id,'nombre',e.nombre,'aforo',e.aforo,'proyectos',count(distinct r.id),'requiere_lider',count(distinct r.id)>1) d
 from public.feria_espacios e join public.feria_programacion r on r.espacio_id=e.id and r.activo and (r.tipo='proyecto' or r.exposicion_invitada) and r.fecha=dia and r.inicio<=desde and r.fin>=fin_recorrido
 where e.activo and (r.exposicion_invitada or ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado'))))
 group by e.id) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.grado,e.nombre,e.id),'[]'::jsonb) into visitantes
 from public.estudiantes e where e.activo and (not(desde>=time '10:15' and hasta<=time '11:40') or e.grado<>0) and not exists(select 1 from public.feria_proyectos p where p.estado='aprobado' and p.titulo not like '[Emprendimiento familiar] %' and(e.id=p.estudiante_id or e.id=any(p.integrantes_ids)) and exists(select 1 from public.feria_programacion r where r.activo and (r.tipo='proyecto' or r.exposicion_invitada) and r.origen='claudina' and r.proyecto_id=p.id and r.fecha=dia and r.inicio<fin_recorrido and r.fin>desde));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre,p.id),'[]'::jsonb) into docentes from public.perfiles p where p.rol='profesor';
 select * into guardado from public.feria_planes_carrusel p where p.fecha=dia and p.inicio=desde and p.fin=hasta;
 return jsonb_build_object('segunda_franja',desde>=time '10:15' and hasta<=time '11:40','aulas',aulas,'visitantes',visitantes,'docentes',docentes,'plan',guardado.datos,'firma_guardada',guardado.firma,'version',coalesce(guardado.version,0),'firma',md5(jsonb_build_array(aulas,visitantes,docentes)::text));
end $$;
-- Incorporar las reservas existentes de exposiciones en aulas, sin recrearlas.
-- No convierte agenda general, descansos, teatro ni reservas de otros horarios.
update public.feria_programacion r set exposicion_invitada=true,version=r.version+1,actualizado_en=now()
from public.feria_espacios e
where r.espacio_id=e.id and e.activo and e.tipo='salon' and r.activo
and r.fecha=date '2026-11-06' and r.tipo='actividad' and not r.exposicion_invitada
and r.inicio=time '10:15' and r.fin between time '11:35' and time '11:40'
and not exists(select 1 from public.feria_agenda_general a where a.reserva_id=r.id);
notify pgrst,'reload schema';
commit;
