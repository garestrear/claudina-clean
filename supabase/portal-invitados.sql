-- Ejecutar una vez en Supabase > SQL Editor.
begin;
alter table public.avisos add column if not exists visible_invitados boolean not null default false;
create table if not exists public.convivencia_publicaciones(
 id uuid primary key default gen_random_uuid(),
 fecha date not null check(fecha<=timezone('America/Bogota',now())::date),
 titulo text not null check(length(trim(titulo)) between 1 and 120),
 situacion text not null check(length(trim(situacion)) between 1 and 2000),
 solucion text not null default '' check(length(solucion)<=2000),
 acuerdos text not null default '' check(length(acuerdos)<=2000),
 aprendizaje text not null default '' check(length(aprendizaje)<=2000),
 confirmado boolean not null default true,
 publicado boolean not null default false,
 creado_por uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 check(not publicado or (length(trim(solucion))>0 and length(trim(acuerdos))>0 and length(trim(aprendizaje))>0))
);
alter table public.convivencia_publicaciones add column if not exists fecha_hora timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='convivencia_fecha_hora_valida' and conrelid='public.convivencia_publicaciones'::regclass) then
  alter table public.convivencia_publicaciones add constraint convivencia_fecha_hora_valida check(fecha_hora is null or (fecha_hora<=now() and timezone('America/Bogota',fecha_hora)::date=fecha));
 end if;
end $$;
create table if not exists public.convivencia_seguimiento(
 id smallint primary key default 1 check(id=1),
 inicio date,
 verificado_hasta date,
 check(inicio is null or inicio<=timezone('America/Bogota',now())::date),
 check(verificado_hasta is null or verificado_hasta<=timezone('America/Bogota',now())::date),
 check(inicio is null or verificado_hasta is null or verificado_hasta>=inicio)
);
insert into public.convivencia_seguimiento(id) values(1) on conflict do nothing;
alter table public.convivencia_publicaciones enable row level security;
alter table public.convivencia_seguimiento enable row level security;
revoke all on public.convivencia_publicaciones,public.convivencia_seguimiento from anon;
grant select,insert,update,delete on public.convivencia_publicaciones to authenticated;
grant select,update on public.convivencia_seguimiento to authenticated;
drop policy if exists "profesor administra convivencia" on public.convivencia_publicaciones;
create policy "profesor administra convivencia" on public.convivencia_publicaciones for all to authenticated using(public.es_profesor()) with check(public.es_profesor());
drop policy if exists "profesor administra seguimiento" on public.convivencia_seguimiento;
create policy "profesor administra seguimiento" on public.convivencia_seguimiento for all to authenticated using(public.es_profesor()) with check(public.es_profesor());
-- Solo esta función expone información pública, nunca tablas de estudiantes.
create or replace function public.portal_invitados()
returns jsonb language sql stable security definer set search_path=public
as $$
 select jsonb_build_object(
 'avisos',coalesce((select jsonb_agg(to_jsonb(a)) from (select titulo,contenido,tipo,fecha_evento from public.avisos where publicado and visible_invitados order by created_at desc limit 30)a),'[]'::jsonb),
 'casos',coalesce((select jsonb_agg(to_jsonb(c)) from (select fecha,titulo,situacion,solucion,acuerdos,aprendizaje from public.convivencia_publicaciones where publicado order by fecha desc,created_at desc limit 30)c),'[]'::jsonb),
 'seguimiento',(select jsonb_build_object('inicio',s.inicio,'verificado_hasta',s.verificado_hasta,'ultimo_incidente',(select max(fecha) from public.convivencia_publicaciones where confirmado),'ultimo_incidente_hora',(select fecha_hora from public.convivencia_publicaciones where confirmado order by coalesce(fecha_hora,fecha::timestamp at time zone 'America/Bogota') desc,created_at desc limit 1)) from public.convivencia_seguimiento s where id=1)
 );
$$;
revoke all on function public.portal_invitados() from public;
grant execute on function public.portal_invitados() to anon,authenticated;
commit;
