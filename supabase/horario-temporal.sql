-- Ejecutar una vez en el SQL Editor de Supabase.
create table if not exists public.horario_base (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (grupo in ('6','7-8')),
  dia smallint not null check (dia between 1 and 5),
  bloque smallint not null check (bloque between 1 and 6),
  materia text not null default '',
  profesor text not null default '',
  updated_at timestamptz not null default now(),
  unique(grupo,dia,bloque)
);
create table if not exists public.horario_cambios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  grupo text not null check (grupo in ('6','7-8')),
  bloque smallint not null check (bloque between 1 and 6),
  materia text not null default '',
  profesor text not null default '',
  aviso text not null default '',
  cancelada boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(fecha,grupo,bloque)
);
alter table public.horario_base enable row level security;
alter table public.horario_cambios enable row level security;
drop policy if exists "horario base lectura" on public.horario_base;
create policy "horario base lectura" on public.horario_base for select to authenticated using (true);
drop policy if exists "horario base docentes" on public.horario_base;
create policy "horario base docentes" on public.horario_base for all to authenticated using (public.es_profesor()) with check (public.es_profesor());
drop policy if exists "horario cambios lectura" on public.horario_cambios;
create policy "horario cambios lectura" on public.horario_cambios for select to authenticated using (true);
drop policy if exists "horario cambios docentes" on public.horario_cambios;
create policy "horario cambios docentes" on public.horario_cambios for all to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- Horario temporal de la imagen recibida: 6.º y el grupo conjunto 7.º–8.º.
-- Los bloques 5 y 6 se dejan vacíos porque no tienen clases en la imagen.
insert into public.horario_base(grupo,dia,bloque,materia,profesor)
select g.grupo,g.dia,g.bloque,g.materia,
  case when g.materia in ('Matemáticas','Inglés','Tecnología, informática y emprendimiento') then 'Gustavo'
       when g.materia='' then '' else 'Johana' end
from (values
('6',1,1,'Matemáticas'),('6',1,2,'Matemáticas'),('6',1,3,'Educación Ética'),('6',1,4,'Educación Religiosa'),
('6',2,1,'Español'),('6',2,2,'Español'),('6',2,3,'Inglés'),('6',2,4,'Inglés'),
('6',3,1,'Tecnología, informática y emprendimiento'),('6',3,2,'Tecnología, informática y emprendimiento'),('6',3,3,'Ciencias Naturales'),('6',3,4,'Ciencias Naturales'),
('6',4,1,'Ciencias Sociales'),('6',4,2,'Ciencias Sociales'),('6',4,3,'Matemáticas'),('6',4,4,'Tecnología, informática y emprendimiento'),
('6',5,1,'Matemáticas'),('6',5,2,'Matemáticas'),('6',5,3,'Ciencias Naturales'),('6',5,4,'Ciencias Naturales'),
('7-8',1,1,'Educación Ética'),('7-8',1,2,'Educación Religiosa'),('7-8',1,3,'Matemáticas'),('7-8',1,4,'Matemáticas'),
('7-8',2,1,'Tecnología, informática y emprendimiento'),('7-8',2,2,'Tecnología, informática y emprendimiento'),('7-8',2,3,'Ciencias Sociales'),('7-8',2,4,'Ciencias Sociales'),
('7-8',3,1,'Ciencias Naturales'),('7-8',3,2,'Ciencias Naturales'),('7-8',3,3,'Inglés'),('7-8',3,4,'Inglés'),
('7-8',4,1,'Matemáticas'),('7-8',4,2,'Matemáticas'),('7-8',4,3,'Ciencias Sociales'),('7-8',4,4,'Ciencias Sociales'),
('7-8',5,1,'Ciencias Naturales'),('7-8',5,2,'Ciencias Naturales'),('7-8',5,3,'Tecnología, informática y emprendimiento'),('7-8',5,4,'Matemáticas')
) as g(grupo,dia,bloque,materia)
on conflict(grupo,dia,bloque) do nothing;
