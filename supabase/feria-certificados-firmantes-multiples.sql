-- Ejecutar después de feria-certificados-firmas.sql. Conserva configuración y certificados emitidos.
begin;
create or replace function public.feria_firmantes_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden administrar las firmas';end if;
 return(select jsonb_build_object('firmantes',c.firmantes,'version',c.version,'numero_firmantes',jsonb_array_length(c.firmantes)) from public.feria_certificado_config c where id);
end $$;
revoke all on function public.feria_firmantes_contexto() from public,anon;
grant execute on function public.feria_firmantes_contexto() to authenticated;
create or replace function public.feria_firmantes_guardar(firmantes jsonb,version_actual integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb;firma text;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden administrar las firmas';end if;
 if jsonb_typeof(firmantes) is distinct from 'array' then raise exception 'Selecciona entre uno y seis firmantes';end if;
 if jsonb_array_length(firmantes) not between 1 and 6 then raise exception 'Selecciona entre uno y seis firmantes';end if;
 for f in select value from jsonb_array_elements(firmantes) loop
  if jsonb_typeof(f) is distinct from 'object' or length(trim(coalesce(f->>'nombre',''))) not between 2 and 100 or length(trim(coalesce(f->>'cargo',''))) not between 2 and 100 then raise exception 'Revisa nombres y cargos de los firmantes';end if;
  firma:=nullif(f->>'firma','');
  if firma is not null and (length(firma)>450000 or firma !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$') then raise exception 'La firma debe ser PNG transparente y pesar menos de 330 KB';end if;
  if firma is not null and encode(substring(decode(substr(firma,23),'base64') from 1 for 8),'hex')<>'89504e470d0a1a0a' then raise exception 'El archivo de firma no es un PNG válido';end if;
 end loop;
 update public.feria_certificado_config c set firmantes=feria_firmantes_guardar.firmantes,version=c.version+1,actualizado_por=auth.uid(),actualizado_en=now() where id and c.version=version_actual;
 if not found then raise exception 'Otra persona actualizó las firmas. Recarga la página antes de guardar';end if;
 return public.feria_firmantes_contexto();
end $$;
revoke all on function public.feria_firmantes_guardar(jsonb,integer) from public,anon;
grant execute on function public.feria_firmantes_guardar(jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
