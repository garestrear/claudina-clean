-- Ejecutar completo después de ingles-musica.sql. Repetible; no modifica intentos.
begin;
create or replace function public.ingles_practicar_profesor(actividad text,elecciones jsonb,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;correctas text[];revision jsonb:='{}'::jsonb;puntos integer:=0;cantidad integer;i integer;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden practicar aquí';end if;
 select * into a from public.ingles_actividades where id=actividad;
 if a.id is null then raise exception 'Actividad no encontrada';end if;
 if solicitud is null or jsonb_typeof(elecciones) is distinct from 'object' or octet_length(elecciones::text)>10000 then raise exception 'Revisa tus respuestas';end if;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 cantidad:=coalesce(array_length(correctas,1),0);
 if cantidad=0 or (select count(*) from jsonb_object_keys(elecciones))<>cantidad then raise exception 'Completa todos los espacios';end if;
 for i in 1..cantidad loop
  if jsonb_typeof(elecciones->i::text) is distinct from 'string' or length(trim(elecciones->>i::text))=0 or length(elecciones->>i::text)>80 then raise exception 'Completa todos los espacios';end if;
  revision:=revision||jsonb_build_object(i::text,public.ingles_normalizar(elecciones->>i::text)=public.ingles_normalizar(correctas[i]));
  if (revision->>i::text)::boolean then puntos:=puntos+1;end if;
 end loop;
 return jsonb_build_object('respuestas',elecciones,'correccion',revision,'aciertos',puntos,'total',cantidad);
end;
$$;
revoke all on function public.ingles_practicar_profesor(text,jsonb,uuid) from public,anon;
grant execute on function public.ingles_practicar_profesor(text,jsonb,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
