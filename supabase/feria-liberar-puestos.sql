-- Ejecutar después de feria-puestos-automaticos.sql.
-- Cancela reservas sin aprobación, conserva proyectos y reservas como historial.
begin;
select pg_advisory_xact_lock(20261106);
create or replace function public.feria_sincronizar_reservas()
returns trigger language plpgsql security definer set search_path='' as $$
declare identificador uuid;nombre text;vigente boolean:=false;
begin
 if TG_OP='DELETE' then identificador:=old.id;
 else
  identificador:=new.id;vigente:=new.estado='aprobado';
  if TG_ARGV[0]='claudina' then nombre:=to_jsonb(new)->>'titulo';else nombre:=to_jsonb(new)->'datos'->>'titulo';end if;
 end if;
 if not vigente then
  update public.feria_programacion set activo=false,version=version+1,actualizado_en=now() where activo and tipo='proyecto' and origen=TG_ARGV[0] and proyecto_id=identificador;
 else
  update public.feria_programacion set titulo=nombre,version=version+1,actualizado_en=now() where activo and tipo='proyecto' and origen=TG_ARGV[0] and proyecto_id=identificador and titulo is distinct from nombre;
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function public.feria_sincronizar_reservas() from public,anon,authenticated;
drop trigger if exists feria_00_sincronizar_reservas on public.feria_proyectos;
create trigger feria_00_sincronizar_reservas after update or delete on public.feria_proyectos for each row execute function public.feria_sincronizar_reservas('claudina');
drop trigger if exists feria_00_sincronizar_reservas on public.feria_proyectos_externos;
create trigger feria_00_sincronizar_reservas after update or delete on public.feria_proyectos_externos for each row execute function public.feria_sincronizar_reservas('invitados');
-- Reparar reservas anteriores por ID y origen; nunca por título.
update public.feria_programacion r set activo=false,version=r.version+1,actualizado_en=now()
where r.activo and r.tipo='proyecto' and not(
 (r.origen='claudina' and exists(select 1 from public.feria_proyectos p where p.id=r.proyecto_id and p.estado='aprobado')) or
 (r.origen='invitados' and exists(select 1 from public.feria_proyectos_externos p where p.id=r.proyecto_id and p.estado='aprobado')));
-- Actualizar títulos copiados sin mezclar proyectos homónimos.
update public.feria_programacion r set titulo=p.titulo,version=r.version+1,actualizado_en=now()
from public.feria_proyectos p where r.activo and r.tipo='proyecto' and r.origen='claudina' and r.proyecto_id=p.id and r.titulo is distinct from p.titulo;
update public.feria_programacion r set titulo=p.datos->>'titulo',version=r.version+1,actualizado_en=now()
from public.feria_proyectos_externos p where r.activo and r.tipo='proyecto' and r.origen='invitados' and r.proyecto_id=p.id and r.titulo is distinct from (p.datos->>'titulo');
create or replace function public.feria_numerar_puesto()
returns trigger language plpgsql security definer set search_path='' as $$
declare numero integer:=1;
begin
 perform pg_advisory_xact_lock(20261106);
 if not new.activo or new.tipo<>'proyecto' then return new;end if;
 if TG_OP='UPDATE' then
  if new.puesto is distinct from old.puesto then new.puesto_automatico:=false;
  elsif old.puesto_automatico and (new.espacio_id,new.fecha,new.inicio,new.fin) is distinct from (old.espacio_id,old.fecha,old.inicio,old.fin) then new.puesto:='';end if;
 end if;
 if btrim(coalesce(new.puesto,''))<>'' then return new;end if;
 while exists(select 1 from public.feria_programacion r where r.activo and r.id<>new.id and r.espacio_id=new.espacio_id and r.fecha=new.fecha and r.inicio<new.fin and r.fin>new.inicio and lower(btrim(r.puesto))=lower('Puesto '||numero)) loop numero:=numero+1;end loop;
 new.puesto:='Puesto '||numero;new.puesto_automatico:=true;return new;
end;$$;
-- Convertir solo etiquetas numéricas simples. Mesa 1A / Mesa 1B se conservan.
do $$declare r record;etiqueta text;automatico boolean;begin
 for r in select * from public.feria_programacion where activo and tipo='proyecto' and btrim(puesto)~*'^Mesa[[:space:]]+[0-9]+$' order by fecha,inicio,espacio_id,id loop
  etiqueta:=regexp_replace(btrim(r.puesto),'^Mesa[[:space:]]+','Puesto ','i');automatico:=r.puesto_automatico;
  if exists(select 1 from public.feria_programacion p where p.activo and p.id<>r.id and p.espacio_id=r.espacio_id and p.fecha=r.fecha and p.inicio<r.fin and p.fin>r.inicio and lower(btrim(p.puesto))=lower(etiqueta)) then etiqueta:='';automatico:=true;end if;
  update public.feria_programacion set puesto=etiqueta,version=version+1,actualizado_en=now() where id=r.id;
  update public.feria_programacion set puesto_automatico=automatico where id=r.id;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
