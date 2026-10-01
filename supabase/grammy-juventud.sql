-- Grammy de la Juventud: votación directa, estudiantes activos de 6°, 7° y 8°.
-- Ejecutar una vez en Supabase > SQL Editor. Puede repetirse sin borrar votos.
begin;
create table if not exists public.grammy_config(
 id smallint primary key default 1 check(id=1),
 abierto boolean not null default false,
 resultados_publicados boolean not null default false,
 check(not (abierto and resultados_publicados))
);
insert into public.grammy_config(id) values(1) on conflict do nothing;
create table if not exists public.grammy_categorias(
 id integer primary key,
 orden integer not null,
 titulo text not null check(length(trim(titulo)) between 1 and 150),
 descripcion text not null default '' check(length(descripcion)<=500),
 habilitada boolean not null default true
);
insert into public.grammy_categorias(id,orden,titulo,descripcion) values
(1,1,'El que trabaja con morro','Trabaja con cara de protesta, pero trabaja.'),
(2,2,'El o la que siempre tiene sueño',''),
(3,3,'El o la que no puede vivir sin el celular en la mano',''),
(4,4,'El rey o reina de la IA','Siempre hace las tareas con IA.'),
(5,5,'Su majestad «Profe, hagamos otra cosa»',''),
(6,6,'Embajador(a) Kahoot','Siempre quiere jugar Kahoot.'),
(7,7,'Príncipe o princesa de la madrugación','Siempre madruga.'),
(8,8,'Al que se le pegan las cobijas','Le cuesta despegarse de las cobijas.'),
(9,9,'El más parado o la más parada','Se le mide a todo.'),
(10,10,'Free Fire lover',''),
(11,11,'El más romántico','Categoría propuesta para hombres.'),
(12,12,'La más sentimental','Categoría propuesta para mujeres.'),
(13,13,'Su majestad «Mañana te pago»',''),
(14,14,'El más cobrón',''),
(15,15,'El más platudo',''),
(16,16,'El que nunca tiene con qué escribir',''),
(17,17,'Señor o señora Repitis',''),
(18,18,'El o la que no se pierde la movida de un catre','Va a todo.'),
(19,19,'Señor o señora «Profe, revise la tarea»',''),
(20,20,'El más amarrado o la más amarrada',''),
(21,21,'Su majestad del relajo',''),
(22,22,'Al que va perdiendo hasta la risa','')
on conflict(id) do nothing;
create table if not exists public.grammy_votos(
 autor uuid not null references auth.users(id) on delete cascade,
 categoria_id integer not null references public.grammy_categorias(id) on delete cascade,
 candidato_id uuid not null references public.estudiantes(id) on delete cascade,
 updated_at timestamptz not null default now(),
 primary key(autor,categoria_id)
);
alter table public.grammy_config enable row level security;
alter table public.grammy_categorias enable row level security;
alter table public.grammy_votos enable row level security;
revoke all on public.grammy_config,public.grammy_categorias,public.grammy_votos from anon,authenticated;
-- Todas las operaciones pasan por funciones con comprobación de identidad.
create or replace function public.grammy_puede_participar()
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo and grado in(6,7,8));
$$;
revoke all on function public.grammy_puede_participar() from public;
grant execute on function public.grammy_puede_participar() to authenticated;

create or replace function public.grammy_conteo()
returns jsonb language sql stable security definer set search_path=public
as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.orden,t.votos desc,t.nombre),'[]'::jsonb)
 from (
 select c.id categoria_id,c.orden,c.titulo,e.id candidato_id,e.nombre,e.grado,count(*)::integer votos
 from public.grammy_votos v
 join public.grammy_categorias c on c.id=v.categoria_id and c.habilitada
 join public.estudiantes e on e.id=v.candidato_id and e.activo and e.grado in(6,7,8)
 where exists(select 1 from public.estudiantes votante where votante.auth_user_id=v.autor and votante.activo and votante.grado in(6,7,8))
 group by c.id,c.orden,c.titulo,e.id,e.nombre,e.grado
 )t;
$$;
-- Función interna: los alumnos no pueden consultar el conteo antes de publicar.
revoke all on function public.grammy_conteo() from public,anon,authenticated;

create or replace function public.grammy_contexto()
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare profesor boolean:=public.es_profesor();config jsonb;conteo jsonb;ganadores jsonb;
begin
 if auth.uid() is null or not(profesor or public.grammy_puede_participar()) then
  raise exception 'Esta votación es para estudiantes activos de 6°, 7° y 8° y profesores.';
 end if;
 select to_jsonb(c) into config from public.grammy_config c where id=1;
 if profesor or (config->>'resultados_publicados')::boolean then
  conteo:=public.grammy_conteo();
  select coalesce(jsonb_agg(x),'[]'::jsonb) into ganadores
  from jsonb_array_elements(conteo) x
  where (x->>'votos')::integer=(select max((y->>'votos')::integer) from jsonb_array_elements(conteo)y where y->>'categoria_id'=x->>'categoria_id');
 end if;
 return jsonb_build_object(
 'profesor',profesor,'config',config,
 'categorias',coalesce((select jsonb_agg(to_jsonb(c) order by orden) from public.grammy_categorias c where profesor or habilitada),'[]'::jsonb),
 'candidatos',coalesce((select jsonb_agg(to_jsonb(e) order by nombre) from (select id,nombre,grado from public.estudiantes where activo and grado in(6,7,8)) e),'[]'::jsonb),
 'mis_votos',coalesce((select jsonb_object_agg(categoria_id::text,candidato_id::text) from public.grammy_votos where autor=auth.uid()),'{}'::jsonb),
 'conteo',case when profesor then conteo else null end,
 'ganadores',ganadores,
 'votantes',case when profesor then (select count(distinct autor) from public.grammy_votos v where exists(select 1 from public.estudiantes e where e.auth_user_id=v.autor and e.activo and e.grado in(6,7,8))) else null end
 );
end;
$$;
revoke all on function public.grammy_contexto() from public;
grant execute on function public.grammy_contexto() to authenticated;

create or replace function public.grammy_guardar_votos(elecciones jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare disponible boolean; item record;
begin
 if auth.uid() is null or not public.grammy_puede_participar() then raise exception 'Solo pueden votar estudiantes activos de 6°, 7° y 8°.';end if;
 select abierto into disponible from public.grammy_config where id=1 for share;
 if disponible is distinct from true then raise exception 'La votación está cerrada.';end if;
 if jsonb_typeof(elecciones) is distinct from 'object' then raise exception 'Formato de votos inválido.';end if;
 for item in select * from jsonb_each_text(elecciones) loop
  if item.value is not null and item.value<>'' then
   if not exists(select 1 from public.grammy_categorias where id=item.key::integer and habilitada) then raise exception 'La categoría no está habilitada.';end if;
   if not exists(select 1 from public.estudiantes where id=item.value::uuid and activo and grado in(6,7,8)) then raise exception 'Selecciona un estudiante activo de 6°, 7° u 8°.';end if;
  end if;
 end loop;
 delete from public.grammy_votos where autor=auth.uid();
 insert into public.grammy_votos(autor,categoria_id,candidato_id)
 select auth.uid(),key::integer,value::uuid from jsonb_each_text(elecciones) where value is not null and value<>'';
end;
$$;
revoke all on function public.grammy_guardar_votos(jsonb) from public;
grant execute on function public.grammy_guardar_votos(jsonb) to authenticated;

create or replace function public.grammy_administrar(accion text)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not public.es_profesor() then raise exception 'Solo un profesor puede administrar la votación.';end if;
 perform 1 from public.grammy_config where id=1 for update;
 if accion='abrir' then update public.grammy_config set abierto=true,resultados_publicados=false where id=1;
 elsif accion='cerrar' then update public.grammy_config set abierto=false where id=1;
 elsif accion='publicar' then
  if exists(select 1 from public.grammy_config where id=1 and abierto) then raise exception 'Cierra la votación antes de publicar.';end if;
  update public.grammy_config set resultados_publicados=true where id=1;
 elsif accion='ocultar' then update public.grammy_config set resultados_publicados=false where id=1;
 else raise exception 'Acción no válida.';
 end if;
end;
$$;
revoke all on function public.grammy_administrar(text) from public;
grant execute on function public.grammy_administrar(text) to authenticated;

create or replace function public.grammy_editar_categoria(categoria integer,nuevo_titulo text,nueva_descripcion text,activa boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not public.es_profesor() then raise exception 'Solo un profesor puede editar las categorías.';end if;
 perform 1 from public.grammy_config where id=1 for update;
 if exists(select 1 from public.grammy_config where id=1 and (abierto or resultados_publicados)) then raise exception 'Cierra la votación y oculta los resultados antes de editar las categorías.';end if;
 update public.grammy_categorias set titulo=trim(nuevo_titulo),descripcion=trim(nueva_descripcion),habilitada=activa where id=categoria;
 if not found then raise exception 'Categoría no encontrada.';end if;
end;
$$;
revoke all on function public.grammy_editar_categoria(integer,text,text,boolean) from public;
grant execute on function public.grammy_editar_categoria(integer,text,text,boolean) to authenticated;
commit;
