/**
 * Tipos de la base de datos.
 *
 * ⚠️ GENERADO. No se edita a mano. Para regenerarlo:
 *
 *   npx supabase gen types typescript --project-id wtugxkmkaxaueuwweqhx > src/types/db.ts
 *
 * y se vuelve a pegar la capa de alias del final. Sale del esquema VIVO, así
 * que describe lo que está aplicado en Supabase, no lo que dicen los archivos
 * de `supabase/migrations/`. Si los dos difieren, el que manda para el
 * compilador es este — y esa diferencia es un bloqueo que hay que resolver, no
 * un detalle.
 *
 * Antes iba a mano y la regla era actualizarlo en el mismo commit que la
 * migración. Aguantó para las tablas y los enums —los veinte y los dieciséis
 * coincidían— pero se le habían quedado fuera cuatro funciones:
 * `es_servicio`, `contar_expedientes_activos`, `contar_asientos_ocupados` y
 * `expediente_de_ruta`. Un `.rpc()` a cualquiera de esas cuatro no compilaba, o
 * peor, se tipaba como `never` sin que nada lo dijera.
 *
 * ⚠️ TODO AQUÍ SE DECLARA CON `type`, NUNCA CON `interface`. No es estilo: en
 * TypeScript una `interface` no recibe índice implícito, así que no es
 * asignable a `Record<string, unknown>` — que es justo lo que exige el
 * `GenericSchema` de supabase-js. Con interfaces, el esquema entero deja de
 * conformar en silencio, el cliente cae al genérico y cada `.rpc()` y cada
 * join se tipan como `undefined` o `never`. El generador de Supabase usa
 * `type` por eso mismo; si algún día emitiera `interface`, hay que corregirlo.
 *
 * ⚠️ Ahora `Relationships` trae las llaves foráneas de verdad, no `[]`. Los
 * joins anidados de PostgREST ya se pueden tipar. Donde el código los evita a
 * propósito —el padrón de conflictos (§5.2) y la corrida de alertas (§5.12)—
 * la razón era que las relaciones estaban escritas a mano; esa razón se acabó,
 * pero cambiar esas consultas es otra rebanada y no se hace de pasada.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actuaciones: {
        Row: {
          creado_el: string
          creado_por: string | null
          detalle: string | null
          etapa_clave: string | null
          expediente_id: string
          fecha: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_actuacion"]
          titulo: string
          visible_cliente: boolean
        }
        Insert: {
          creado_el?: string
          creado_por?: string | null
          detalle?: string | null
          etapa_clave?: string | null
          expediente_id: string
          fecha: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_actuacion"]
          titulo: string
          visible_cliente?: boolean
        }
        Update: {
          creado_el?: string
          creado_por?: string | null
          detalle?: string | null
          etapa_clave?: string | null
          expediente_id?: string
          fecha?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_actuacion"]
          titulo?: string
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "actuaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actuaciones_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias: {
        Row: {
          actualizado_el: string
          creado_el: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["estado_audiencia"]
          expediente_id: string
          fecha: string
          hora: string | null
          id: string
          lugar: string | null
          notas: string | null
          responsable_id: string | null
          resultado: string | null
          tipo: string
          visible_cliente: boolean
        }
        Insert: {
          actualizado_el?: string
          creado_el?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_audiencia"]
          expediente_id: string
          fecha: string
          hora?: string | null
          id?: string
          lugar?: string | null
          notas?: string | null
          responsable_id?: string | null
          resultado?: string | null
          tipo: string
          visible_cliente?: boolean
        }
        Update: {
          actualizado_el?: string
          creado_el?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_audiencia"]
          expediente_id?: string
          fecha?: string
          hora?: string | null
          id?: string
          lugar?: string | null
          notas?: string | null
          responsable_id?: string | null
          resultado?: string | null
          tipo?: string
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendarios: {
        Row: {
          creado_el: string
          despacho_id: string | null
          fin_de_semana_inhabil: boolean
          id: string
          nombre: string
          notas: string | null
          vigencia_desde: string
          vigencia_hasta: string
        }
        Insert: {
          creado_el?: string
          despacho_id?: string | null
          fin_de_semana_inhabil?: boolean
          id?: string
          nombre: string
          notas?: string | null
          vigencia_desde: string
          vigencia_hasta: string
        }
        Update: {
          creado_el?: string
          despacho_id?: string | null
          fin_de_semana_inhabil?: boolean
          id?: string
          nombre?: string
          notas?: string | null
          vigencia_desde?: string
          vigencia_hasta?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendarios_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
        ]
      }
      despachos: {
        Row: {
          actualizado_el: string
          asientos_incluidos: number
          cancela_al_fin: boolean
          correo_contacto: string | null
          creado_el: string
          entidad: string | null
          estado_suscripcion: Database["public"]["Enums"]["estado_suscripcion"]
          expedientes_tope: number | null
          id: string
          nombre: string
          periodo_fin: string | null
          plan: Database["public"]["Enums"]["plan_suscripcion"]
          rfc: string | null
          slug: string
          stripe_cliente_id: string | null
          stripe_suscripcion_id: string | null
          telefono: string | null
        }
        Insert: {
          actualizado_el?: string
          asientos_incluidos?: number
          cancela_al_fin?: boolean
          correo_contacto?: string | null
          creado_el?: string
          entidad?: string | null
          estado_suscripcion?: Database["public"]["Enums"]["estado_suscripcion"]
          expedientes_tope?: number | null
          id?: string
          nombre: string
          periodo_fin?: string | null
          plan?: Database["public"]["Enums"]["plan_suscripcion"]
          rfc?: string | null
          slug: string
          stripe_cliente_id?: string | null
          stripe_suscripcion_id?: string | null
          telefono?: string | null
        }
        Update: {
          actualizado_el?: string
          asientos_incluidos?: number
          cancela_al_fin?: boolean
          correo_contacto?: string | null
          creado_el?: string
          entidad?: string | null
          estado_suscripcion?: Database["public"]["Enums"]["estado_suscripcion"]
          expedientes_tope?: number | null
          id?: string
          nombre?: string
          periodo_fin?: string | null
          plan?: Database["public"]["Enums"]["plan_suscripcion"]
          rfc?: string | null
          slug?: string
          stripe_cliente_id?: string | null
          stripe_suscripcion_id?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      dias_inhabiles: {
        Row: {
          calendario_id: string
          descripcion: string
          desde: string
          fundamento: string | null
          hasta: string
          id: string
          motivo: Database["public"]["Enums"]["motivo_inhabil"]
        }
        Insert: {
          calendario_id: string
          descripcion: string
          desde: string
          fundamento?: string | null
          hasta: string
          id?: string
          motivo: Database["public"]["Enums"]["motivo_inhabil"]
        }
        Update: {
          calendario_id?: string
          descripcion?: string
          desde?: string
          fundamento?: string | null
          hasta?: string
          id?: string
          motivo?: Database["public"]["Enums"]["motivo_inhabil"]
        }
        Relationships: [
          {
            foreignKeyName: "dias_inhabiles_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          acuse_de_id: string | null
          creado_el: string
          expediente_id: string
          id: string
          mime: string | null
          nombre: string
          notas: string | null
          ruta_storage: string
          subido_por: string | null
          tamano_bytes: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          version: number
          visible_cliente: boolean
        }
        Insert: {
          acuse_de_id?: string | null
          creado_el?: string
          expediente_id: string
          id?: string
          mime?: string | null
          nombre: string
          notas?: string | null
          ruta_storage: string
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          version?: number
          visible_cliente?: boolean
        }
        Update: {
          acuse_de_id?: string | null
          creado_el?: string
          expediente_id?: string
          id?: string
          mime?: string | null
          nombre?: string
          notas?: string | null
          ruta_storage?: string
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          version?: number
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_acuse_de_id_fkey"
            columns: ["acuse_de_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_accesos: {
        Row: {
          expediente_id: string
          otorgado_el: string
          otorgado_por: string | null
          perfil_id: string
        }
        Insert: {
          expediente_id: string
          otorgado_el?: string
          otorgado_por?: string | null
          perfil_id: string
        }
        Update: {
          expediente_id?: string
          otorgado_el?: string
          otorgado_por?: string | null
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expediente_accesos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_accesos_otorgado_por_fkey"
            columns: ["otorgado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_accesos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_etapas: {
        Row: {
          clave: string
          completada_el: string | null
          completada_por: string | null
          descripcion: string | null
          expediente_id: string
          id: string
          nombre: string
          orden: number
          paralela: boolean
        }
        Insert: {
          clave: string
          completada_el?: string | null
          completada_por?: string | null
          descripcion?: string | null
          expediente_id: string
          id?: string
          nombre: string
          orden: number
          paralela?: boolean
        }
        Update: {
          clave?: string
          completada_el?: string | null
          completada_por?: string | null
          descripcion?: string | null
          expediente_id?: string
          id?: string
          nombre?: string
          orden?: number
          paralela?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "expediente_etapas_completada_por_fkey"
            columns: ["completada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_etapas_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_partes: {
        Row: {
          abogado_contrario: string | null
          creado_el: string
          es_nuestra_parte: boolean
          expediente_id: string
          id: string
          notas: string | null
          persona_id: string
          rol: string
        }
        Insert: {
          abogado_contrario?: string | null
          creado_el?: string
          es_nuestra_parte?: boolean
          expediente_id: string
          id?: string
          notas?: string | null
          persona_id: string
          rol: string
        }
        Update: {
          abogado_contrario?: string | null
          creado_el?: string
          es_nuestra_parte?: boolean
          expediente_id?: string
          id?: string
          notas?: string | null
          persona_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "expediente_partes_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_partes_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      expedientes: {
        Row: {
          actualizado_el: string
          caratula: string
          cliente_persona_id: string | null
          creado_el: string
          creado_por: string | null
          cuantia: number | null
          despacho_id: string
          entidad: string | null
          estado: Database["public"]["Enums"]["estado_expediente"]
          etapa_actual: string | null
          fecha_conclusion: string | null
          fecha_inicio: string | null
          fuero: Database["public"]["Enums"]["fuero"]
          id: string
          instancia: string | null
          materia: string
          moneda: string
          notas: string | null
          numero_interno: string
          numero_organo: string | null
          organo_id: string | null
          responsable_id: string | null
          restringido: boolean
          resultado: Database["public"]["Enums"]["resultado_expediente"] | null
          via: string
        }
        Insert: {
          actualizado_el?: string
          caratula: string
          cliente_persona_id?: string | null
          creado_el?: string
          creado_por?: string | null
          cuantia?: number | null
          despacho_id: string
          entidad?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente"]
          etapa_actual?: string | null
          fecha_conclusion?: string | null
          fecha_inicio?: string | null
          fuero: Database["public"]["Enums"]["fuero"]
          id?: string
          instancia?: string | null
          materia: string
          moneda?: string
          notas?: string | null
          numero_interno: string
          numero_organo?: string | null
          organo_id?: string | null
          responsable_id?: string | null
          restringido?: boolean
          resultado?: Database["public"]["Enums"]["resultado_expediente"] | null
          via: string
        }
        Update: {
          actualizado_el?: string
          caratula?: string
          cliente_persona_id?: string | null
          creado_el?: string
          creado_por?: string | null
          cuantia?: number | null
          despacho_id?: string
          entidad?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente"]
          etapa_actual?: string | null
          fecha_conclusion?: string | null
          fecha_inicio?: string | null
          fuero?: Database["public"]["Enums"]["fuero"]
          id?: string
          instancia?: string | null
          materia?: string
          moneda?: string
          notas?: string | null
          numero_interno?: string
          numero_organo?: string | null
          organo_id?: string | null
          responsable_id?: string | null
          restringido?: boolean
          resultado?: Database["public"]["Enums"]["resultado_expediente"] | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_cliente_persona_id_fkey"
            columns: ["cliente_persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_organo_id_fkey"
            columns: ["organo_id"]
            isOneToOne: false
            referencedRelation: "organos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          aceptada_el: string | null
          aceptada_por: string | null
          correo: string
          creado_el: string
          despacho_id: string
          estado: Database["public"]["Enums"]["estado_invitacion"]
          expira_el: string
          id: string
          invitada_por: string | null
          persona_id: string | null
          rol: Database["public"]["Enums"]["rol_membresia"]
          token_hash: string
        }
        Insert: {
          aceptada_el?: string | null
          aceptada_por?: string | null
          correo: string
          creado_el?: string
          despacho_id: string
          estado?: Database["public"]["Enums"]["estado_invitacion"]
          expira_el: string
          id?: string
          invitada_por?: string | null
          persona_id?: string | null
          rol?: Database["public"]["Enums"]["rol_membresia"]
          token_hash: string
        }
        Update: {
          aceptada_el?: string | null
          aceptada_por?: string | null
          correo?: string
          creado_el?: string
          despacho_id?: string
          estado?: Database["public"]["Enums"]["estado_invitacion"]
          expira_el?: string
          id?: string
          invitada_por?: string | null
          persona_id?: string | null
          rol?: Database["public"]["Enums"]["rol_membresia"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_aceptada_por_fkey"
            columns: ["aceptada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_invitada_por_fkey"
            columns: ["invitada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      membresias: {
        Row: {
          creado_el: string
          despacho_id: string
          estado: Database["public"]["Enums"]["estado_membresia"]
          id: string
          invitada_por: string | null
          perfil_id: string
          persona_id: string | null
          rol: Database["public"]["Enums"]["rol_membresia"]
        }
        Insert: {
          creado_el?: string
          despacho_id: string
          estado?: Database["public"]["Enums"]["estado_membresia"]
          id?: string
          invitada_por?: string | null
          perfil_id: string
          persona_id?: string | null
          rol?: Database["public"]["Enums"]["rol_membresia"]
        }
        Update: {
          creado_el?: string
          despacho_id?: string
          estado?: Database["public"]["Enums"]["estado_membresia"]
          id?: string
          invitada_por?: string | null
          perfil_id?: string
          persona_id?: string | null
          rol?: Database["public"]["Enums"]["rol_membresia"]
        }
        Relationships: [
          {
            foreignKeyName: "membresias_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_invitada_por_fkey"
            columns: ["invitada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_persona_fk"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      organos: {
        Row: {
          calendario_id: string | null
          cierre_oficialia: string | null
          creado_el: string
          despacho_id: string | null
          distrito: string | null
          domicilio: string | null
          entidad: string | null
          fuero: Database["public"]["Enums"]["fuero"]
          id: string
          materia: string | null
          nombre: string
          notas: string | null
        }
        Insert: {
          calendario_id?: string | null
          cierre_oficialia?: string | null
          creado_el?: string
          despacho_id?: string | null
          distrito?: string | null
          domicilio?: string | null
          entidad?: string | null
          fuero: Database["public"]["Enums"]["fuero"]
          id?: string
          materia?: string | null
          nombre: string
          notas?: string | null
        }
        Update: {
          calendario_id?: string | null
          cierre_oficialia?: string | null
          creado_el?: string
          despacho_id?: string | null
          distrito?: string | null
          domicilio?: string | null
          entidad?: string | null
          fuero?: Database["public"]["Enums"]["fuero"]
          id?: string
          materia?: string | null
          nombre?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organos_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organos_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_el: string
          cedula: string | null
          correo: string | null
          creado_el: string
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          actualizado_el?: string
          cedula?: string | null
          correo?: string | null
          creado_el?: string
          id: string
          nombre?: string
          telefono?: string | null
        }
        Update: {
          actualizado_el?: string
          cedula?: string | null
          correo?: string | null
          creado_el?: string
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          actualizado_el: string
          correo: string | null
          creado_el: string
          curp: string | null
          despacho_id: string
          domicilio: string | null
          id: string
          nombre: string
          nombre_cotejo: string
          notas: string | null
          relacion: Database["public"]["Enums"]["relacion_persona"]
          representante: string | null
          rfc: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_persona"]
        }
        Insert: {
          actualizado_el?: string
          correo?: string | null
          creado_el?: string
          curp?: string | null
          despacho_id: string
          domicilio?: string | null
          id?: string
          nombre: string
          nombre_cotejo?: string
          notas?: string | null
          relacion?: Database["public"]["Enums"]["relacion_persona"]
          representante?: string | null
          rfc?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_persona"]
        }
        Update: {
          actualizado_el?: string
          correo?: string | null
          creado_el?: string
          curp?: string | null
          despacho_id?: string
          domicilio?: string | null
          id?: string
          nombre?: string
          nombre_cotejo?: string
          notas?: string | null
          relacion?: Database["public"]["Enums"]["relacion_persona"]
          representante?: string | null
          rfc?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_persona"]
        }
        Relationships: [
          {
            foreignKeyName: "personas_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
        ]
      }
      plazo_alertas_enviadas: {
        Row: {
          destinatarios: string[] | null
          enviado_el: string
          id: string
          nivel: Database["public"]["Enums"]["nivel_alerta"]
          plazo_id: string
        }
        Insert: {
          destinatarios?: string[] | null
          enviado_el?: string
          id?: string
          nivel: Database["public"]["Enums"]["nivel_alerta"]
          plazo_id: string
        }
        Update: {
          destinatarios?: string[] | null
          enviado_el?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_alerta"]
          plazo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plazo_alertas_enviadas_plazo_id_fkey"
            columns: ["plazo_id"]
            isOneToOne: false
            referencedRelation: "plazos"
            referencedColumns: ["id"]
          },
        ]
      }
      plazos: {
        Row: {
          actuacion_cumplimiento_id: string | null
          actuacion_id: string | null
          actualizado_el: string
          ajustado_el: string | null
          ajustado_por: string | null
          atendido_el: string | null
          atendido_por: string | null
          calendario_id: string | null
          computo: Json
          confiabilidad: string
          creado_el: string
          creado_por: string | null
          dias: number
          dias_distancia: number
          estado: Database["public"]["Enums"]["estado_plazo"]
          etiqueta: string
          expediente_id: string
          fecha_notificacion: string
          fecha_surte_efectos: string
          fecha_vencimiento: string
          fecha_vencimiento_ajustada: string | null
          fecha_vencimiento_efectiva: string | null
          id: string
          motivo_ajuste: string | null
          notas: string | null
          plazo_catalogo_id: string | null
          primer_dia: string
          regimen: string
          responsable_id: string | null
          tipo_notificacion: string
          unidad: string
        }
        Insert: {
          actuacion_cumplimiento_id?: string | null
          actuacion_id?: string | null
          actualizado_el?: string
          ajustado_el?: string | null
          ajustado_por?: string | null
          atendido_el?: string | null
          atendido_por?: string | null
          calendario_id?: string | null
          computo?: Json
          confiabilidad?: string
          creado_el?: string
          creado_por?: string | null
          dias: number
          dias_distancia?: number
          estado?: Database["public"]["Enums"]["estado_plazo"]
          etiqueta: string
          expediente_id: string
          fecha_notificacion: string
          fecha_surte_efectos: string
          fecha_vencimiento: string
          fecha_vencimiento_ajustada?: string | null
          fecha_vencimiento_efectiva?: string | null
          id?: string
          motivo_ajuste?: string | null
          notas?: string | null
          plazo_catalogo_id?: string | null
          primer_dia: string
          regimen: string
          responsable_id?: string | null
          tipo_notificacion: string
          unidad?: string
        }
        Update: {
          actuacion_cumplimiento_id?: string | null
          actuacion_id?: string | null
          actualizado_el?: string
          ajustado_el?: string | null
          ajustado_por?: string | null
          atendido_el?: string | null
          atendido_por?: string | null
          calendario_id?: string | null
          computo?: Json
          confiabilidad?: string
          creado_el?: string
          creado_por?: string | null
          dias?: number
          dias_distancia?: number
          estado?: Database["public"]["Enums"]["estado_plazo"]
          etiqueta?: string
          expediente_id?: string
          fecha_notificacion?: string
          fecha_surte_efectos?: string
          fecha_vencimiento?: string
          fecha_vencimiento_ajustada?: string | null
          fecha_vencimiento_efectiva?: string | null
          id?: string
          motivo_ajuste?: string | null
          notas?: string | null
          plazo_catalogo_id?: string | null
          primer_dia?: string
          regimen?: string
          responsable_id?: string | null
          tipo_notificacion?: string
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "plazos_actuacion_cumplimiento_id_fkey"
            columns: ["actuacion_cumplimiento_id"]
            isOneToOne: false
            referencedRelation: "actuaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_actuacion_id_fkey"
            columns: ["actuacion_id"]
            isOneToOne: false
            referencedRelation: "actuaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_ajustado_por_fkey"
            columns: ["ajustado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_plazo_catalogo_id_fkey"
            columns: ["plazo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "plazos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plazos_catalogo: {
        Row: {
          actualizado_el: string
          clave: string | null
          creado_el: string
          despacho_id: string | null
          dias: number
          etiqueta: string
          fundamento: string
          id: string
          nota: string | null
          regimen: string
          unidad: string
          verificacion_notas: string | null
          verificado_el: string | null
          verificado_por: string | null
        }
        Insert: {
          actualizado_el?: string
          clave?: string | null
          creado_el?: string
          despacho_id?: string | null
          dias: number
          etiqueta: string
          fundamento: string
          id?: string
          nota?: string | null
          regimen: string
          unidad?: string
          verificacion_notas?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Update: {
          actualizado_el?: string
          clave?: string | null
          creado_el?: string
          despacho_id?: string | null
          dias?: number
          etiqueta?: string
          fundamento?: string
          id?: string
          nota?: string | null
          regimen?: string
          unidad?: string
          verificacion_notas?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plazos_catalogo_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_catalogo_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regimenes_verificados: {
        Row: {
          despacho_id: string
          id: string
          notas: string | null
          regimen: string
          verificado_el: string
          verificado_por: string
        }
        Insert: {
          despacho_id: string
          id?: string
          notas?: string | null
          regimen: string
          verificado_el?: string
          verificado_por: string
        }
        Update: {
          despacho_id?: string
          id?: string
          notas?: string | null
          regimen?: string
          verificado_el?: string
          verificado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "regimenes_verificados_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regimenes_verificados_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripcion_eventos: {
        Row: {
          carga: Json | null
          despacho_id: string | null
          evento_id: string
          id: string
          recibido_el: string
          tipo: string
        }
        Insert: {
          carga?: Json | null
          despacho_id?: string | null
          evento_id: string
          id?: string
          recibido_el?: string
          tipo: string
        }
        Update: {
          carga?: Json | null
          despacho_id?: string | null
          evento_id?: string
          id?: string
          recibido_el?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripcion_eventos_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_expediente: {
        Args: {
          p_caratula: string
          p_cliente_persona_id?: string
          p_cuantia?: number
          p_despacho_id: string
          p_entidad?: string
          p_etapa_actual?: string
          p_etapas: Json
          p_fecha_inicio?: string
          p_fuero: Database["public"]["Enums"]["fuero"]
          p_instancia?: string
          p_materia: string
          p_notas?: string
          p_numero_organo?: string
          p_organo_id?: string
          p_partes: Json
          p_responsable_id?: string
          p_restringido?: boolean
          p_via: string
        }
        Returns: string
      }
      aceptar_invitacion: {
        Args: { p_nombre: string; p_token_hash: string }
        Returns: string
      }
      asientos_ocupados: { Args: { p_despacho: string }; Returns: number }
      contar_asientos_ocupados: {
        Args: { p_despacho: string }
        Returns: number
      }
      contar_expedientes_activos: {
        Args: { p_despacho: string }
        Returns: number
      }
      crear_mi_despacho: {
        Args: {
          p_correo: string
          p_despacho_nombre: string
          p_nombre_titular: string
          p_slug_base: string
        }
        Returns: string
      }
      despachos_del_usuario: { Args: never; Returns: string[] }
      es_miembro: { Args: { p_despacho: string }; Returns: boolean }
      es_personal: { Args: { p_despacho: string }; Returns: boolean }
      es_servicio: { Args: never; Returns: boolean }
      expediente_de_ruta: { Args: { p_ruta: string }; Returns: string }
      expedientes_activos: { Args: { p_despacho: string }; Returns: number }
      mirar_invitacion: {
        Args: { p_token_hash: string }
        Returns: {
          correo: string
          despacho_nombre: string
          rol: Database["public"]["Enums"]["rol_membresia"]
          vigente: boolean
        }[]
      }
      persona_del_usuario: { Args: { p_despacho: string }; Returns: string }
      puede_editar_expediente: {
        Args: { p_expediente: string }
        Returns: boolean
      }
      puede_ver_expediente: { Args: { p_expediente: string }; Returns: boolean }
      tiene_rol: {
        Args: {
          p_despacho: string
          p_roles: Database["public"]["Enums"]["rol_membresia"][]
        }
        Returns: boolean
      }
    }
    Enums: {
      estado_audiencia: "programada" | "celebrada" | "diferida" | "cancelada"
      estado_expediente:
        | "prospecto"
        | "activo"
        | "suspendido"
        | "concluido"
        | "archivado"
      estado_invitacion: "pendiente" | "aceptada" | "revocada"
      estado_membresia: "invitada" | "activa" | "suspendida"
      estado_plazo: "pendiente" | "atendido" | "vencido" | "cancelado"
      estado_suscripcion: "gratuita" | "activa" | "morosa" | "cancelada"
      fuero: "federal" | "comun"
      motivo_inhabil: "feriado" | "vacaciones" | "suspension"
      nivel_alerta:
        | "t_menos_5"
        | "t_menos_3"
        | "t_menos_1"
        | "vence_hoy"
        | "vencido"
      plan_suscripcion: "gratuito" | "profesional" | "despacho"
      relacion_persona:
        | "cliente_activo"
        | "cliente_anterior"
        | "contraparte"
        | "tercero"
      resultado_expediente:
        | "favorable"
        | "parcialmente_favorable"
        | "desfavorable"
        | "convenio"
        | "desistimiento"
        | "caducidad"
        | "sobreseimiento"
        | "otro"
      rol_membresia: "titular" | "abogado" | "pasante" | "asistente" | "cliente"
      tipo_actuacion:
        | "promocion"
        | "acuerdo"
        | "notificacion"
        | "resolucion"
        | "audiencia"
        | "diligencia"
        | "comunicacion"
        | "nota_interna"
      tipo_documento:
        | "escrito_inicial"
        | "promocion"
        | "anexo"
        | "acuse"
        | "acuerdo"
        | "resolucion"
        | "poder"
        | "identificacion"
        | "prueba"
        | "contrato"
        | "otro"
      tipo_persona: "fisica" | "moral"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_audiencia: ["programada", "celebrada", "diferida", "cancelada"],
      estado_expediente: [
        "prospecto",
        "activo",
        "suspendido",
        "concluido",
        "archivado",
      ],
      estado_invitacion: ["pendiente", "aceptada", "revocada"],
      estado_membresia: ["invitada", "activa", "suspendida"],
      estado_plazo: ["pendiente", "atendido", "vencido", "cancelado"],
      estado_suscripcion: ["gratuita", "activa", "morosa", "cancelada"],
      fuero: ["federal", "comun"],
      motivo_inhabil: ["feriado", "vacaciones", "suspension"],
      nivel_alerta: [
        "t_menos_5",
        "t_menos_3",
        "t_menos_1",
        "vence_hoy",
        "vencido",
      ],
      plan_suscripcion: ["gratuito", "profesional", "despacho"],
      relacion_persona: [
        "cliente_activo",
        "cliente_anterior",
        "contraparte",
        "tercero",
      ],
      resultado_expediente: [
        "favorable",
        "parcialmente_favorable",
        "desfavorable",
        "convenio",
        "desistimiento",
        "caducidad",
        "sobreseimiento",
        "otro",
      ],
      rol_membresia: ["titular", "abogado", "pasante", "asistente", "cliente"],
      tipo_actuacion: [
        "promocion",
        "acuerdo",
        "notificacion",
        "resolucion",
        "audiencia",
        "diligencia",
        "comunicacion",
        "nota_interna",
      ],
      tipo_documento: [
        "escrito_inicial",
        "promocion",
        "anexo",
        "acuse",
        "acuerdo",
        "resolucion",
        "poder",
        "identificacion",
        "prueba",
        "contrato",
        "otro",
      ],
      tipo_persona: ["fisica", "moral"],
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CAPA DE ALIAS
// ─────────────────────────────────────────────────────────────────────────────
// Nombres cortos en español para lo que el dominio usa a diario. NO son copias:
// se derivan de `Database`, así que al regenerar el archivo se corrigen solos.
// Si una tabla o un enum desaparece del esquema, el error sale aquí y no
// veintiocho archivos más adelante.
//
// Los sufijos `Db` (`FueroDb`, `MotivoInhabilDb`, `TipoPersonaDb`,
// `NivelAlertaDb`) distinguen el enum de la base del tipo del dominio que se
// llama igual: el motor de plazos tiene su propio `Fuero` y su propio
// `MotivoInhabil`, y confundirlos fue lo que obligó a marcarlos.

type Tablas = Database['public']['Tables']
type Enumeraciones = Database['public']['Enums']

// ── Enumeraciones ──────────────────────────────────────────────────────────

export type RolMembresia = Enumeraciones['rol_membresia']
export type EstadoMembresia = Enumeraciones['estado_membresia']
export type EstadoInvitacion = Enumeraciones['estado_invitacion']
export type PlanSuscripcion = Enumeraciones['plan_suscripcion']
export type EstadoSuscripcion = Enumeraciones['estado_suscripcion']
export type FueroDb = Enumeraciones['fuero']
export type MotivoInhabilDb = Enumeraciones['motivo_inhabil']
export type TipoPersonaDb = Enumeraciones['tipo_persona']
export type RelacionPersona = Enumeraciones['relacion_persona']
export type EstadoExpediente = Enumeraciones['estado_expediente']
export type ResultadoExpediente = Enumeraciones['resultado_expediente']
export type TipoActuacion = Enumeraciones['tipo_actuacion']
export type TipoDocumento = Enumeraciones['tipo_documento']
export type EstadoAudiencia = Enumeraciones['estado_audiencia']
export type EstadoPlazo = Enumeraciones['estado_plazo']
export type NivelAlertaDb = Enumeraciones['nivel_alerta']

// ── Filas ──────────────────────────────────────────────────────────────────

export type DespachoRow = Tablas['despachos']['Row']
export type SuscripcionEventoRow = Tablas['suscripcion_eventos']['Row']
export type PerfilRow = Tablas['perfiles']['Row']
export type MembresiaRow = Tablas['membresias']['Row']
export type InvitacionRow = Tablas['invitaciones']['Row']
export type CalendarioRow = Tablas['calendarios']['Row']
export type DiaInhabilRow = Tablas['dias_inhabiles']['Row']
export type OrganoRow = Tablas['organos']['Row']
export type PlazoCatalogoRow = Tablas['plazos_catalogo']['Row']
export type RegimenVerificadoRow = Tablas['regimenes_verificados']['Row']
export type PersonaRow = Tablas['personas']['Row']
export type ExpedienteRow = Tablas['expedientes']['Row']
export type ExpedienteAccesoRow = Tablas['expediente_accesos']['Row']
export type ExpedienteParteRow = Tablas['expediente_partes']['Row']
export type ExpedienteEtapaRow = Tablas['expediente_etapas']['Row']
export type ActuacionRow = Tablas['actuaciones']['Row']
export type DocumentoRow = Tablas['documentos']['Row']
export type AudienciaRow = Tablas['audiencias']['Row']
export type PlazoRow = Tablas['plazos']['Row']
export type PlazoAlertaEnviadaRow = Tablas['plazo_alertas_enviadas']['Row']
