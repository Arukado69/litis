-- =============================================================================
-- Litis — Migración 0005: Plazos procesales y sus alertas
-- =============================================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ SE GUARDA LA TRAZA DEL CÓMPUTO Y NO SOLO LA FECHA
-- ─────────────────────────────────────────────────────────────────────────────
-- `computo` guarda el razonamiento completo con el que se llegó a la fecha:
-- cuándo surtió efectos la notificación, cuál fue el primer día, qué días se
-- saltaron y por qué, y con qué fundamento. Tres razones:
--
--   1. Auditoría. Seis meses después, nadie recuerda por qué el sistema dijo
--      que vencía el 12. Con la traza se revisa en treinta segundos.
--   2. Reproducibilidad. Si mañana se corrige el calendario del órgano, los
--      plazos ya computados no cambian solos: quedó registrado con qué datos
--      se calcularon. Recalcular es una decisión explícita, no un efecto
--      secundario de editar un catálogo.
--   3. Defensa. Si un cliente reclama, la constancia de cómo se computó y
--      quién lo confirmó es la diferencia entre un desacuerdo y una
--      negligencia indefendible.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL ABOGADO MANDA SOBRE EL MOTOR
-- ─────────────────────────────────────────────────────────────────────────────
-- `fecha_vencimiento_ajustada` permite sobrescribir a mano el resultado. Tiene
-- que existir: el motor no conoce el acuerdo que habilitó días y horas, ni la
-- suspensión que decretó el juez ayer. Un sistema que no deja corregir obliga
-- a llevar el plazo bueno en un papel aparte, y entonces el sistema sobra.
--
-- Pero ajustar EXIGE motivo (lo fuerza un check) y deja quién y cuándo. La
-- fecha que manda es la generada `fecha_vencimiento_efectiva`, para que
-- ninguna consulta se equivoque de columna.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ENUMERACIONES
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.estado_plazo as enum (
    'pendiente',  -- corriendo
    'atendido',   -- se presentó la promoción
    'vencido',    -- pasó sin atenderse
    'cancelado'   -- dejó de aplicar (se desistió, se acumuló, quedó sin materia)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nivel_alerta as enum (
    't_menos_5', 't_menos_3', 't_menos_1', 'vence_hoy', 'vencido'
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) PLAZOS
-- ---------------------------------------------------------------------------

create table if not exists public.plazos (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid not null references public.expedientes(id) on delete cascade,

  etiqueta          text not null,
  -- De qué entrada del catálogo salió, si salió de una.
  plazo_catalogo_id uuid references public.plazos_catalogo(id) on delete set null,

  -- Parámetros con los que se computó. Se guardan aunque estén en el catálogo:
  -- si mañana alguien corrige el catálogo, este plazo debe seguir explicando
  -- con qué números se calculó.
  regimen           text not null,
  dias              int not null,
  unidad            text not null default 'habiles',
  dias_distancia    int not null default 0,

  -- La notificación que lo disparó.
  actuacion_id      uuid references public.actuaciones(id) on delete set null,
  tipo_notificacion text not null,
  fecha_notificacion date not null,

  -- Con qué calendario se corrió. Sin esto la traza no se puede reproducir.
  calendario_id     uuid references public.calendarios(id) on delete set null,

  -- Resultado del motor.
  fecha_surte_efectos date not null,
  primer_dia          date not null,
  fecha_vencimiento   date not null,

  -- Corrección manual. Ver el encabezado.
  fecha_vencimiento_ajustada date,
  motivo_ajuste              text,
  ajustado_por               uuid references public.perfiles(id) on delete set null,
  ajustado_el                timestamptz,

  -- La que manda. Toda consulta, alerta y agenda usa ESTA.
  fecha_vencimiento_efectiva date generated always as (
    coalesce(fecha_vencimiento_ajustada, fecha_vencimiento)
  ) stored,

  -- La traza completa del motor: pasos, días contados, omitidos, fundamentos
  -- y advertencias.
  computo           jsonb not null default '{}'::jsonb,
  -- 'semilla_no_verificada' | 'verificado_por_despacho'
  confiabilidad     text not null default 'semilla_no_verificada',

  estado            public.estado_plazo not null default 'pendiente',
  responsable_id    uuid references public.perfiles(id) on delete set null,

  -- Cómo se cumplió.
  atendido_el       timestamptz,
  atendido_por      uuid references public.perfiles(id) on delete set null,
  actuacion_cumplimiento_id uuid references public.actuaciones(id) on delete set null,

  notas             text,
  creado_por        uuid references public.perfiles(id) on delete set null,
  creado_el         timestamptz not null default now(),
  actualizado_el    timestamptz not null default now(),

  constraint plazos_dias_validos check (dias >= 1),
  constraint plazos_distancia_valida check (dias_distancia >= 0),
  constraint plazos_unidad_valida check (unidad in ('habiles', 'naturales')),
  -- Ajustar sin decir por qué deja un dato que nadie puede auditar después.
  constraint plazos_ajuste_justificado check (
    fecha_vencimiento_ajustada is null
    or (
      motivo_ajuste is not null
      and length(btrim(motivo_ajuste)) > 0
      and ajustado_por is not null
      and ajustado_el is not null
    )
  ),
  -- El orden temporal no es negociable.
  constraint plazos_orden_temporal check (
    fecha_surte_efectos >= fecha_notificacion
    and primer_dia > fecha_surte_efectos
    and fecha_vencimiento >= primer_dia
  )
);

-- La consulta que corre el cron todos los días y la que pinta el panel:
-- "qué está por vencer y sigue pendiente".
create index if not exists plazos_vigilancia_idx
  on public.plazos (estado, fecha_vencimiento_efectiva)
  where estado = 'pendiente';

create index if not exists plazos_exp_idx
  on public.plazos (expediente_id, fecha_vencimiento_efectiva);

create index if not exists plazos_responsable_idx
  on public.plazos (responsable_id, fecha_vencimiento_efectiva)
  where estado = 'pendiente';

drop trigger if exists plazos_tocar on public.plazos;
create trigger plazos_tocar before update on public.plazos
  for each row execute function public.tocar_actualizado_el();


-- ---------------------------------------------------------------------------
-- 3) REGISTRO DE ALERTAS ENVIADAS
--    La idempotencia real. El motor recibe lo ya enviado y no repite; el
--    índice único es la red por si dos corridas del cron se traslapan.
-- ---------------------------------------------------------------------------

create table if not exists public.plazo_alertas_enviadas (
  id         uuid primary key default gen_random_uuid(),
  plazo_id   uuid not null references public.plazos(id) on delete cascade,
  nivel      public.nivel_alerta not null,
  enviado_el timestamptz not null default now(),
  -- A quién se le mandó, para poder reconstruir por qué alguien dice que no
  -- le avisaron.
  destinatarios text[],
  unique (plazo_id, nivel)
);


-- ---------------------------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.plazos                 enable row level security;
alter table public.plazo_alertas_enviadas enable row level security;

-- Los plazos son información de trabajo interno. El cliente ve el avance del
-- asunto y sus audiencias, no la lista de términos que su abogado tiene
-- encima: es información que no puede interpretar y que solo produce llamadas
-- de angustia.
drop policy if exists plazos_personal on public.plazos;
create policy plazos_personal on public.plazos
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

drop policy if exists plazo_alertas_leer on public.plazo_alertas_enviadas;
create policy plazo_alertas_leer on public.plazo_alertas_enviadas
  for select using (
    exists (
      select 1 from public.plazos p
      where p.id = plazo_id and public.puede_editar_expediente(p.expediente_id)
    )
  );

-- El registro de envíos lo escribe el cron con service role, no el usuario.

-- =============================================================================
-- FIN — 0005
-- =============================================================================
