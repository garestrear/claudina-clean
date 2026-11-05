-- Ejecutar después de feria-correcciones-docentes.sql y feria-familias-estados.sql.
-- Cambia tipo y áreas sin borrar el proyecto ni sus participantes.
begin;
create or replace function public.feria_cambiar_tipo(proyecto uuid,tipo text,areas text[],version_esperada integer,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.feria_proyectos;previa public.feria_correcciones_docentes;
 prefijo constant text:='[Emprendimiento familiar] ';tipo_anterior text;titulo_nuevo text;
 categoria_nueva text;placa public.feria_placas;numero_nuevo integer;nombre text;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo los profesores pueden cambiar el tipo de participación';end if;
 if proyecto is null or solicitud is null or version_esperada is null or tipo is null or tipo not in('familiar','estudiantil') then raise exception 'Revisa el tipo de participación';end if;
 if areas is null or cardinality(areas) not between 1 and 6 or array_position(areas,null) is not null or not(areas<@array['science','technology','engineering','arts','mathematics','emprendimiento']::text[]) or cardinality(areas)<>(select count(distinct a) from unnest(areas) a) then raise exception 'Selecciona una o varias áreas STEAM válidas, sin repetir';end if;
 select * into p from public.feria_proyectos where id=proyecto for update;
 if p.id is null then raise exception 'Proyecto no disponible';end if;
 select * into previa from public.feria_correcciones_docentes c where c.solicitud=feria_cambiar_tipo.solicitud;
 if previa.id is not null then
  if previa.docente_id<>auth.uid() or previa.origen<>'claudina' or previa.proyecto_id<>proyecto or previa.despues->>'tipo_participacion' is distinct from tipo or previa.despues->'areas' is distinct from to_jsonb(areas) then raise exception 'Solicitud de cambio no válida';end if;
  return public.feria_proyecto(proyecto);
 end if;
 if p.version<>version_esperada then raise exception 'El proyecto cambió. Vuelve a abrirlo antes de guardar';end if;
 tipo_anterior:=case when starts_with(p.titulo,prefijo) then 'familiar' else 'estudiantil' end;
 titulo_nuevo:=case when tipo_anterior='familiar' then substr(p.titulo,length(prefijo)+1) else p.titulo end;
 if tipo='familiar' then titulo_nuevo:=prefijo||titulo_nuevo;end if;
 if length(titulo_nuevo)>150 or length(trim(case when tipo='familiar' then substr(titulo_nuevo,length(prefijo)+1) else titulo_nuevo end))<3 then raise exception 'Revisa la longitud del título antes de cambiar el tipo';end if;
 if tipo=tipo_anterior and areas=p.areas then return public.feria_proyecto(proyecto);end if;
 update public.feria_proyectos set titulo=titulo_nuevo,areas=feria_cambiar_tipo.areas,version=p.version+1,revision_contenido=p.revision_contenido+1,actualizado_en=now() where id=proyecto;
 -- Conserva el número general; asigna un número libre dentro de la categoría correcta.
 categoria_nueva:=case when tipo='familiar' then 'familias' when 'emprendimiento'=any(areas) then 'emprendimiento' when 'arts'=any(areas) then 'arte' else 'stem' end;
 select * into placa from public.feria_placas pl where pl.origen='claudina' and pl.proyecto_id=proyecto for update;
 if placa.proyecto_id is not null and placa.categoria<>categoria_nueva then
  update public.feria_placa_contadores set ultimo=ultimo+1 where clave=categoria_nueva returning ultimo into numero_nuevo;
  if numero_nuevo is null then raise exception 'No está configurado el contador de la categoría';end if;
  update public.feria_placas pl set categoria=categoria_nueva,numero_categoria=numero_nuevo where pl.origen='claudina' and pl.proyecto_id=proyecto;
 end if;
 select pf.nombre into nombre from public.perfiles pf where pf.id=auth.uid();
 insert into public.feria_correcciones_docentes(origen,proyecto_id,docente_id,nombre_docente,antes,despues,version_anterior,solicitud)
 values('claudina',proyecto,auth.uid(),coalesce(nombre,'Docente'),jsonb_build_object('tipo_participacion',tipo_anterior,'areas',p.areas,'titulo',p.titulo),jsonb_build_object('tipo_participacion',tipo,'areas',areas,'titulo',titulo_nuevo),p.version,solicitud);
 return public.feria_proyecto(proyecto);
end $$;
revoke all on function public.feria_cambiar_tipo(uuid,text,text[],integer,uuid) from public,anon;
grant execute on function public.feria_cambiar_tipo(uuid,text,text[],integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
