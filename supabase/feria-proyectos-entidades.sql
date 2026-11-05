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
 select pg_get_functiondef('public.feria_carrusel_contexto(date,time,time)'::regprocedure) into d;
 d:=replace(d,$old$((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')))$old$,$new$(r.exposicion_invitada or ((r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or(r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado'))))$new$);
 d:=replace(d,$old$r.tipo='proyecto'$old$,$new$(r.tipo='proyecto' or r.exposicion_invitada)$new$);
 d:=replace(d,'count(distinct (r.origen,r.proyecto_id))','count(distinct r.id)');
 execute d;
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
notify pgrst,'reload schema';
commit;
