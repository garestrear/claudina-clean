-- Ejecutar después de feria-participantes-certificados.sql. No cambia certificados emitidos.
begin;
create table if not exists public.feria_certificado_config(
 id boolean primary key default true check(id),firmantes jsonb not null,
 version integer not null default 1,actualizado_por uuid,actualizado_en timestamptz not null default now()
);
alter table public.feria_certificado_config enable row level security;
revoke all on public.feria_certificado_config from public,anon,authenticated;
insert into public.feria_certificado_config(id,firmantes) values(true,'[{"nombre":"YASMITH BERNAL","cargo":"Directora","firma":null},{"nombre":"GUSTAVO ADOLFO RESTREPO ARBOLEDA","cargo":"Docente líder PRAE - Organizador Feria STEAM","firma":null}]') on conflict(id) do nothing;
create or replace function public.feria_firmantes_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden administrar las firmas';end if;
 return(select jsonb_build_object('firmantes',c.firmantes,'version',c.version) from public.feria_certificado_config c where id);
end $$;
revoke all on function public.feria_firmantes_contexto() from public,anon;
grant execute on function public.feria_firmantes_contexto() to authenticated;
create or replace function public.feria_firmantes_guardar(firmantes jsonb,version_actual integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb;firma text;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden administrar las firmas';end if;
 if jsonb_typeof(firmantes) is distinct from 'array' then raise exception 'Selecciona dos firmantes';end if;
 if jsonb_array_length(firmantes)<>2 then raise exception 'Selecciona dos firmantes';end if;
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
-- Cada emisión conserva su propia copia de nombres, cargos y firmas.
create or replace function public.feria_certificado_emitir(persona uuid,confirmar boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_participantes;datos jsonb;firmantes jsonb;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden confirmar participación y emitir certificados';end if;
 if confirmar is distinct from true then raise exception 'Confirma que la persona participó en la feria en la función indicada';end if;
 select * into p from public.feria_participantes where id=persona for update;
 if p.id is null then raise exception 'Participante no disponible';end if;
 if exists(select 1 from public.feria_certificados where participante_id=persona and anulado_en is null) then return public.feria_participantes_contexto();end if;
 datos:=public.feria_participante_datos(persona);
 if datos->'habilitado' is distinct from 'true'::jsonb then raise exception 'El participante debe estar activo y su proyecto, si corresponde, aprobado';end if;
 select c.firmantes into firmantes from public.feria_certificado_config c where id;
 if firmantes is null then raise exception 'Configura los firmantes antes de emitir';end if;
 insert into public.feria_certificados(participante_id,contenido,emitido_por)
 values(persona,datos||jsonb_build_object('evento','Feria STEAM 2026','fecha_evento','6 de noviembre de 2026','lugar','Caldas, Antioquia','firmantes',firmantes,'diseno_certificado',2),auth.uid());
 return public.feria_participantes_contexto();
end $$;
revoke all on function public.feria_certificado_emitir(uuid,boolean) from public,anon;
grant execute on function public.feria_certificado_emitir(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
