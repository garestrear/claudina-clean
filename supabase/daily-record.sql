-- Claudina Clean: ajustes para registro diario y evidencias
-- Ejecutar una sola vez en Supabase > SQL Editor

alter table public.tareas
  drop constraint if exists tareas_tipo_check;

alter table public.tareas
  add constraint tareas_tipo_check
  check (tipo in ('barrer','trapear','basura','puestos','tablero','tv','aporte_especial'));

-- Permitir que una tarea se asigne a una participación y registrar si fue realizada.
alter table public.tareas
  add column if not exists realizada boolean not null default true;

-- Índice para localizar rápidamente el registro de un grupo y fecha.
create index if not exists idx_registros_aseo_fecha_grupo
  on public.registros_aseo(fecha, grupo);

-- Evita crear dos registros diarios para el mismo grupo.
create unique index if not exists uq_registros_aseo_fecha_grupo
  on public.registros_aseo(fecha, grupo);
