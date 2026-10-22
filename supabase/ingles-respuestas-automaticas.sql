-- Actualización completa: permite vacíos y clasificación en práctica. Reemplaza versiones anteriores. Ejecutar después de ingles-ranking-tiempo.sql.
-- Repetible: conserva resultados. Sin botones, revisión automática y error tras >3 segundos.
begin;
alter table public.ingles_actividades add column if not exists modo_actividad text not null default 'practica' check(modo_actividad in ('practica','evaluacion'));
alter table public.ingles_actividades add column if not exists duracion_audio numeric;
alter table public.ingles_actividades add column if not exists sincronizacion jsonb not null default '[]';
create table if not exists public.ingles_sesiones (
 solicitud_id uuid primary key,
 usuario_id uuid not null references public.perfiles(id) on delete cascade,
 actividad_id text not null references public.ingles_actividades(id) on delete cascade,
 modo_actividad text not null,
 duracion_audio numeric,
 respuestas jsonb not null default '{}',
 bloqueadas jsonb not null default '{}',
 fallos jsonb not null default '{}',
 solicitudes jsonb not null default '{}',
 escuchado numeric not null default 0,
 ultimo_pulso timestamptz,
 posicion numeric,
 resultado jsonb
);
alter table public.ingles_sesiones enable row level security;
revoke all on public.ingles_sesiones from public,anon,authenticated;
create or replace function public.ingles_configurar_modo(actividad text,modo text,duracion numeric,marcas jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;x jsonb;anterior numeric:=-1;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes';end if;
 select * into a from public.ingles_actividades where id=actividad for update;
 if a.id is null or modo not in ('practica','evaluacion') or modo is null or duracion is null or duracion<=0 or duracion>7200 then raise exception 'Carga el audio antes de configurar el modo';end if;
 if jsonb_typeof(marcas) is distinct from 'array' or jsonb_array_length(marcas) not in (0,array_length(string_to_array(a.contenido,E'\n'),1)) then raise exception 'Marca todas las líneas o deja la sincronización vacía';end if;
 for x in select value from jsonb_array_elements(marcas) loop
  if jsonb_typeof(x) is distinct from 'number' or x::text::numeric<anterior or x::text::numeric<0 or x::text::numeric>=duracion then raise exception 'Los tiempos deben estar ordenados dentro del audio';end if;
  anterior:=x::text::numeric;
 end loop;
 update public.ingles_actividades set modo_actividad=modo,duracion_audio=duracion,sincronizacion=marcas,updated_at=now() where id=actividad;
end;
$$;
create or replace function public.ingles_preparar(actividad text,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;s public.ingles_sesiones;
begin
 if auth.uid() is null or solicitud is null then raise exception 'Inicia sesión';end if;
 select * into a from public.ingles_actividades where id=actividad for share;
 if a.id is null or (not coalesce(public.es_profesor(),false) and not exists(select 1 from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo and a.publicada and e.grado=any(a.grados))) then raise exception 'Actividad no disponible';end if;
 if a.modo_actividad='evaluacion' and (a.duracion_audio is null or a.duracion_audio<=0) then raise exception 'El docente debe registrar la duración del audio';end if;
 insert into public.ingles_sesiones(solicitud_id,usuario_id,actividad_id,modo_actividad,duracion_audio) values(solicitud,auth.uid(),actividad,a.modo_actividad,a.duracion_audio) on conflict do nothing;
 select * into s from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad;
 if s.solicitud_id is null then raise exception 'Intento no válido';end if;
 if s.modo_actividad<>a.modo_actividad then raise exception 'El docente cambió el modo; inicia otro intento';end if;
 if not coalesce(public.es_profesor(),false) then perform public.ingles_iniciar_intento(actividad,solicitud);end if;
 return jsonb_build_object('modo',s.modo_actividad);
end;
$$;
create or replace function public.ingles_comprobar(actividad text,solicitud uuid,espacio integer,respuesta text,envio uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ingles_sesiones;a public.ingles_actividades;correctas text[];bien boolean;numero_fallos integer;salida jsonb;clave text:=espacio::text;
begin
 perform public.ingles_preparar(actividad,solicitud);
 select * into s from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() for update;
 if s.resultado is not null then raise exception 'Intento finalizado';end if;
 if envio is null or respuesta is null or length(trim(respuesta))=0 or length(respuesta)>80 then raise exception 'Escribe una respuesta';end if;
 if s.solicitudes ? envio::text then return s.solicitudes->envio::text;end if;
 if s.bloqueadas ? clave then return jsonb_build_object('correcta',(s.bloqueadas->>clave)::boolean,'bloqueada',true,'fallos',coalesce((s.fallos->>clave)::integer,0),'respuesta',s.respuestas->>clave);end if;
 select * into a from public.ingles_actividades where id=actividad;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 if espacio is null or espacio<1 or espacio>array_length(correctas,1) then raise exception 'Espacio no válido';end if;
 bien:=public.ingles_normalizar(respuesta)=public.ingles_normalizar(correctas[espacio]);
 numero_fallos:=coalesce((s.fallos->>clave)::integer,0)+case when bien then 0 else 1 end;
 salida:=jsonb_build_object('correcta',bien,'bloqueada',bien or numero_fallos>=2,'fallos',numero_fallos,'respuesta',respuesta);
 update public.ingles_sesiones set respuestas=respuestas||jsonb_build_object(clave,respuesta),fallos=ingles_sesiones.fallos||jsonb_build_object(clave,numero_fallos),bloqueadas=case when bien or numero_fallos>=2 then bloqueadas||jsonb_build_object(clave,bien) else bloqueadas end,solicitudes=solicitudes||jsonb_build_object(envio::text,salida) where solicitud_id=solicitud;
 return salida;
end;
$$;
-- Versiones por espacio impiden que una respuesta de red atrasada reemplace texto nuevo.
alter table public.ingles_sesiones add column if not exists ediciones jsonb not null default '{}';
alter table public.ingles_sesiones add column if not exists cambios_at jsonb not null default '{}';
create or replace function public.ingles_auto(actividad text,solicitud uuid,espacio integer,respuesta text,edicion bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ingles_sesiones;a public.ingles_actividades;correctas text[];bien boolean;cerrada boolean;clave text:=espacio::text;ahora timestamptz:=clock_timestamp();cambio timestamptz;previa bigint;
begin
 perform public.ingles_preparar(actividad,solicitud);
 select * into s from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() for update;
 if s.resultado is not null then raise exception 'Intento finalizado';end if;
 if respuesta is null or length(respuesta)>80 or edicion is null or edicion<1 or edicion>1000000000 then raise exception 'Respuesta no válida';end if;
 select * into a from public.ingles_actividades where id=actividad;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 if espacio is null or espacio<1 or espacio>array_length(correctas,1) then raise exception 'Espacio no válido';end if;
 if s.bloqueadas ? clave then return jsonb_build_object('correcta',(s.bloqueadas->>clave)::boolean,'bloqueada',true,'respuesta',s.respuestas->>clave,'error_tiempo',not (s.bloqueadas->>clave)::boolean);end if;
 previa:=coalesce((s.ediciones->>clave)::bigint,0);
 if edicion<previa then return jsonb_build_object('obsoleta',true,'bloqueada',false);end if;
 if edicion=previa and (s.respuestas->>clave) is distinct from respuesta then raise exception 'Versión de respuesta no válida';end if;
 cambio:=case when (s.respuestas->>clave) is distinct from respuesta then ahora else coalesce((s.cambios_at->>clave)::timestamptz,ahora) end;
 bien:=public.ingles_normalizar(respuesta)=public.ingles_normalizar(correctas[espacio]);
 -- Tres letras como mínimo, y MÁS de tres segundos con la misma respuesta.
 cerrada:=bien or (length(regexp_replace(respuesta,'[^[:alpha:]]','','g'))>=3 and extract(epoch from (ahora-cambio))>3);
 update public.ingles_sesiones set respuestas=respuestas||jsonb_build_object(clave,respuesta),ediciones=ediciones||jsonb_build_object(clave,edicion),cambios_at=cambios_at||jsonb_build_object(clave,cambio),bloqueadas=case when cerrada then bloqueadas||jsonb_build_object(clave,bien) else bloqueadas end,fallos=case when cerrada and not bien then fallos||jsonb_build_object(clave,1) else fallos end where solicitud_id=solicitud;
 return jsonb_build_object('correcta',case when cerrada then bien else null end,'bloqueada',cerrada,'respuesta',respuesta,'error_tiempo',cerrada and not bien);
end;
$$;
-- La confirmación manual anterior no puede eludir el nuevo temporizador.
revoke all on function public.ingles_comprobar(text,uuid,integer,text,uuid) from public,anon,authenticated;
create or replace function public.ingles_pulso(actividad text,solicitud uuid,posicion_audio numeric,reproduciendo boolean)
returns numeric language plpgsql security definer set search_path='' as $$
declare s public.ingles_sesiones;ahora timestamptz:=clock_timestamp();transcurrido numeric;avance numeric;credito numeric:=0;
begin
 perform public.ingles_preparar(actividad,solicitud);
 select * into s from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() for update;
 if s.resultado is not null then return s.escuchado;end if;
 if posicion_audio is null or posicion_audio<0 or posicion_audio>coalesce(s.duracion_audio,7200)+1 or reproduciendo is null then raise exception 'Posición no válida';end if;
 transcurrido:=extract(epoch from (ahora-s.ultimo_pulso));avance:=posicion_audio-s.posicion;
 -- Un pulso como máximo cada cinco segundos; tolerancia de red hasta ocho.
 -- Adelantar el reproductor no acredita tiempo. Pausas y pestaña oculta envían false.
 if reproduciendo and transcurrido between 0 and 8 and avance>0 and avance<=transcurrido*1.15+0.3 then credito:=least(avance,transcurrido,6);end if;
 update public.ingles_sesiones set escuchado=least(coalesce(duracion_audio,7200),escuchado+credito),ultimo_pulso=ahora,posicion=posicion_audio where solicitud_id=solicitud returning escuchado into credito;
 return credito;
end;
$$;
create or replace function public.ingles_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha public.estudiantes;salida jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if not docente then
  select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
  if ficha.id is null then raise exception 'Esta actividad es para estudiantes con ficha activa';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'modo_actividad',a.modo_actividad,'duracion_audio',a.duracion_audio,'sincronizacion',a.sincronizacion,'id',a.id,'titulo',a.titulo,'instrucciones',a.instrucciones,'audio',a.audio,
  'contenido',regexp_replace(a.contenido,'\[\[[^]]+\]\]','_____','g'),
  'banco',case when a.banco then (select jsonb_agg(palabra order by palabra) from (select distinct m[1] palabra from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m) x) else '[]'::jsonb end,
  'banco_activo',a.banco,'publicada',a.publicada,'grados',a.grados,'updated_at',a.updated_at,
  'mi_progreso',(select to_jsonb(p)-'usuario_id'-'estudiante_id'-'solicitud_id' from public.ingles_progreso p where p.actividad_id=a.id and p.usuario_id=auth.uid()),
  'ultima_respuesta',case when docente then(select max(p.updated_at) from public.ingles_progreso p where p.actividad_id=a.id) else null end,
  'total_respuestas',case when docente then(select count(*) from public.ingles_progreso p where p.actividad_id=a.id) else null end
 ) order by a.titulo),'[]'::jsonb) into salida from public.ingles_actividades a where docente or(a.publicada and ficha.grado=any(a.grados));
 return salida;
end;
$$;
create or replace function public.ingles_responder(actividad text,elecciones jsonb,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;ficha public.estudiantes;correctas text[];revision jsonb:='{}'::jsonb;puntos integer:=0;cantidad integer;i integer;salida public.ingles_progreso;inicio timestamptz;duracion numeric;fecha timestamptz:=clock_timestamp();ses public.ingles_sesiones;penalizado boolean:=false;real_aciertos integer;texto text;enviadas jsonb;oficiales jsonb:='{}'::jsonb;
begin
 if auth.uid() is null or coalesce(public.es_profesor(),false) then raise exception 'Ingresa como estudiante para guardar el intento';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 select * into a from public.ingles_actividades where id=actividad for share;
 if ficha.id is null or a.id is null or not a.publicada or not(ficha.grado=any(a.grados)) then raise exception 'La actividad no está disponible para tu grado';end if;
 if solicitud is null or jsonb_typeof(elecciones) is distinct from 'object' or octet_length(elecciones::text)>10000 then raise exception 'Revisa tus respuestas';end if;
 select * into ses from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad for update;
 if ses.solicitud_id is null then raise exception 'Inicia un intento con la versión actualizada de la app';end if;
 if ses.resultado is not null then return ses.resultado;end if;
 if ses.modo_actividad<>a.modo_actividad then raise exception 'El docente cambió el modo; inicia otro intento';end if;
 enviadas:=elecciones;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 cantidad:=coalesce(array_length(correctas,1),0);
 if cantidad=0 or exists(select 1 from jsonb_object_keys(enviadas) k where k !~ '^[1-9][0-9]*$' or length(k)>5) then raise exception 'Respuestas no válidas';end if;
 if exists(select 1 from jsonb_object_keys(enviadas) k where k::integer>cantidad) then raise exception 'Espacio no válido';end if;
 for i in 1..cantidad loop
  if enviadas ? i::text and (jsonb_typeof(enviadas->i::text) is distinct from 'string' or length(enviadas->>i::text)>80) then raise exception 'Respuesta no válida';end if;
  texto:=case when ses.bloqueadas ? i::text then ses.respuestas->>i::text else coalesce(enviadas->>i::text,'') end;
  oficiales:=oficiales||jsonb_build_object(i::text,texto);
  revision:=revision||jsonb_build_object(i::text,case when ses.bloqueadas ? i::text then (ses.bloqueadas->>i::text)::boolean else length(trim(texto))>0 and public.ingles_normalizar(texto)=public.ingles_normalizar(correctas[i]) end);
  if (revision->>i::text)::boolean then puntos:=puntos+1;end if;
 end loop;
 elecciones:=oficiales;
 update public.ingles_sesiones set respuestas=oficiales,bloqueadas=revision where solicitud_id=solicitud;
 real_aciertos:=puntos;
 penalizado:=ses.modo_actividad='evaluacion' and puntos::numeric/cantidad>0.9 and ses.escuchado<ses.duracion_audio*0.7;
 if penalizado then puntos:=0;end if;
 select iniciada_at,coalesce(finalizada_at,fecha) into inicio,fecha from public.ingles_intentos_tiempo where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad for update;
 if inicio is null then fecha:=clock_timestamp();end if;
 if exists(select 1 from public.ingles_intentos_tiempo t where t.solicitud_id=solicitud and t.finalizada_at is not null) and not exists(select 1 from public.ingles_progreso p where p.actividad_id=actividad and p.usuario_id=auth.uid() and p.solicitud_id=solicitud) then raise exception 'Inicia otro intento';end if;
 duracion:=case when inicio is not null then greatest(0,extract(epoch from (fecha-inicio))) end;
 insert into public.ingles_progreso as p(actividad_id,usuario_id,estudiante_id,respuestas,correccion,aciertos,total,mejor_aciertos,solicitud_id,mejor_tiempo_segundos,mejor_logrado_at)
 values(a.id,auth.uid(),ficha.id,elecciones,revision,puntos,cantidad,puntos,solicitud,duracion,case when duracion is not null then fecha end)
 on conflict(actividad_id,usuario_id) do update set respuestas=excluded.respuestas,correccion=excluded.correccion,aciertos=excluded.aciertos,total=excluded.total,intentos=p.intentos+1,mejor_aciertos=greatest(p.mejor_aciertos,excluded.aciertos),solicitud_id=excluded.solicitud_id,updated_at=now(),
 mejor_tiempo_segundos=case when excluded.aciertos>p.mejor_aciertos or (excluded.aciertos=p.mejor_aciertos and excluded.mejor_tiempo_segundos is not null and (p.mejor_tiempo_segundos is null or excluded.mejor_tiempo_segundos<p.mejor_tiempo_segundos)) then excluded.mejor_tiempo_segundos else p.mejor_tiempo_segundos end,
 mejor_logrado_at=case when excluded.aciertos>p.mejor_aciertos or (excluded.aciertos=p.mejor_aciertos and excluded.mejor_tiempo_segundos is not null and (p.mejor_tiempo_segundos is null or excluded.mejor_tiempo_segundos<p.mejor_tiempo_segundos)) then excluded.mejor_logrado_at else p.mejor_logrado_at end
 where p.solicitud_id<>excluded.solicitud_id returning * into salida;
 if salida.actividad_id is null then select * into salida from public.ingles_progreso where actividad_id=a.id and usuario_id=auth.uid();end if;
 update public.ingles_intentos_tiempo set finalizada_at=coalesce(finalizada_at,fecha) where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad;
 update public.ingles_sesiones set resultado=(to_jsonb(salida)-'usuario_id'-'estudiante_id'-'solicitud_id')||jsonb_build_object('penalizado',penalizado,'aciertos_reales',real_aciertos,'escuchado',ses.escuchado,'mensaje',case when penalizado then 'Recuerda que arriba hay un dios que todo lo ve, no hagas trampa. La mejor forma de que aprendas es haciendo la actividad como se debe.' else '' end) where solicitud_id=solicitud returning resultado into revision;
 return revision;
end;
$$;

revoke all on function public.ingles_preparar(text,uuid),public.ingles_comprobar(text,uuid,integer,text,uuid),public.ingles_pulso(text,uuid,numeric,boolean),public.ingles_configurar_modo(text,text,numeric,jsonb) from public,anon;
grant execute on function public.ingles_preparar(text,uuid),public.ingles_auto(text,uuid,integer,text,bigint),public.ingles_pulso(text,uuid,numeric,boolean),public.ingles_configurar_modo(text,text,numeric,jsonb) to authenticated;
revoke all on function public.ingles_auto(text,uuid,integer,text,bigint) from public,anon;
create or replace function public.ingles_practicar_profesor(actividad text,elecciones jsonb,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;correctas text[];revision jsonb:='{}'::jsonb;puntos integer:=0;cantidad integer;i integer;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden practicar aquí';end if;
 select * into a from public.ingles_actividades where id=actividad;
 if a.id is null then raise exception 'Actividad no encontrada';end if;
 if solicitud is null or jsonb_typeof(elecciones) is distinct from 'object' or octet_length(elecciones::text)>10000 then raise exception 'Revisa tus respuestas';end if;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 cantidad:=coalesce(array_length(correctas,1),0);
 if cantidad=0 then raise exception 'Actividad sin espacios';end if;
 for i in 1..cantidad loop
  if not (elecciones ? i::text) then elecciones:=elecciones||jsonb_build_object(i::text,'');end if;
  if jsonb_typeof(elecciones->i::text) is distinct from 'string' or length(elecciones->>i::text)>80 then raise exception 'Respuesta no válida';end if;
  revision:=revision||jsonb_build_object(i::text,public.ingles_normalizar(elecciones->>i::text)=public.ingles_normalizar(correctas[i]));
  if (revision->>i::text)::boolean then puntos:=puntos+1;end if;
 end loop;
 return jsonb_build_object('respuestas',elecciones,'correccion',revision,'aciertos',puntos,'total',cantidad);
end;
$$;
revoke all on function public.ingles_practicar_profesor(text,jsonb,uuid) from public,anon;
grant execute on function public.ingles_practicar_profesor(text,jsonb,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
