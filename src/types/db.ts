/**
 * Tipos de la base de datos.
 *
 * ⚠️ ESCRITOS A MANO, Y ESO TIENE UN COSTO. Lo correcto es generarlos con
 * `npx supabase gen types typescript --project-id <id> > src/types/db.ts` en
 * cuanto exista un proyecto de Supabase vivo. Mientras tanto van a mano porque
 * sin ellos toda consulta es `any` y se pierde la red del compilador justo en
 * la capa que toca los datos.
 *
 * El riesgo es la deriva: si una migración agrega una columna y este archivo no
 * se actualiza, el tipo miente — y un tipo que miente es peor que no tenerlo,
 * porque el compilador avala el error. Regla mientras dure lo hecho a mano:
 * **toda migración que cambie una tabla actualiza este archivo en el mismo
 * commit.**
 *
 * Espejo de `supabase/migrations/0001`–`0009`.
 *
 * ⚠️ TODO AQUÍ SE DECLARA CON `type`, NUNCA CON `interface`. No es estilo: en
 * TypeScript una `interface` no recibe índice implícito, así que no es
 * asignable a `Record<string, unknown>` — que es justo lo que exige el
 * `GenericSchema` de supabase-js. Con interfaces, el esquema entero deja de
 * conformar en silencio, el cliente cae al genérico y cada `.rpc()` y cada
 * join se tipan como `undefined` o `never`. Por eso los tipos que genera
 * Supabase usan `type`.
 */

/**
 * `Insert` = obligatorios los que no tienen default en la base; el resto,
 * opcionales. `Update` = todo opcional. Evita repetir tres veces cada tabla.
 */
type Tabla<Fila, Requeridos extends keyof Fila> = {
  Row: Fila
  Insert: Pick<Fila, Requeridos> & Partial<Omit<Fila, Requeridos>>
  Update: Partial<Fila>
  Relationships: []
}

// ── Enumeraciones (espejo de los `create type` de las migraciones) ──────────

export type RolMembresia =
  | 'titular'
  | 'abogado'
  | 'pasante'
  | 'asistente'
  | 'cliente'
export type EstadoMembresia = 'invitada' | 'activa' | 'suspendida'
export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'revocada'
export type PlanSuscripcion = 'gratuito' | 'profesional' | 'despacho'
export type FueroDb = 'federal' | 'comun'
export type MotivoInhabilDb = 'feriado' | 'vacaciones' | 'suspension'
export type TipoPersonaDb = 'fisica' | 'moral'
export type RelacionPersona =
  | 'cliente_activo'
  | 'cliente_anterior'
  | 'contraparte'
  | 'tercero'
export type EstadoExpediente =
  | 'prospecto'
  | 'activo'
  | 'suspendido'
  | 'concluido'
  | 'archivado'
export type ResultadoExpediente =
  | 'favorable'
  | 'parcialmente_favorable'
  | 'desfavorable'
  | 'convenio'
  | 'desistimiento'
  | 'caducidad'
  | 'sobreseimiento'
  | 'otro'
export type TipoActuacion =
  | 'promocion'
  | 'acuerdo'
  | 'notificacion'
  | 'resolucion'
  | 'audiencia'
  | 'diligencia'
  | 'comunicacion'
  | 'nota_interna'
export type TipoDocumento =
  | 'escrito_inicial'
  | 'promocion'
  | 'anexo'
  | 'acuse'
  | 'acuerdo'
  | 'resolucion'
  | 'poder'
  | 'identificacion'
  | 'prueba'
  | 'contrato'
  | 'otro'
export type EstadoAudiencia =
  | 'programada'
  | 'celebrada'
  | 'diferida'
  | 'cancelada'
export type EstadoPlazo = 'pendiente' | 'atendido' | 'vencido' | 'cancelado'
export type NivelAlertaDb =
  | 't_menos_5'
  | 't_menos_3'
  | 't_menos_1'
  | 'vence_hoy'
  | 'vencido'

// ── Filas ───────────────────────────────────────────────────────────────────

export type DespachoRow = {
  id: string
  nombre: string
  slug: string
  rfc: string | null
  entidad: string | null
  telefono: string | null
  correo_contacto: string | null
  plan: PlanSuscripcion
  asientos_incluidos: number
  expedientes_tope: number | null
  creado_el: string
  actualizado_el: string
}

export type PerfilRow = {
  id: string
  nombre: string
  correo: string | null
  telefono: string | null
  cedula: string | null
  creado_el: string
  actualizado_el: string
}

export type MembresiaRow = {
  id: string
  despacho_id: string
  perfil_id: string
  rol: RolMembresia
  estado: EstadoMembresia
  persona_id: string | null
  invitada_por: string | null
  creado_el: string
}

export type InvitacionRow = {
  id: string
  despacho_id: string
  correo: string
  rol: RolMembresia
  /** sha-256 en hexadecimal. NUNCA el token en claro. */
  token_hash: string
  estado: EstadoInvitacion
  expira_el: string
  invitada_por: string | null
  aceptada_el: string | null
  aceptada_por: string | null
  creado_el: string
}

export type CalendarioRow = {
  id: string
  despacho_id: string | null
  /** Llave estable de los calendarios semilla compartidos (migración 0008). */
  clave: string | null
  nombre: string
  vigencia_desde: string
  vigencia_hasta: string
  fin_de_semana_inhabil: boolean
  notas: string | null
  creado_el: string
}

export type DiaInhabilRow = {
  id: string
  calendario_id: string
  desde: string
  hasta: string
  motivo: MotivoInhabilDb
  descripcion: string
  fundamento: string | null
}

export type OrganoRow = {
  id: string
  despacho_id: string | null
  nombre: string
  fuero: FueroDb
  entidad: string | null
  distrito: string | null
  materia: string | null
  calendario_id: string | null
  domicilio: string | null
  cierre_oficialia: string | null
  notas: string | null
  creado_el: string
}

export type PlazoCatalogoRow = {
  id: string
  despacho_id: string | null
  clave: string | null
  regimen: string
  etiqueta: string
  dias: number
  unidad: string
  fundamento: string
  nota: string | null
  verificado_por: string | null
  verificado_el: string | null
  verificacion_notas: string | null
  creado_el: string
  actualizado_el: string
}

export type RegimenVerificadoRow = {
  id: string
  despacho_id: string
  regimen: string
  verificado_por: string
  verificado_el: string
  notas: string | null
}

export type PersonaRow = {
  id: string
  despacho_id: string
  tipo: TipoPersonaDb
  nombre: string
  nombre_cotejo: string
  rfc: string | null
  curp: string | null
  relacion: RelacionPersona
  correo: string | null
  telefono: string | null
  domicilio: string | null
  representante: string | null
  notas: string | null
  creado_el: string
  actualizado_el: string
}

export type ExpedienteRow = {
  id: string
  despacho_id: string
  numero_interno: string
  numero_organo: string | null
  caratula: string
  cliente_persona_id: string | null
  materia: string
  via: string
  fuero: FueroDb
  entidad: string | null
  organo_id: string | null
  instancia: string | null
  etapa_actual: string | null
  estado: EstadoExpediente
  resultado: ResultadoExpediente | null
  cuantia: number | null
  moneda: string
  responsable_id: string | null
  restringido: boolean
  fecha_inicio: string | null
  fecha_conclusion: string | null
  notas: string | null
  creado_por: string | null
  creado_el: string
  actualizado_el: string
}

export type ExpedienteAccesoRow = {
  expediente_id: string
  perfil_id: string
  otorgado_por: string | null
  otorgado_el: string
}

export type ExpedienteParteRow = {
  id: string
  expediente_id: string
  persona_id: string
  rol: string
  es_nuestra_parte: boolean
  abogado_contrario: string | null
  notas: string | null
  creado_el: string
}

export type ExpedienteEtapaRow = {
  id: string
  expediente_id: string
  clave: string
  nombre: string
  descripcion: string | null
  orden: number
  paralela: boolean
  completada_el: string | null
  completada_por: string | null
}

export type ActuacionRow = {
  id: string
  expediente_id: string
  tipo: TipoActuacion
  fecha: string
  titulo: string
  detalle: string | null
  visible_cliente: boolean
  etapa_clave: string | null
  creado_por: string | null
  creado_el: string
}

export type DocumentoRow = {
  id: string
  expediente_id: string
  tipo: TipoDocumento
  nombre: string
  ruta_storage: string
  tamano_bytes: number | null
  mime: string | null
  version: number
  acuse_de_id: string | null
  visible_cliente: boolean
  notas: string | null
  subido_por: string | null
  creado_el: string
}

export type AudienciaRow = {
  id: string
  expediente_id: string
  tipo: string
  fecha: string
  hora: string | null
  lugar: string | null
  responsable_id: string | null
  estado: EstadoAudiencia
  resultado: string | null
  notas: string | null
  visible_cliente: boolean
  creado_por: string | null
  creado_el: string
  actualizado_el: string
}

export type PlazoRow = {
  id: string
  expediente_id: string
  etiqueta: string
  plazo_catalogo_id: string | null
  regimen: string
  dias: number
  unidad: string
  dias_distancia: number
  actuacion_id: string | null
  tipo_notificacion: string
  fecha_notificacion: string
  calendario_id: string | null
  fecha_surte_efectos: string
  primer_dia: string
  fecha_vencimiento: string
  fecha_vencimiento_ajustada: string | null
  motivo_ajuste: string | null
  ajustado_por: string | null
  ajustado_el: string | null
  /** Columna GENERADA. Nunca se inserta ni se actualiza a mano. */
  fecha_vencimiento_efectiva: string
  computo: unknown
  confiabilidad: string
  estado: EstadoPlazo
  responsable_id: string | null
  atendido_el: string | null
  atendido_por: string | null
  actuacion_cumplimiento_id: string | null
  notas: string | null
  creado_por: string | null
  creado_el: string
  actualizado_el: string
}

export type PlazoAlertaEnviadaRow = {
  id: string
  plazo_id: string
  nivel: NivelAlertaDb
  enviado_el: string
  destinatarios: string[] | null
}

// ── Esquema ─────────────────────────────────────────────────────────────────

/**
 * `fecha_vencimiento_efectiva` se excluye del Insert y del Update: es una
 * columna generada y Postgres rechaza cualquier escritura sobre ella. Que el
 * tipo lo impida ahorra descubrirlo en tiempo de ejecución.
 */
type PlazoEscribible = Omit<PlazoRow, 'fecha_vencimiento_efectiva'>

export type Database = {
  public: {
    Tables: {
      despachos: Tabla<DespachoRow, 'nombre' | 'slug'>
      perfiles: Tabla<PerfilRow, 'id'>
      membresias: Tabla<MembresiaRow, 'despacho_id' | 'perfil_id'>
      invitaciones: Tabla<
        InvitacionRow,
        'despacho_id' | 'correo' | 'token_hash' | 'expira_el'
      >
      calendarios: Tabla<
        CalendarioRow,
        'nombre' | 'vigencia_desde' | 'vigencia_hasta'
      >
      dias_inhabiles: Tabla<
        DiaInhabilRow,
        'calendario_id' | 'desde' | 'hasta' | 'motivo' | 'descripcion'
      >
      organos: Tabla<OrganoRow, 'nombre' | 'fuero'>
      plazos_catalogo: Tabla<
        PlazoCatalogoRow,
        'regimen' | 'etiqueta' | 'dias' | 'fundamento'
      >
      regimenes_verificados: Tabla<
        RegimenVerificadoRow,
        'despacho_id' | 'regimen' | 'verificado_por'
      >
      personas: Tabla<PersonaRow, 'despacho_id' | 'nombre'>
      expedientes: Tabla<
        ExpedienteRow,
        | 'despacho_id'
        | 'numero_interno'
        | 'caratula'
        | 'materia'
        | 'via'
        | 'fuero'
      >
      expediente_accesos: Tabla<ExpedienteAccesoRow, 'expediente_id' | 'perfil_id'>
      expediente_partes: Tabla<
        ExpedienteParteRow,
        'expediente_id' | 'persona_id' | 'rol'
      >
      expediente_etapas: Tabla<
        ExpedienteEtapaRow,
        'expediente_id' | 'clave' | 'nombre' | 'orden'
      >
      actuaciones: Tabla<
        ActuacionRow,
        'expediente_id' | 'tipo' | 'fecha' | 'titulo'
      >
      documentos: Tabla<DocumentoRow, 'expediente_id' | 'nombre' | 'ruta_storage'>
      audiencias: Tabla<AudienciaRow, 'expediente_id' | 'tipo' | 'fecha'>
      // Se escribe a mano en vez de usar `Tabla` porque `Row` y lo escribible
      // difieren: la fila incluye la columna generada y la escritura no.
      plazos: {
        Row: PlazoRow
        Insert: Pick<
          PlazoEscribible,
          | 'expediente_id'
          | 'etiqueta'
          | 'regimen'
          | 'dias'
          | 'tipo_notificacion'
          | 'fecha_notificacion'
          | 'fecha_surte_efectos'
          | 'primer_dia'
          | 'fecha_vencimiento'
        > &
          Partial<PlazoEscribible>
        Update: Partial<PlazoEscribible>
        Relationships: []
      }
      plazo_alertas_enviadas: Tabla<PlazoAlertaEnviadaRow, 'plazo_id' | 'nivel'>
    }
    Views: Record<never, never>
    Functions: {
      despachos_del_usuario: { Args: Record<never, never>; Returns: string[] }
      es_miembro: { Args: { p_despacho: string }; Returns: boolean }
      es_personal: { Args: { p_despacho: string }; Returns: boolean }
      tiene_rol: {
        Args: { p_despacho: string; p_roles: RolMembresia[] }
        Returns: boolean
      }
      persona_del_usuario: { Args: { p_despacho: string }; Returns: string }
      puede_ver_expediente: { Args: { p_expediente: string }; Returns: boolean }
      puede_editar_expediente: {
        Args: { p_expediente: string }
        Returns: boolean
      }
      abrir_expediente: {
        Args: {
          p_despacho_id: string
          p_caratula: string
          p_materia: string
          p_via: string
          p_fuero: FueroDb
          /** [{persona_id, rol, es_nuestra_parte, abogado_contrario, notas}] */
          p_partes: unknown
          /** [{clave, nombre, descripcion, orden, paralela}] */
          p_etapas: unknown
          p_etapa_actual?: string | null
          p_cliente_persona_id?: string | null
          p_entidad?: string | null
          p_organo_id?: string | null
          p_numero_organo?: string | null
          p_instancia?: string | null
          p_cuantia?: number | null
          p_responsable_id?: string | null
          p_restringido?: boolean
          p_fecha_inicio?: string | null
          p_notas?: string | null
        }
        /** El id del expediente recién abierto. */
        Returns: string
      }
      aceptar_invitacion: {
        Args: { p_token_hash: string; p_nombre: string }
        /** El id del despacho al que se acaba de entrar. */
        Returns: string
      }
      mirar_invitacion: {
        Args: { p_token_hash: string }
        Returns: {
          despacho_nombre: string
          correo: string
          rol: RolMembresia
          vigente: boolean
        }[]
      }
      crear_mi_despacho: {
        Args: {
          p_nombre_titular: string
          p_correo: string
          p_despacho_nombre: string
          p_slug_base: string
        }
        /** El id del despacho recién creado. */
        Returns: string
      }
    }
    Enums: {
      rol_membresia: RolMembresia
      estado_membresia: EstadoMembresia
      estado_invitacion: EstadoInvitacion
      plan_suscripcion: PlanSuscripcion
      fuero: FueroDb
      motivo_inhabil: MotivoInhabilDb
      tipo_persona: TipoPersonaDb
      relacion_persona: RelacionPersona
      estado_expediente: EstadoExpediente
      resultado_expediente: ResultadoExpediente
      tipo_actuacion: TipoActuacion
      tipo_documento: TipoDocumento
      estado_audiencia: EstadoAudiencia
      estado_plazo: EstadoPlazo
      nivel_alerta: NivelAlertaDb
    }
    CompositeTypes: Record<never, never>
  }
}
