-- Ejecutar después de feria-agenda-general.sql y feria-carrusel.sql.
begin;
create or replace function public.feria_programacion_impresion(dia date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare bloques jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden imprimir la organización';end if;
 if dia is null then raise exception 'Selecciona una fecha';end if;
 select coalesce(jsonb_agg(jsonb_build_object('inicio',p.inicio,'fin',p.fin,'contexto',public.feria_carrusel_contexto(dia,p.inicio,p.fin)) order by p.inicio,p.fin),'[]'::jsonb)
 into bloques from public.feria_planes_carrusel p where p.fecha=dia;
 return public.feria_espacios_contexto() || jsonb_build_object('agenda',public.feria_agenda_contexto()->'actividades','carruseles',bloques);
end;$$;
revoke all on function public.feria_programacion_impresion(date) from public,anon;
grant execute on function public.feria_programacion_impresion(date) to authenticated;
notify pgrst,'reload schema';
commit;
