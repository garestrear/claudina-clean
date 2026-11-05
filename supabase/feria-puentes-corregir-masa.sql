-- Ejecutar después de feria-puentes-importar.sql y las migraciones anteriores.
-- Amplía la función instalada sin restablecer duración, intentos ni otras mejoras.
begin;
do $migration$
declare definicion text; marcador text := ' elsif accion=''medir'' then';
bloque text := $accion$
 elsif accion='masa' then
  select * into p from public.feria_puentes where id=(datos->>'puente_id')::uuid for update;
  if p.id is null then raise exception 'Puente no disponible';end if;
  if p.estado='en_prueba' or exists(select 1 from public.feria_puentes_rondas where puente_id=p.id and resultado='pendiente') then raise exception 'Termina el intento en curso antes de corregir la masa';end if;
  if datos-array['puente_id','masa_g']<>'{}'::jsonb then raise exception 'Solo se permite corregir la masa';end if;
  if nullif(datos->>'masa_g','') is not null and not ((datos->>'masa_g')::numeric>0 and (datos->>'masa_g')::numeric<=9999999.999) then raise exception 'La masa debe ser mayor que cero y no superar 9999999.999 gramos';end if;
  update public.feria_puentes set masa_g=nullif(datos->>'masa_g','')::numeric,version=version+1,actualizado_en=now() where id=p.id;
$accion$;
begin
 select pg_get_functiondef('public.feria_puentes_accion(text,jsonb,integer,uuid)'::regprocedure) into definicion;
 if position('elsif accion=''masa'' then' in definicion)>0 then return;end if;
 if position(marcador in definicion)=0 then raise exception 'Instala primero las migraciones del concurso de puentes';end if;
 execute replace(definicion,marcador,bloque||marcador);
end $migration$;
commit;
