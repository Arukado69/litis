/**
 * Identidad de marca en UN solo lugar.
 *
 * El nombre todavía no está decidido. "Litis" es el nombre de trabajo, y todo
 * el código lo consume desde aquí para que cambiarlo sea editar este archivo y
 * renombrar el repositorio — no un buscar-y-reemplazar por doscientos archivos
 * donde siempre se queda uno.
 *
 * Regla: ningún componente, correo, título de página ni texto legal escribe el
 * nombre a mano. Si necesitas el nombre, lo importas de aquí.
 */

export const MARCA = {
  nombre: 'Litis',
  /** Para títulos de página: "Expedientes · Litis". */
  sufijoTitulo: 'Litis',
  descripcionCorta:
    'Gestión de expedientes, plazos y audiencias para abogados litigantes.',
  descripcionLarga:
    'Litis organiza los expedientes de un despacho, computa los plazos procesales con su fundamento a la vista y avisa antes de que venzan.',

  /** Se llenan cuando exista dominio y correo reales. */
  dominio: '',
  correoContacto: '',
  telefono: '',
} as const

/** "Expedientes · Litis" */
export function titulo(pagina?: string): string {
  return pagina ? `${pagina} · ${MARCA.sufijoTitulo}` : MARCA.nombre
}

/**
 * El aviso que acompaña a todo cómputo de plazos.
 *
 * NO es letra chica de abogado defensivo: es la descripción exacta de lo que
 * la herramienta hace y lo que no. Un producto que calcula plazos y deja creer
 * que la fecha es definitiva le está pasando al usuario un riesgo que este no
 * aceptó. Aparece junto al resultado, no escondido en los términos de uso.
 */
export const AVISO_COMPUTO =
  'Este cómputo es una herramienta de control interno, no una asesoría ni un dictamen. Verifica la fecha contra el ordenamiento aplicable y el calendario del órgano antes de actuar sobre ella. La responsabilidad profesional del cómputo es de quien firma la promoción.'
