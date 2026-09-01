/**
 * El texto del aviso (puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ASUNTO DICE LO PEOR QUE HAY DENTRO
 * ─────────────────────────────────────────────────────────────────────────────
 * "Litis: resumen de plazos" se lee después. "Vence hoy: contestación en
 * Pérez vs. Constructora" se lee ahora. Un correo de alerta que no dice en el
 * asunto qué tan grave es obliga a abrirlo para saberlo, y el día con prisa es
 * justo el día en que no se abre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL AVISO NO DICTAMINA
 * ─────────────────────────────────────────────────────────────────────────────
 * Va con el mismo aviso que toda la aplicación: el cómputo es control interno,
 * no asesoría, y la responsabilidad es de quien firma. Un correo que da una
 * fecha por definitiva le pasa al abogado un riesgo que no aceptó.
 */

import { AVISO_COMPUTO } from '@/lib/brand'
import { NIVEL_META, type AlertaPendiente } from '@/lib/plazos/alertas'
import { fechaLargaConDia } from '@/lib/plazos/fecha'

import { nivelMasUrgente, type Lote } from './destinatarios'

/** Un renglón por término, legible sin abrir el sistema. */
export function renglon(alerta: AlertaPendiente): string {
  const { plazo, nivel } = alerta
  return [
    `${NIVEL_META[nivel].etiqueta}: ${plazo.etiqueta}`,
    `${plazo.numeroExpediente} — ${plazo.caratula}`,
    `Vence el ${fechaLargaConDia(plazo.fechaVencimiento)}.`,
  ].join(' ')
}

export function asunto(lote: Lote): string {
  const peor = nivelMasUrgente(lote.alertas)
  const n = lote.alertas.length

  if (!peor) return 'Plazos por vencer'

  const primero = lote.alertas[0]
  const cabeza =
    peor === 'vencido'
      ? 'Plazo vencido sin presentación registrada'
      : NIVEL_META[peor].etiqueta

  // Con un solo término, el asunto lo nombra: se resuelve sin abrir el correo.
  if (n === 1 && primero) {
    return `${cabeza}: ${primero.plazo.etiqueta} — ${primero.plazo.numeroExpediente}`
  }
  return `${cabeza}, y ${n - 1} ${n - 1 === 1 ? 'plazo más' : 'plazos más'}`
}

export interface CuerpoAviso {
  titulo: string
  parrafos: string[]
  boton: { texto: string; url: string }
  pie: string
}

export function cuerpo(lote: Lote, origen: string): CuerpoAviso {
  const peor = nivelMasUrgente(lote.alertas)

  const entrada = lote.huerfanas
    ? // El titular necesita saber POR QUÉ le está llegando esto a él.
      `Estos términos no tienen responsable asignado, así que nadie los está viendo. Te llegan a ti por ser el titular del despacho.`
    : `Esto es lo que tienes por vencer, de lo más urgente a lo menos.`

  const parrafos = [entrada, ...lote.alertas.map(renglon)]

  if (peor && peor !== 'vencido') {
    parrafos.push(NIVEL_META[peor].intencion)
  }
  if (lote.alertas.some((a) => a.nivel === 'vencido')) {
    parrafos.push(NIVEL_META.vencido.intencion)
  }

  return {
    titulo: asunto(lote),
    parrafos,
    boton: { texto: 'Abrir el panel', url: `${origen.replace(/\/+$/, '')}/panel` },
    pie: AVISO_COMPUTO,
  }
}
