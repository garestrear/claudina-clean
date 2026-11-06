-- Género para personalizar el saludo. No modifica usuarios, visitas ni notas.
begin;
alter table public.feria_jurados add column if not exists genero text not null default '' check (genero in ('','F','M'));
create or replace function public.feria_jurado_genero_guardar(persona uuid,genero_nuevo text)
returns void language plpgsql security definer set search_path='' as $$begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden marcar el género del jurado';end if;
 if genero_nuevo is null or genero_nuevo not in ('','F','M') then raise exception 'Selecciona mujer, hombre o sin especificar';end if;
 update public.feria_jurados set genero=genero_nuevo where id=persona and eliminado_en is null;
 if not found then raise exception 'El jurado ya no está disponible';end if;
end $$;
revoke all on function public.feria_jurado_genero_guardar(uuid,text) from public,anon;
grant execute on function public.feria_jurado_genero_guardar(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
