-- Ejecutar completo una vez en el SQL Editor de Supabase.
-- Actividad de práctica de escucha para 6°, 7° y 8°.
begin;
create table if not exists public.ingles_actividades (
 id text primary key,
 titulo text not null,
 instrucciones text not null,
 audio text not null,
 contenido text not null,
 grados integer[] not null default array[6,7,8],
 banco boolean not null default true,
 publicada boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.ingles_progreso (
 actividad_id text not null references public.ingles_actividades(id),
 usuario_id uuid not null references public.perfiles(id) on delete cascade,
 estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
 respuestas jsonb not null,
 correccion jsonb not null,
 aciertos integer not null,
 total integer not null,
 intentos integer not null default 1,
 mejor_aciertos integer not null,
 solicitud_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(actividad_id,usuario_id)
);
alter table public.ingles_actividades enable row level security;
alter table public.ingles_progreso enable row level security;
revoke all on public.ingles_actividades,public.ingles_progreso from anon,authenticated;
create or replace function public.ingles_normalizar(valor text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(lower(trim(coalesce(valor,''))),'[^a-z0-9]','','g');
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
  'id',a.id,'titulo',a.titulo,'instrucciones',a.instrucciones,'audio',a.audio,
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
declare a public.ingles_actividades;ficha public.estudiantes;correctas text[];revision jsonb:='{}'::jsonb;puntos integer:=0;cantidad integer;i integer;salida public.ingles_progreso;
begin
 if auth.uid() is null or coalesce(public.es_profesor(),false) then raise exception 'Ingresa como estudiante para guardar el intento';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 select * into a from public.ingles_actividades where id=actividad for share;
 if ficha.id is null or a.id is null or not a.publicada or not(ficha.grado=any(a.grados)) then raise exception 'La actividad no está disponible para tu grado';end if;
 if solicitud is null or jsonb_typeof(elecciones) is distinct from 'object' or octet_length(elecciones::text)>10000 then raise exception 'Revisa tus respuestas';end if;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 cantidad:=coalesce(array_length(correctas,1),0);
 if cantidad=0 or (select count(*) from jsonb_object_keys(elecciones))<>cantidad then raise exception 'Completa todos los espacios';end if;
 for i in 1..cantidad loop
  if jsonb_typeof(elecciones->i::text) is distinct from 'string' or length(trim(elecciones->>i::text))=0 or length(elecciones->>i::text)>80 then raise exception 'Completa todos los espacios';end if;
  revision:=revision||jsonb_build_object(i::text,public.ingles_normalizar(elecciones->>i::text)=public.ingles_normalizar(correctas[i]));
  if (revision->>i::text)::boolean then puntos:=puntos+1;end if;
 end loop;
 insert into public.ingles_progreso as p(actividad_id,usuario_id,estudiante_id,respuestas,correccion,aciertos,total,mejor_aciertos,solicitud_id)
 values(a.id,auth.uid(),ficha.id,elecciones,revision,puntos,cantidad,puntos,solicitud)
 on conflict(actividad_id,usuario_id) do update set respuestas=excluded.respuestas,correccion=excluded.correccion,aciertos=excluded.aciertos,total=excluded.total,intentos=p.intentos+1,mejor_aciertos=greatest(p.mejor_aciertos,excluded.aciertos),solicitud_id=excluded.solicitud_id,updated_at=now()
 where p.solicitud_id<>excluded.solicitud_id returning * into salida;
 if salida.actividad_id is null then select * into salida from public.ingles_progreso where actividad_id=a.id and usuario_id=auth.uid();end if;
 return to_jsonb(salida)-'usuario_id'-'estudiante_id'-'solicitud_id';
end;
$$;
create or replace function public.ingles_resultados(actividad text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden consultar resultados';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'grado',e.grado,'intentos',p.intentos,'aciertos',p.aciertos,'total',p.total,'mejor_aciertos',p.mejor_aciertos,'updated_at',p.updated_at) order by e.grado,e.nombre) from public.ingles_progreso p join public.estudiantes e on e.id=p.estudiante_id where p.actividad_id=actividad),'[]'::jsonb);
end;
$$;
create or replace function public.ingles_configurar(actividad text,banco_visible boolean,abierta boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden configurar actividades';end if;
 if banco_visible is null or abierta is null then raise exception 'Configuración inválida';end if;
 update public.ingles_actividades set banco=banco_visible,publicada=abierta,updated_at=now() where id=actividad;
 if not found then raise exception 'Actividad no encontrada';end if;
end;
$$;
revoke all on function public.ingles_normalizar(text),public.ingles_contexto(),public.ingles_responder(text,jsonb,uuid),public.ingles_resultados(text),public.ingles_configurar(text,boolean,boolean) from public,anon;
grant execute on function public.ingles_contexto(),public.ingles_responder(text,jsonb,uuid),public.ingles_resultados(text),public.ingles_configurar(text,boolean,boolean) to authenticated;

insert into public.ingles_actividades(id,titulo,instrucciones,audio,contenido) values ('lemon-tree','Lemon Tree · Fools Garden','Escucha las primeras tres estrofas y completa las 7 palabras. Puedes pausar y repetir. Algunas palabras se usan más de una vez.','/audio/lemon-tree.mp3',$letra$I'm sitting here in the boring [[room]]
It's just another rainy Sunday afternoon
I'm wasting my[[time]]
I got nothing to do
I'm hanging around
I'm [[waiting]] for you
But nothing ever happens and I wonder

I'm driving around in my [[car]] 
I'm driving too fast
I'm driving too far
I'd like to change my point of view
I feel so lonely
I'm [[waiting]] for you
But nothing ever happens and I [[wonder]]

I wonder how
I wonder why
Yesterday you told me 'bout the blue blue sky
And all that I can see is just a yellow [[lemon-tree]]
I'm turning my head up and down
I'm turning turning turning turning turning around
And all that I can see is just another lemon-tree$letra$) on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
