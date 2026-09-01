-- =============================================================================
-- Litis — Migración 0010: El almacén de documentos
-- =============================================================================
-- La tabla `documentos` existe desde la 0004, pero los archivos no tenían dónde
-- vivir. Esto crea el bucket y sus políticas.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL BUCKET ES PRIVADO. NO HAY DISCUSIÓN.
-- ─────────────────────────────────────────────────────────────────────────────
-- Aquí adentro va la demanda de un cliente, su identificación oficial, sus
-- contratos y las pruebas del asunto. Un bucket público significa que cualquiera
-- con la URL —o que la adivine, o que la encuentre en el historial de un
-- navegador compartido— lee el expediente completo de un tercero.
--
-- Se descarga con **URL firmada de vida corta**, generada en el servidor para
-- quien ya pasó la RLS. No hay una sola ruta pública.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA RUTA LLEVA EL DESPACHO ADELANTE, Y NO ES DECORATIVO
-- ─────────────────────────────────────────────────────────────────────────────
--   {despacho_id}/{expediente_id}/{uuid}-{nombre}
--
-- Las políticas de abajo leen el SEGUNDO segmento y preguntan a
-- `puede_ver_expediente()`. Poner el despacho al frente hace que, aunque una
-- política futura se escriba mal, el aislamiento entre despachos siga siendo
-- visible en la ruta y auditable de un vistazo.
--
-- ⚠️ El nombre del archivo NUNCA se usa para decidir permisos: lo controla quien
-- sube. Lo que decide es el id del expediente, y ese lo pone el servidor.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) EL BUCKET
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do update set public = false;


-- ---------------------------------------------------------------------------
-- 2) DE UNA RUTA, EL EXPEDIENTE
-- ---------------------------------------------------------------------------
-- Convertir el segundo segmento a uuid con un cast directo revienta si la ruta
-- viene malformada, y un error de Postgres a media política es un 500 sin
-- explicación. Esta función devuelve `null` en ese caso, y `null` no pasa
-- ninguna política: falla cerrado y sin ruido.
-- ---------------------------------------------------------------------------

create or replace function public.expediente_de_ruta(p_ruta text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_partes text[] := string_to_array(coalesce(p_ruta, ''), '/');
begin
  if array_length(v_partes, 1) is null or array_length(v_partes, 1) < 2 then
    return null;
  end if;
  if v_partes[2] !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return v_partes[2]::uuid;
exception when others then
  return null;
end;
$$;

comment on function public.expediente_de_ruta(text) is
  'El id de expediente que lleva una ruta del bucket, o null si la ruta no sirve.';


-- ---------------------------------------------------------------------------
-- 3) POLÍTICAS DEL ALMACÉN
-- ---------------------------------------------------------------------------
-- Se apoyan en las MISMAS funciones que la tabla `documentos`. Una regla, una
-- implementación: si mañana cambia quién puede ver un expediente restringido,
-- cambia en un solo lugar y los archivos lo siguen.
-- ---------------------------------------------------------------------------

drop policy if exists documentos_almacen_leer on storage.objects;
create policy documentos_almacen_leer on storage.objects
  for select using (
    bucket_id = 'documentos'
    and public.puede_ver_expediente(public.expediente_de_ruta(name))
  );

drop policy if exists documentos_almacen_escribir on storage.objects;
create policy documentos_almacen_escribir on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and public.puede_editar_expediente(public.expediente_de_ruta(name))
  );

-- Borrar sí se permite al personal del despacho: un archivo subido por error
-- —el PDF equivocado, el escaneo al revés— tiene que poderse quitar. Lo que NO
-- se borra es la ACTUACIÓN de la bitácora que lo menciona, y por eso el
-- registro de que existió sobrevive aunque el archivo se vaya.
drop policy if exists documentos_almacen_borrar on storage.objects;
create policy documentos_almacen_borrar on storage.objects
  for delete using (
    bucket_id = 'documentos'
    and public.puede_editar_expediente(public.expediente_de_ruta(name))
  );

-- Sin política de UPDATE: un documento no se sobrescribe. Se sube otra versión.
-- Sobrescribir en el lugar borraría el escrito que sí se presentó, y en un
-- juicio el borrador y lo presentado son dos documentos distintos que importan
-- por separado.

-- =============================================================================
-- FIN — 0010
-- =============================================================================
