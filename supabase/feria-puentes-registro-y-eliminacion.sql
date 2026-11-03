-- Inscribir puentes de otros estudiantes y eliminar registros incorrectos.
-- Ejecutar después de feria-puentes-inscripcion.sql. Compatible con tres intentos.
-- Repetible. Instalar este SQL no elimina ninguna inscripción.
begin;
create or replace function public.feria_puentes_inscripcion_contexto()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid:=public.feria_puentes_estudiante();
begin
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 return jsonb_build_object('docente',docente,'usuario',auth.uid(),'registro_para_otros',true,
 'ficha',(select jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) from public.estudiantes e where e.id=ficha),
 'companeros',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e join public.estudiantes f on f.id=ficha where e.activo and e.id<>ficha and (e.grado=f.grado or(e.grado in(7,8) and f.grado in(7,8)))),'[]'::jsonb),
 'puentes',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'bloqueado',exists(select 1 from public.feria_puentes_rondas r where r.puente_id=p.id),
  'equipo',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado) order by e.nombre,e.id) from public.estudiantes e where e.id=any(p.integrantes_ids)),'[]'::jsonb)) order by p.actualizado_en desc,p.id)
 from public.feria_puentes p where docente or p.creado_por=auth.uid() or ficha=any(p.integrantes_ids)),'[]'::jsonb));
end $$;

create or replace function public.feria_puentes_guardar(puente uuid,datos jsonb,version_esperada integer,solicitud_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha uuid:=public.feria_puentes_estudiante();
 p public.feria_puentes;ev public.feria_puentes_auditoria;equipo uuid[];nombres text;cat text;foto text;masa numeric;payload jsonb;
begin
 if auth.uid() is null or not(docente or ficha is not null) then raise exception 'Ingresa como estudiante activo o docente';end if;
 if puente is null or solicitud_id is null or jsonb_typeof(datos) is distinct from 'object' or octet_length(datos::text)>20000 then raise exception 'Solicitud no válida';end if;
 perform pg_advisory_xact_lock(20261106,444);
 payload:=jsonb_build_object('puente',puente,'datos',datos);
 select * into ev from public.feria_puentes_auditoria where solicitud=solicitud_id;
 if ev.solicitud is not null then
  if ev.actor<>auth.uid() or ev.accion<>'guardar_inscripcion' or ev.datos<>payload then raise exception 'Identificador de solicitud ya usado';end if;
  return public.feria_puentes_inscripcion_contexto();
 end if;
 select * into p from public.feria_puentes where id=puente for update;
 if p.id is not null and not docente and p.creado_por<>auth.uid() and not coalesce(ficha=any(p.integrantes_ids),false) then raise exception 'Solo quien inscribió el puente, su equipo o un docente pueden editarlo';end if;
 if version_esperada is distinct from coalesce(p.version,0) then raise exception 'La inscripción cambió. Actualiza la lista y vuelve a abrirla';end if;
 if exists(select 1 from public.feria_puentes_rondas where puente_id=puente) then raise exception 'La ficha ya tiene rondas y no se puede modificar';end if;
 if datos-array['titulo','categoria','integrantes_ids','masa_g','foto_path']<>'{}'::jsonb then raise exception 'Campos de inscripción no válidos';end if;
 if jsonb_typeof(datos->'titulo') is distinct from 'string' or length(trim(datos->>'titulo')) not between 1 and 150 then raise exception 'Escribe el nombre del puente (máximo 150 caracteres)';end if;
 cat:=datos->>'categoria';if cat is null or cat not in('puentes_infantil','puentes_juvenil') then raise exception 'Escoge la categoría infantil o juvenil';end if;
 if jsonb_typeof(datos->'integrantes_ids') is distinct from 'array' then raise exception 'Escoge los integrantes de la lista';end if;
 if jsonb_array_length(datos->'integrantes_ids')>100 or exists(select 1 from jsonb_array_elements(datos->'integrantes_ids') x where jsonb_typeof(x) is distinct from 'string' or (x#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Integrantes no válidos';end if;
 select coalesce(array_agg(x::uuid),'{}'::uuid[]) into equipo from jsonb_array_elements_text(datos->'integrantes_ids') x;
 if cardinality(equipo)=0 or cardinality(equipo)<>(select count(distinct x) from unnest(equipo) x) then raise exception 'Escoge al menos un estudiante, sin repetir integrantes';end if;
 if exists(select 1 from unnest(equipo) x where not exists(select 1 from public.estudiantes e where e.id=x and e.activo)) then raise exception 'Solo se pueden inscribir estudiantes activos del colegio';end if;
 select string_agg(e.nombre||' · '||case when e.grado=0 then 'TS y JR' else e.grado||'°' end,E'\n' order by e.nombre,e.id) into nombres from public.estudiantes e where e.id=any(equipo);
 masa:=nullif(datos->>'masa_g','')::numeric;
 if masa is not null and (masa<=0 or masa='NaN'::numeric or masa>9999999.999) then raise exception 'El peso debe ser positivo y estar expresado en gramos';end if;
 foto:=nullif(datos->>'foto_path','');
 if foto is not null and foto is distinct from p.foto_path and (
  split_part(foto,'/',1) is distinct from auth.uid()::text or split_part(foto,'/',2) is distinct from puente::text or
  not exists(select 1 from storage.objects where bucket_id='feria-puentes-fotos' and name=foto)) then raise exception 'La foto no está disponible para esta inscripción';end if;
 if p.id is null then
  insert into public.feria_puentes(id,origen,categoria,titulo,integrantes,integrantes_ids,masa_g,foto_path,creado_por)
  values(puente,'claudina',cat,trim(datos->>'titulo'),nombres,equipo,masa,foto,auth.uid());
 else
  update public.feria_puentes set titulo=trim(datos->>'titulo'),categoria=cat,integrantes=nombres,integrantes_ids=equipo,masa_g=masa,foto_path=foto,version=version+1,actualizado_en=now() where id=puente;
 end if;
 update public.feria_puentes_mesa set version=version+1 where id;
 insert into public.feria_puentes_auditoria(solicitud,actor,accion,datos) values(solicitud_id,auth.uid(),'guardar_inscripcion',payload);
 return public.feria_puentes_inscripcion_contexto();
end $$;
revoke all on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_guardar(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.feria_puentes_inscripcion_contexto(),public.feria_puentes_guardar(uuid,jsonb,integer,uuid) to authenticated;


create or replace function public.feria_puentes_foto_visible(ruta text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (coalesce(public.es_profesor(),false) or exists(
  select 1 from public.feria_puentes p where p.foto_path=ruta and public.feria_puentes_estudiante() is not null and (p.creado_por=auth.uid() or public.feria_puentes_estudiante()=any(p.integrantes_ids))) or
  (split_part(ruta,'/',1)=auth.uid()::text and public.feria_puentes_estudiante() is not null));
$$;

create or replace function public.feria_puentes_eliminar(
 puente uuid,version_esperada integer,solicitud_id uuid,confirmar_resultados boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_puentes;ev public.feria_puentes_auditoria;historial jsonb;
 peticion jsonb:=jsonb_build_object('puente',puente,'version',version_esperada,'confirmar_resultados',confirmar_resultados);
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden eliminar puentes';end if;
 if puente is null or solicitud_id is null or version_esperada is null then raise exception 'Solicitud no válida';end if;
 perform pg_advisory_xact_lock(20261106,444);
 select * into ev from public.feria_puentes_auditoria where solicitud=solicitud_id;
 if ev.solicitud is not null then
  if ev.actor<>auth.uid() or ev.accion<>'eliminar_inscripcion' or ev.datos->'peticion' is distinct from peticion then raise exception 'Identificador de solicitud ya usado';end if;
  return public.feria_puentes_inscripcion_contexto();
 end if;
 select * into p from public.feria_puentes where id=puente for update;
 if p.id is null then raise exception 'El puente ya no está registrado. Actualiza la lista';end if;
 if p.version is distinct from version_esperada then raise exception 'La inscripción cambió. Actualiza la lista antes de eliminar';end if;
 if exists(select 1 from public.feria_puentes_rondas where puente_id=puente and resultado='pendiente') then raise exception 'Resuelve o cancela el intento en curso antes de eliminar este puente';end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.numero),'[]'::jsonb) into historial from public.feria_puentes_rondas r where r.puente_id=puente;
 if jsonb_array_length(historial)>0 and not coalesce(confirmar_resultados,false) then raise exception 'Este puente tiene intentos registrados. Actualiza la lista y confirma también la eliminación de sus resultados';end if;
 -- Conserva los datos y el historial en la auditoría privada antes de retirarlos.
 insert into public.feria_puentes_auditoria(solicitud,actor,accion,datos)
 values(solicitud_id,auth.uid(),'eliminar_inscripcion',jsonb_build_object('peticion',peticion,'inscripcion',to_jsonb(p),'rondas',historial));
 update public.feria_puentes_mesa m set
  puente_id=case when m.puente_id=puente then null else m.puente_id end,
  ronda_id=case when m.puente_id=puente or m.ronda_id in(select r.id from public.feria_puentes_rondas r where r.puente_id=puente) then null else m.ronda_id end,
  operador=case when m.puente_id=puente then null else m.operador end,
  version=m.version+1 where m.id;
 delete from public.feria_puentes_rondas where puente_id=puente;
 delete from public.feria_puentes where id=puente;
 return public.feria_puentes_inscripcion_contexto();
end $$;
revoke all on function public.feria_puentes_eliminar(uuid,integer,uuid,boolean) from public,anon;
grant execute on function public.feria_puentes_eliminar(uuid,integer,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
