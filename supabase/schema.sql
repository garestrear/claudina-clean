-- Claudina Clean · esquema inicial
create extension if not exists pgcrypto;
create type public.rol_usuario as enum ('profesor','estudiante');
create type public.estado_cumplimiento as enum ('cumplio','no_cumplio','ausente');

create table public.perfiles(id uuid primary key references auth.users(id) on delete cascade,nombre text not null,rol public.rol_usuario not null default 'estudiante',created_at timestamptz default now());
create table public.estudiantes(id uuid primary key default gen_random_uuid(),nombre text not null,grado smallint not null check(grado in(6,7,8)),activo boolean not null default true,auth_user_id uuid references auth.users(id),created_at timestamptz default now());
create table public.asignaciones(id uuid primary key default gen_random_uuid(),estudiante_id uuid not null references public.estudiantes(id),dia smallint not null check(dia between 1 and 5),unique(estudiante_id,dia));
create table public.registros_aseo(id uuid primary key default gen_random_uuid(),fecha date not null default current_date,grupo text not null check(grupo in('6','7-8')),observaciones text,creado_por uuid references auth.users(id),created_at timestamptz default now());
create table public.participaciones(id uuid primary key default gen_random_uuid(),registro_id uuid not null references public.registros_aseo(id) on delete cascade,estudiante_id uuid not null references public.estudiantes(id),estado public.estado_cumplimiento,calificacion smallint check(calificacion between 1 and 10),unique(registro_id,estudiante_id));
create table public.tareas(id uuid primary key default gen_random_uuid(),participacion_id uuid not null references public.participaciones(id) on delete cascade,tipo text not null check(tipo in('barrer','trapear','basura','puestos','tablero','tv','aporte_especial')),detalle text);
create table public.evidencias(id uuid primary key default gen_random_uuid(),registro_id uuid references public.registros_aseo(id) on delete cascade,reporte_id uuid,path text not null,subido_por uuid references auth.users(id),created_at timestamptz default now());
create table public.valoraciones(id uuid primary key default gen_random_uuid(),registro_id uuid not null references public.registros_aseo(id) on delete cascade,autor uuid not null references auth.users(id),valor smallint not null check(valor between 1 and 5),comentario text,created_at timestamptz default now(),unique(registro_id,autor));
create table public.reportes(id uuid primary key default gen_random_uuid(),registro_id uuid references public.registros_aseo(id),autor uuid not null references auth.users(id),tipo text not null,descripcion text,estado text not null default 'pendiente' check(estado in('pendiente','revisado','descartado')),created_at timestamptz default now());
alter table public.evidencias add constraint evidencias_reporte_fk foreign key(reporte_id) references public.reportes(id) on delete cascade;

-- RLS se configurará junto con autenticación antes de usar datos reales.
