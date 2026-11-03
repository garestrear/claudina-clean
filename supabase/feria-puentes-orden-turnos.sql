-- Orden de turnos: menos intentos, menor grado y nombre del puente.
-- Ejecutar después de las migraciones de inscripción, tres intentos,
-- registro y eliminación, y descalificación. Repetible; solo cambia lecturas.
begin;
create or replace function public.feria_puentes_inscripcion_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid:=public.feria_puentes_estudiante();
begin
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 return jsonb_build_object('docente',docente,'usuario',auth.uid(),'registro_para_otros',true,'orden_turnos',true,
 'ficha',(select jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) from public.estudiantes e where e.id=ficha),
 'companeros',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e join public.estudiantes f on f.id=ficha where e.activo and e.id<>ficha and (e.grado=f.grado or(e.grado in(7,8) and f.grado in(7,8)))),'[]'::jsonb),
 'puentes',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'intentos_consumidos',(select count(*) from public.feria_puentes_rondas r where r.puente_id=p.id and r.cuenta_intento),
  'grado_turno',(select min(e.grado) from public.estudiantes e where e.id=any(p.integrantes_ids)),
  'bloqueado',p.estado='descalificado' or exists(select 1 from public.feria_puentes_rondas r where r.puente_id=p.id),
  'equipo',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb)) order by p.actualizado_en desc,p.id)
 from public.feria_puentes p where docente or p.creado_por=auth.uid() or ficha=any(p.integrantes_ids)),'[]'::jsonb));
end $$;

create or replace function public.feria_puentes_contexto() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden acceder al concurso de puentes';end if;
 return jsonb_build_object('orden_turnos',true,'modalidad','tres_intentos','ahora',clock_timestamp(),'usuario',auth.uid(),'config',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.feria_puentes_config c),'mesa',(select to_jsonb(m) from public.feria_puentes_mesa m),'puentes',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('grado_turno',(select min(e.grado) from public.estudiantes e where e.id=any(p.integrantes_ids)), 'intentos_consumidos',(select count(*) from public.feria_puentes_rondas rr where rr.puente_id=p.id and rr.cuenta_intento)) order by p.titulo),'[]'::jsonb) from public.feria_puentes p),'rondas',(select coalesce(jsonb_agg(to_jsonb(r) order by r.inicio,r.numero),'[]'::jsonb) from public.feria_puentes_rondas r));
end $$;
revoke all on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_contexto() from public,anon;
grant execute on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_contexto() to authenticated;
notify pgrst,'reload schema';
commit;
