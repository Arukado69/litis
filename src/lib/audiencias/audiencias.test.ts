import { describe, expect, it } from 'vitest'

import { CALENDARIO_PJF_2026 } from '@/lib/plazos/calendarios-semilla'

import {
  armarAgenda,
  diasImposibles,
  habilesEnAgenda,
  type AudienciaEnAgenda,
  type VencimientoEnAgenda,
} from './agenda'
import {
  advertenciasDeAudiencia,
  anotacionDeDiferimiento,
  leerAudiencia,
  leerDiferimiento,
  leerHora,
  validarAudiencia,
  validarCelebracion,
  validarDiferimiento,
} from './audiencias'

const PJF = CALENDARIO_PJF_2026
const HOY = '2026-03-09' // lunes

function audiencia(over: Partial<AudienciaEnAgenda> = {}): AudienciaEnAgenda {
  return {
    id: 'a1',
    expedienteId: 'e1',
    numeroExpediente: '431/2026',
    caratula: 'Pérez vs. Constructora XYZ',
    tipo: 'Audiencia preliminar',
    fecha: '2026-03-12',
    hora: '10:00',
    lugar: 'Juzgado 5º Civil',
    estado: 'programada',
    responsableId: 'danny',
    responsableNombre: 'Danny Salas',
    ...over,
  }
}

function vencimiento(
  over: Partial<VencimientoEnAgenda> = {},
): VencimientoEnAgenda {
  return {
    id: 'v1',
    expedienteId: 'e2',
    numeroExpediente: '99/2026',
    caratula: 'Otro asunto',
    etiqueta: 'Contestación de demanda',
    fecha: '2026-03-12',
    responsableId: 'danny',
    responsableNombre: 'Danny Salas',
    ...over,
  }
}

describe('leerHora', () => {
  it('acepta HH:MM', () => {
    expect(leerHora('09:30')).toBe('09:30')
    expect(leerHora('23:59')).toBe('23:59')
  })

  it('recorta los segundos que manda la base', () => {
    expect(leerHora('09:30:00')).toBe('09:30')
  })

  it('descarta lo que no es hora en vez de adivinar', () => {
    for (const malo of ['25:00', '9:30', '09:60', 'diez', '']) {
      expect(leerHora(malo)).toBeNull()
    }
  })
})

describe('leerAudiencia', () => {
  it('lee lo que manda el formulario', () => {
    const leida = leerAudiencia({
      tipo: '  Audiencia de juicio ',
      fecha: '2026-04-10',
      hora: '11:00',
      lugar: 'Juzgado 3º',
    })
    expect(leida.tipo).toBe('Audiencia de juicio')
    expect(leida.fecha).toBe('2026-04-10')
    expect(leida.hora).toBe('11:00')
  })

  it('viene visible para el cliente de fábrica', () => {
    // Cuándo es su audiencia es de lo poco del expediente que le toca a él.
    expect(leerAudiencia({}).visibleCliente).toBe(true)
  })

  it('se puede ocultar de forma expresa', () => {
    expect(leerAudiencia({ visibleCliente: 'off' }).visibleCliente).toBe(false)
  })
})

describe('validarAudiencia', () => {
  const buena = leerAudiencia({ tipo: 'Audiencia preliminar', fecha: '2026-04-10' })

  it('acepta una audiencia normal', () => {
    expect(validarAudiencia(buena)).toEqual([])
  })

  it('acepta fecha futura: una audiencia ES un plan', () => {
    // Al revés que la bitácora, que solo registra lo que ya pasó.
    expect(
      validarAudiencia(leerAudiencia({ tipo: 'Juicio', fecha: '2027-01-15' })),
    ).toEqual([])
  })

  it('exige la fecha', () => {
    expect(validarAudiencia({ ...buena, fecha: null })).not.toEqual([])
  })

  it('exige decir qué audiencia es', () => {
    expect(validarAudiencia({ ...buena, tipo: 'x' })).not.toEqual([])
  })
})

describe('advertenciasDeAudiencia', () => {
  it('sin responsable, lo dice con todas sus letras', () => {
    // Es el aviso que más importa: una audiencia sin responsable es una a la
    // que no va nadie.
    const avisos = advertenciasDeAudiencia(
      leerAudiencia({ tipo: 'Preliminar', fecha: '2026-04-10', hora: '10:00', lugar: 'X' }),
    )
    expect(avisos.join(' ')).toMatch(/no va nadie/i)
  })

  it('no bloquea: se señala con lo que se sabe ese día', () => {
    // A veces el acuerdo dice el día pero no la hora. Exigirlo todo obligaría a
    // anotarla en un papel aparte.
    const captura = leerAudiencia({ tipo: 'Preliminar', fecha: '2026-04-10' })
    expect(validarAudiencia(captura)).toEqual([])
    expect(advertenciasDeAudiencia(captura).length).toBeGreaterThan(0)
  })

  it('completa no advierte nada', () => {
    const captura = leerAudiencia({
      tipo: 'Preliminar',
      fecha: '2026-04-10',
      hora: '10:00',
      lugar: 'Juzgado 5º',
      responsableId: 'danny',
    })
    expect(advertenciasDeAudiencia(captura)).toEqual([])
  })
})

describe('diferir', () => {
  it('exige fecha nueva y motivo', () => {
    const problemas = validarDiferimiento(leerDiferimiento({}), '2026-03-12')
    expect(problemas.map((p) => p.campo)).toEqual(['fechaNueva', 'motivo'])
  })

  it('la nueva fecha va hacia adelante', () => {
    // Diferir es mover hacia adelante; una fecha anterior es un error de
    // captura, y el que se cuela es el año.
    const problemas = validarDiferimiento(
      leerDiferimiento({ fechaNueva: '2026-03-01', motivo: 'No hubo quórum.' }),
      '2026-03-12',
    )
    expect(problemas[0]?.campo).toBe('fechaNueva')
  })

  it('la misma fecha tampoco es diferir', () => {
    expect(
      validarDiferimiento(
        leerDiferimiento({ fechaNueva: '2026-03-12', motivo: 'Lo que sea aquí.' }),
        '2026-03-12',
      ).map((p) => p.campo),
    ).toContain('fechaNueva')
  })

  it('acepta un diferimiento normal', () => {
    expect(
      validarDiferimiento(
        leerDiferimiento({
          fechaNueva: '2026-04-14',
          motivo: 'No se logró notificar al testigo.',
        }),
        '2026-03-12',
      ),
    ).toEqual([])
  })

  it('la anotación conserva las DOS fechas', () => {
    // Ese día se fue al juzgado y se esperó: borrarlo haría desaparecer del
    // expediente un día que se cobra y se justifica ante el cliente.
    const anotacion = anotacionDeDiferimiento(
      'Audiencia preliminar',
      '2026-03-12',
      leerDiferimiento({
        fechaNueva: '2026-04-14',
        motivo: 'No se logró notificar al testigo.',
      }),
    )
    expect(anotacion.detalle).toContain('2026-03-12')
    expect(anotacion.detalle).toContain('2026-04-14')
    expect(anotacion.detalle).toContain('testigo')
  })
})

describe('validarCelebracion', () => {
  it('exige decir qué pasó', () => {
    // Qué pasó en la audiencia ES la audiencia.
    expect(validarCelebracion({ resultado: null })).not.toEqual([])
    expect(validarCelebracion({ resultado: 'ok' })).not.toEqual([])
  })

  it('acepta un resultado de verdad', () => {
    expect(
      validarCelebracion({
        resultado: 'Se desahogaron dos testimoniales y se citó para alegatos.',
      }),
    ).toEqual([])
  })
})

describe('armarAgenda', () => {
  const base = {
    audiencias: [audiencia()],
    vencimientos: [vencimiento({ fecha: '2026-03-10' })],
    hoy: HOY,
    calendario: PJF,
    dias: 7,
  }

  it('devuelve todos los días, también los vacíos', () => {
    // Una agenda que solo enseña los días con algo esconde cuántos días de
    // trabajo hay de aquí a allá, que es el dato con el que se decide.
    expect(armarAgenda(base)).toHaveLength(7)
  })

  it('marca los inhábiles con su motivo', () => {
    const dias = armarAgenda(base)
    const sabado = dias.find((d) => d.fecha === '2026-03-14')
    expect(sabado?.inhabil).toBe(true)
    expect(sabado?.motivoInhabil).toBeTruthy()
  })

  it('pone cada cosa en su día', () => {
    const dias = armarAgenda(base)
    expect(dias.find((d) => d.fecha === '2026-03-12')?.audiencias).toHaveLength(1)
    expect(dias.find((d) => d.fecha === '2026-03-10')?.vencimientos).toHaveLength(1)
  })

  it('un día con audiencia queda TOMADO', () => {
    // No por tener tres pendientes: por tener una audiencia. Se lleva la
    // jornada entre traslado, espera y desahogo.
    const dias = armarAgenda(base)
    expect(dias.find((d) => d.fecha === '2026-03-12')?.tomado).toBe(true)
    expect(dias.find((d) => d.fecha === '2026-03-10')?.tomado).toBe(false)
  })

  it('lo ya celebrado o diferido no ocupa agenda', () => {
    // Ocupó la suya en su momento; ahora vive en la bitácora.
    const dias = armarAgenda({
      ...base,
      audiencias: [
        audiencia({ id: 'x', estado: 'celebrada' }),
        audiencia({ id: 'y', estado: 'diferida' }),
        audiencia({ id: 'z', estado: 'cancelada' }),
      ],
    })
    expect(dias.every((d) => d.audiencias.length === 0)).toBe(true)
  })

  it('las del mismo día se ordenan por hora, y las sin hora al final', () => {
    const dias = armarAgenda({
      ...base,
      audiencias: [
        audiencia({ id: 'tarde', hora: '13:00' }),
        audiencia({ id: 'sin-hora', hora: null }),
        audiencia({ id: 'temprano', hora: '09:00' }),
      ],
    })
    expect(
      dias.find((d) => d.fecha === '2026-03-12')?.audiencias.map((a) => a.id),
    ).toEqual(['temprano', 'tarde', 'sin-hora'])
  })

  it('el primer día es hoy y viene marcado', () => {
    const dias = armarAgenda(base)
    expect(dias[0]?.fecha).toBe(HOY)
    expect(dias[0]?.esHoy).toBe(true)
    expect(dias.filter((d) => d.esHoy)).toHaveLength(1)
  })
})

describe('diasImposibles', () => {
  it('marca dos audiencias de la misma persona el mismo día', () => {
    const dias = armarAgenda({
      audiencias: [
        audiencia({ id: 'a', hora: '09:00' }),
        audiencia({ id: 'b', hora: '11:00' }),
      ],
      vencimientos: [],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    const cargados = diasImposibles(dias)
    expect(cargados).toHaveLength(1)
    expect(cargados[0]?.audiencias).toBe(2)
  })

  it('marca audiencia y vencimiento el mismo día en la misma persona', () => {
    // El caso que arruina la semana: el jueves hay audiencia a las nueve y ese
    // mismo jueves vence una contestación.
    const dias = armarAgenda({
      audiencias: [audiencia()],
      vencimientos: [vencimiento({ fecha: '2026-03-12' })],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    const cargados = diasImposibles(dias)
    expect(cargados).toHaveLength(1)
    expect(cargados[0]?.vencimientos).toBe(1)
  })

  it('un vencimiento solo no es un choque: es trabajo normal', () => {
    const dias = armarAgenda({
      audiencias: [],
      vencimientos: [vencimiento(), vencimiento({ id: 'v2' })],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    expect(diasImposibles(dias)).toEqual([])
  })

  it('dos personas distintas el mismo día no chocan', () => {
    const dias = armarAgenda({
      audiencias: [
        audiencia({ id: 'a', responsableId: 'danny' }),
        audiencia({ id: 'b', responsableId: 'ana', responsableNombre: 'Ana' }),
      ],
      vencimientos: [],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    expect(diasImposibles(dias)).toEqual([])
  })

  it('sin responsable no se puede cruzar con nadie', () => {
    const dias = armarAgenda({
      audiencias: [
        audiencia({ id: 'a', responsableId: null, responsableNombre: null }),
        audiencia({ id: 'b', responsableId: null, responsableNombre: null }),
      ],
      vencimientos: [],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    expect(diasImposibles(dias)).toEqual([])
  })
})

describe('habilesEnAgenda', () => {
  it('cuenta solo los días de trabajo', () => {
    // Del lunes 9 al domingo 15 de marzo de 2026: cinco hábiles.
    const dias = armarAgenda({
      audiencias: [],
      vencimientos: [],
      hoy: HOY,
      calendario: PJF,
      dias: 7,
    })
    expect(habilesEnAgenda(dias)).toBe(5)
  })
})
