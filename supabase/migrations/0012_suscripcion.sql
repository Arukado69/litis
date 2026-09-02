-- =============================================================================
-- Litis — Migración 0012: Suscripción, topes del plan gratuito
-- =============================================================================
-- Se cobra **por asiento al mes**, con un nivel gratuito que tiene tope de
-- asientos y de expedientes activos. Esta migración pone en la base las tres
-- piezas que la aplicación por sí sola no puede garantizar:
--
--   1. El **blindaje de las columnas de cobro**: el titular puede actualizar su
--      despacho (política `despachos_actualizar` de la `0001`), y esa política
--      no distingue columnas. Sin lo de aquí, un `PATCH /rest/v1/despachos` con
--      `{"plan":"despacho","expedientes_tope":null}` desde la consola del
--      navegador se regala el producto entero. La cerradura del cobro no puede
--      vivir donde vive el cliente.
--
--   2. Los **topes, como restricción de la base**. Comprobarlos solo en la
--      Server Action deja la puerta de PostgREST abierta: `expedientes_crear`
--      permite insertar a todo el personal. El tope se aplica donde se escribe.
--
--   3. El **registro de eventos de Stripe**, para no procesar dos veces el
--      mismo webhook. Stripe reintenta y a veces manda el mismo evento más de
--      una vez; sin registro, un `subscription.updated` repetido no hace daño,
--      pero uno fuera de orden sí puede dejar el plan en un estado viejo.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE EL TOPE **NUNCA** BLOQUEA
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo dos operaciones se topan: **abrir un expediente** y **sumar un asiento**.
-- Nada más. Cerrar un plazo, asentar una actuación, subir un documento, computar
-- un vencimiento, recibir las alertas por correo y leer todo lo ya capturado
-- funcionan igual con la suscripción vencida, morosa o cancelada.
--
-- No es generosidad: un cobro que impide registrar que se presentó en tiempo
-- convierte un problema de facturación en un término perdido, y el término
-- perdido lo responde el abogado ante su cliente y ante su barra. Es el único
-- error que este producto no se puede permitir.
--
-- Por lo mismo, **al cancelar no se suspende a nadie ni se esconde nada**: el
-- despacho que se pasa del tope conserva sus expedientes y su equipo, y lo que
-- deja de poder es crecer. Sale más caro cobrar de menos un mes que dejar a un
-- pasante fuera de un expediente que vence mañana.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ESTADO DE LA SUSCRIPCIÓN
-- ---------------------------------------------------------------------------
-- Cómo se traduce lo que manda Stripe:
--   trialing, active                        → 'activa'
--   past_due, unpaid, incomplete            → 'morosa'   (NO se cierra nada)
--   canceled, incomplete_expired            → 'cancelada' (vuelve a gratuito)
--   sin suscripción                         → 'gratuita'
do $$ begin
  create type public.estado_suscripcion as enum (
    'gratuita',   -- nunca ha pagado, o ya volvió al nivel gratuito
    'activa',     -- al corriente
    'morosa',     -- el cobro falló; sigue funcionando todo
    'cancelada'   -- terminó la suscripción; conserva lo suyo con topes
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) COLUMNAS DE COBRO EN `despachos`
-- ---------------------------------------------------------------------------
alter table public.despachos
  add column if not exists estado_suscripcion public.estado_suscripcion
    not null default 'gratuita',
  -- Los identificadores de Stripe. Únicos: dos despachos apuntando al mismo
  -- cliente de Stripe sería un cobro que abona en el lugar equivocado.
  add column if not exists stripe_cliente_id     text unique,
  add column if not exists stripe_suscripcion_id text unique,
  -- Hasta cuándo está pagado el periodo en curso. Sirve para decir en pantalla
  -- "tu suscripción llega hasta el 3 de octubre", no para cortar el acceso.
  add column if not exists periodo_fin           timestamptz,
  -- El titular pidió cancelar y sigue vigente hasta el fin del periodo.
  add column if not exists cancela_al_fin        boolean not null default false;

-- El tope del nivel gratuito. La `0001` dejó la columna en NULL (= sin tope),
-- que era lo correcto mientras no existiera cobro.
--
-- ⚠️ Estos dos números son ESPEJO de `TOPES_POR_PLAN.gratuito` en
-- `src/lib/suscripcion/limites.ts`, que es donde se deciden y de donde los
-- escribe el webhook. Aquí están únicamente como valor de arranque del
-- despacho recién creado (`crear_mi_despacho` inserta solo nombre y slug). Si
-- cambian allá, cambian aquí.
alter table public.despachos
  alter column expedientes_tope set default 10;

update public.despachos
   set expedientes_tope = 10
 where plan = 'gratuito'
   and expedientes_tope is null;

comment on column public.despachos.asientos_incluidos is
  'Asientos de personal pagados. En el nivel gratuito, 1. En el de paga, la cantidad de la suscripción de Stripe. Los clientes del portal NO ocupan asiento.';
comment on column public.despachos.expedientes_tope is
  'Tope de expedientes activos (todo lo que no está concluido ni archivado). NULL = sin tope.';


-- ---------------------------------------------------------------------------
-- 3) ¿QUIÉN ESTÁ ESCRIBIENDO?
-- ---------------------------------------------------------------------------
-- `invoker` a propósito: tiene que leer el estado de ESTA sesión. Con
-- `security definer` devolvería siempre al dueño de la función y el blindaje
-- de abajo no protegería de nada.
create or replace function public.es_servicio()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    current_user
  ) in ('service_role', 'postgres', 'supabase_admin');
$$;

comment on function public.es_servicio is
  'Cierto si quien escribe es la clave de servicio o un administrador de la base, no una sesión de usuario.';


-- ---------------------------------------------------------------------------
-- 4) BLINDAJE DE LAS COLUMNAS DE COBRO
-- ---------------------------------------------------------------------------
create or replace function public.blindar_cobro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.es_servicio() then
    return new;
  end if;

  if new.plan                  is distinct from old.plan
  or new.estado_suscripcion    is distinct from old.estado_suscripcion
  or new.asientos_incluidos    is distinct from old.asientos_incluidos
  or new.expedientes_tope      is distinct from old.expedientes_tope
  or new.stripe_cliente_id     is distinct from old.stripe_cliente_id
  or new.stripe_suscripcion_id is distinct from old.stripe_suscripcion_id
  or new.periodo_fin           is distinct from old.periodo_fin
  or new.cancela_al_fin        is distinct from old.cancela_al_fin
  then
    raise exception
      'El plan y los topes los mueve el cobro, no la sesión. Cambia la suscripción desde /panel/suscripcion.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists despachos_blindar_cobro on public.despachos;
create trigger despachos_blindar_cobro
  before update on public.despachos
  for each row execute function public.blindar_cobro();


-- ---------------------------------------------------------------------------
-- 5) LOS CONTADORES
-- ---------------------------------------------------------------------------
-- Van en dos capas, y no es ceremonia:
--
--   · `contar_*` — cuenta TODO el despacho, sin preguntar quién llama. Es
--     `security definer` porque con la RLS del usuario un expediente
--     restringido en el que no participa no se contaría, y el tope se saltaría
--     solo por no poder ver lo que se está contando. Está revocada para todo el
--     mundo: solo la llaman los disparadores de aquí abajo.
--
--   · `expedientes_activos` / `asientos_ocupados` — la puerta para la
--     aplicación, con su guardia. Una función definer con un parámetro libre y
--     sin guardia contesta preguntas sobre despachos ajenos.
--
-- La guardia es `es_personal`, no `es_miembro`: el cliente del portal también
-- es miembro, y cuántos asuntos lleva el despacho no es asunto suyo.
--
-- Y no puede ir en la de adentro: el alta de despacho (`crear_mi_despacho`)
-- inserta la membresía del titular ANTES de que la membresía exista, así que en
-- ese instante ni el propio dueño pasaría la guardia.

create or replace function public.contar_expedientes_activos(p_despacho uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int
    from public.expedientes e
   where e.despacho_id = p_despacho
     -- Concluido y archivado no ocupan lugar: cerrar un asunto libera un
     -- espacio, que es justo el incentivo correcto.
     and e.estado not in ('concluido', 'archivado');
$$;

create or replace function public.contar_asientos_ocupados(p_despacho uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int
    from public.membresias m
   where m.despacho_id = p_despacho
     and m.estado = 'activa'
     -- El cliente del portal NO ocupa asiento. Cobrar por él empujaría al
     -- despacho a no darle acceso, y el portal existe justamente para que el
     -- cliente deje de llamar a preguntar en qué va.
     and m.rol <> 'cliente';
$$;

revoke all on function public.contar_expedientes_activos(uuid) from public, anon, authenticated;
revoke all on function public.contar_asientos_ocupados(uuid)   from public, anon, authenticated;


create or replace function public.expedientes_activos(p_despacho uuid)
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.es_servicio() and not public.es_personal(p_despacho) then
    raise exception 'No es tu despacho' using errcode = '42501';
  end if;
  return public.contar_expedientes_activos(p_despacho);
end;
$$;

create or replace function public.asientos_ocupados(p_despacho uuid)
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.es_servicio() and not public.es_personal(p_despacho) then
    raise exception 'No es tu despacho' using errcode = '42501';
  end if;
  return public.contar_asientos_ocupados(p_despacho);
end;
$$;

revoke all on function public.expedientes_activos(uuid) from public, anon;
revoke all on function public.asientos_ocupados(uuid)   from public, anon;
grant execute on function public.expedientes_activos(uuid) to authenticated;
grant execute on function public.asientos_ocupados(uuid)   to authenticated;


-- ---------------------------------------------------------------------------
-- 6) LOS TOPES, APLICADOS DONDE SE ESCRIBE
-- ---------------------------------------------------------------------------
-- Códigos propios para que la aplicación distinga el rechazo por tope de
-- cualquier otro error y conteste con la salida en vez de un "algo falló":
--   LIT01 → no caben más expedientes activos
--   LIT02 → no caben más asientos
--
-- Los dos disparadores son `security definer`: necesitan contar el despacho
-- entero y leer sus topes, que es más de lo que ve quien está escribiendo. Solo
-- leen y, a lo sumo, levantan la excepción; no escriben nada.
create or replace function public.exigir_cupo_expediente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tope int;
  v_usados int;
begin
  -- Solo cuenta lo que ocupa lugar. Concluir o archivar nunca topa.
  if new.estado in ('concluido', 'archivado') then
    return new;
  end if;

  -- En un UPDATE solo importa el paso de "no ocupa" a "ocupa": revivir un
  -- expediente archivado es, para el tope, lo mismo que abrir uno.
  if tg_op = 'UPDATE' and old.estado not in ('concluido', 'archivado') then
    return new;
  end if;

  select d.expedientes_tope into v_tope
    from public.despachos d
   where d.id = new.despacho_id;

  if v_tope is null then
    return new;
  end if;

  v_usados := public.contar_expedientes_activos(new.despacho_id);

  if v_usados >= v_tope then
    raise exception
      'El plan llega a % expedientes activos y ya hay %. Concluye o archiva uno, o pasa al plan de paga en /panel/suscripcion.',
      v_tope, v_usados
      using errcode = 'LIT01';
  end if;

  return new;
end;
$$;

drop trigger if exists expedientes_exigir_cupo on public.expedientes;
create trigger expedientes_exigir_cupo
  before insert or update of estado on public.expedientes
  for each row execute function public.exigir_cupo_expediente();


create or replace function public.exigir_cupo_asiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asientos int;
  v_usados int;
begin
  if new.rol = 'cliente' or new.estado <> 'activa' then
    return new;
  end if;

  -- Un UPDATE sobre alguien que ya estaba ocupando asiento (cambiarle el papel)
  -- no vuelve a pedir asiento.
  if tg_op = 'UPDATE' and old.estado = 'activa' and old.rol <> 'cliente' then
    return new;
  end if;

  select d.asientos_incluidos into v_asientos
    from public.despachos d
   where d.id = new.despacho_id;

  if v_asientos is null then
    return new;
  end if;

  v_usados := public.contar_asientos_ocupados(new.despacho_id);

  if v_usados >= v_asientos then
    raise exception
      'El despacho tiene % asiento(s) y ya están ocupados. Suma asientos en /panel/suscripcion o da de baja a alguien.',
      v_asientos
      using errcode = 'LIT02';
  end if;

  return new;
end;
$$;

drop trigger if exists membresias_exigir_cupo on public.membresias;
create trigger membresias_exigir_cupo
  before insert or update on public.membresias
  for each row execute function public.exigir_cupo_asiento();


-- ---------------------------------------------------------------------------
-- 7) EVENTOS DE STRIPE — IDEMPOTENCIA
-- ---------------------------------------------------------------------------
create table if not exists public.suscripcion_eventos (
  id          uuid primary key default gen_random_uuid(),
  -- El id del evento de Stripe (`evt_...`). Único: es toda la idempotencia.
  evento_id   text not null unique,
  tipo        text not null,
  despacho_id uuid references public.despachos(id) on delete set null,
  -- Se guarda el objeto para poder reconstruir qué se decidió y por qué el día
  -- que un cobro no cuadre. Nunca lleva datos de tarjeta: Stripe no los manda.
  carga       jsonb,
  recibido_el timestamptz not null default now()
);

create index if not exists suscripcion_eventos_despacho_idx
  on public.suscripcion_eventos (despacho_id, recibido_el desc);

-- RLS encendida y SIN políticas: nadie con sesión lee ni escribe aquí. Solo la
-- clave de servicio, desde el webhook. Un despacho no tiene por qué leer el
-- tráfico de facturación de nadie, ni siquiera el suyo.
alter table public.suscripcion_eventos enable row level security;

comment on table public.suscripcion_eventos is
  'Bitácora de webhooks de Stripe. `evento_id` único = no se procesa dos veces. Sin políticas: solo la clave de servicio.';

-- =============================================================================
-- FIN — 0012
-- =============================================================================
