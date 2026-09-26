-- Ejecutar antes de publicar la función de evacuación.
create table if not exists public.alertas_evacuacion (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('real','simulacro')),
  activada_por uuid not null references auth.users(id),
  activada_at timestamptz not null default now(),
  finalizada_por uuid references auth.users(id),
  finalizada_at timestamptz
);

create unique index if not exists solo_una_alerta_activa
on public.alertas_evacuacion ((true)) where finalizada_at is null;

alter table public.alertas_evacuacion enable row level security;
create policy "usuarios autorizados ven alertas" on public.alertas_evacuacion
for select to authenticated using (
  exists (select 1 from public.perfiles p where p.id=auth.uid())
);

-- La activación pasa por la función de servidor, que valida al profesor y envía push.
-- La finalización se limita a profesores.
create or replace function public.finalizar_alerta_evacuacion(alerta_id uuid)
returns boolean language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  if not public.es_profesor() then raise exception 'Solo un profesor puede finalizar una alerta'; end if;
  update public.alertas_evacuacion
  set finalizada_at=now(),finalizada_por=auth.uid()
  where id=alerta_id and finalizada_at is null;
  return found;
end;
$$;

revoke all on function public.finalizar_alerta_evacuacion(uuid) from public;
grant execute on function public.finalizar_alerta_evacuacion(uuid) to authenticated;

-- Cada dispositivo se vincula a su cuenta; la clave privada VAPID nunca se guarda aquí.
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now(),
  constraint endpoint_https check (endpoint like 'https://%')
);
create index if not exists suscripciones_push_usuario on public.suscripciones_push(usuario_id);
alter table public.suscripciones_push enable row level security;
create policy "usuario consulta sus dispositivos" on public.suscripciones_push
for select to authenticated using (usuario_id=auth.uid());
create policy "usuario registra su dispositivo" on public.suscripciones_push
for insert to authenticated with check (usuario_id=auth.uid());
create policy "usuario actualiza su dispositivo" on public.suscripciones_push
for update to authenticated using (usuario_id=auth.uid()) with check (usuario_id=auth.uid());
create policy "usuario elimina su dispositivo" on public.suscripciones_push
for delete to authenticated using (usuario_id=auth.uid());
