-- =============================================================================
-- Litis — Migración 0008: Semilla de calendarios y catálogo de plazos
-- =============================================================================
-- Sin un calendario cargado, el motor de plazos no puede computar nada. Esta
-- migración deja los dos calendarios semilla de 2026 y el catálogo de plazos
-- como CATÁLOGO COMPARTIDO (`despacho_id is null`): lo lee todo despacho, no
-- lo edita ninguno.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL BLOQUE DE DATOS ESTÁ GENERADO, NO TECLEADO
-- ─────────────────────────────────────────────────────────────────────────────
-- Sale de `src/lib/plazos/calendarios-semilla.ts` y `catalogo.ts` mediante el
-- generador de `scripts/`. Teclear las mismas 25 filas a mano garantizaría que
-- el SQL y el código dijeran cosas distintas dentro de tres meses. Hay una
-- prueba (`semilla.test.ts`) que falla si se separan.
--
-- ⚠️ Todo el catálogo entra SIN verificar. Es deliberado: los ordenamientos se
-- reforman y el CNPCyF desplaza a los códigos locales hasta 2027. Un abogado
-- del despacho tiene que confirmarlo, y hasta entonces cada cómputo se muestra
-- marcado.
-- =============================================================================

-- `clave` identifica un calendario semilla de forma estable, para que la
-- aplicación pueda pedir "el del Poder Judicial de la Federación" sin conocer
-- su uuid. Solo aplica a los compartidos; los de un despacho no la necesitan.
alter table public.calendarios
  add column if not exists clave text;

create unique index if not exists calendarios_clave_compartida
  on public.calendarios (clave)
  where despacho_id is null;

-- Poder Judicial de la Federación 2026 (semilla)
insert into public.calendarios (despacho_id, clave, nombre, vigencia_desde, vigencia_hasta, fin_de_semana_inhabil)
values (null, 'pjf-2026', 'Poder Judicial de la Federación 2026 (semilla)', '2026-01-01', '2026-12-31', true)
on conflict (clave) where despacho_id is null do nothing;

insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-01-01', '2026-01-01', 'feriado', 'Año Nuevo', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-01-01'
                      and d.descripcion = 'Año Nuevo');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-02-05', '2026-02-05', 'feriado', 'Aniversario de la Constitución', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-02-05'
                      and d.descripcion = 'Aniversario de la Constitución');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-03-21', '2026-03-21', 'feriado', 'Natalicio de Benito Juárez', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-03-21'
                      and d.descripcion = 'Natalicio de Benito Juárez');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-05-01', '2026-05-01', 'feriado', 'Día del Trabajo', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-05-01'
                      and d.descripcion = 'Día del Trabajo');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-09-16', '2026-09-16', 'feriado', 'Independencia', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-09-16'
                      and d.descripcion = 'Independencia');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-11-20', '2026-11-20', 'feriado', 'Aniversario de la Revolución', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-11-20'
                      and d.descripcion = 'Aniversario de la Revolución');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-12-25', '2026-12-25', 'feriado', 'Navidad', 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-12-25'
                      and d.descripcion = 'Navidad');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-07-16', '2026-07-31', 'vacaciones', 'Primer periodo vacacional (confirmar contra el acuerdo del CJF)', 'Acuerdo anual del Consejo de la Judicatura Federal'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-07-16'
                      and d.descripcion = 'Primer periodo vacacional (confirmar contra el acuerdo del CJF)');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-12-16', '2026-12-31', 'vacaciones', 'Segundo periodo vacacional (confirmar contra el acuerdo del CJF)', 'Acuerdo anual del Consejo de la Judicatura Federal'
  from public.calendarios cal
 where cal.clave = 'pjf-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-12-16'
                      and d.descripcion = 'Segundo periodo vacacional (confirmar contra el acuerdo del CJF)');

-- Materia laboral 2026 (semilla)
insert into public.calendarios (despacho_id, clave, nombre, vigencia_desde, vigencia_hasta, fin_de_semana_inhabil)
values (null, 'laboral-2026', 'Materia laboral 2026 (semilla)', '2026-01-01', '2026-12-31', true)
on conflict (clave) where despacho_id is null do nothing;

insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-01-01', '2026-01-01', 'feriado', 'Año Nuevo', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-01-01'
                      and d.descripcion = 'Año Nuevo');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-02-02', '2026-02-02', 'feriado', 'Primer lunes de febrero', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-02-02'
                      and d.descripcion = 'Primer lunes de febrero');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-03-16', '2026-03-16', 'feriado', 'Tercer lunes de marzo', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-03-16'
                      and d.descripcion = 'Tercer lunes de marzo');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-05-01', '2026-05-01', 'feriado', 'Día del Trabajo', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-05-01'
                      and d.descripcion = 'Día del Trabajo');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-09-16', '2026-09-16', 'feriado', 'Independencia', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-09-16'
                      and d.descripcion = 'Independencia');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-11-16', '2026-11-16', 'feriado', 'Tercer lunes de noviembre', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-11-16'
                      and d.descripcion = 'Tercer lunes de noviembre');
insert into public.dias_inhabiles (calendario_id, desde, hasta, motivo, descripcion, fundamento)
select cal.id, '2026-12-25', '2026-12-25', 'feriado', 'Navidad', 'Ley Federal del Trabajo, art. 74'
  from public.calendarios cal
 where cal.clave = 'laboral-2026' and cal.despacho_id is null
   and not exists (select 1 from public.dias_inhabiles d
                    where d.calendario_id = cal.id and d.desde = '2026-12-25'
                      and d.descripcion = 'Navidad');

-- Catálogo semilla de plazos. Nace SIN verificar, a propósito.
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.contestacion.ordinario', 'mercantil', 'Contestación de demanda — juicio ordinario mercantil', 15, 'habiles', 'Código de Comercio, art. 1378', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.contestacion.ordinario' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.contestacion.ejecutivo', 'mercantil', 'Contestación y oposición de excepciones — ejecutivo mercantil', 8, 'habiles', 'Código de Comercio, art. 1399', 'Corre desde el requerimiento y emplazamiento. Confirma la fecha del acta del actuario.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.contestacion.ejecutivo' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.contestacion.oral', 'mercantil', 'Contestación de demanda — juicio oral mercantil', 9, 'habiles', 'Código de Comercio, art. 1390 Bis 17', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.contestacion.oral' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.apelacion.definitiva', 'mercantil', 'Apelación contra sentencia definitiva', 9, 'habiles', 'Código de Comercio, art. 1079', 'Revisa además la cuantía: la apelación no procede en todos los asuntos.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.apelacion.definitiva' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.apelacion.interlocutoria', 'mercantil', 'Apelación contra auto o sentencia interlocutoria', 6, 'habiles', 'Código de Comercio, art. 1079', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.apelacion.interlocutoria' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'merc.revocacion', 'mercantil', 'Recurso de revocación', 3, 'habiles', 'Código de Comercio, art. 1079', 'Plazo muy corto: es de los que más se pierden. Verifícalo apenas se notifique el auto.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'merc.revocacion' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.demanda.indirecto', 'amparo', 'Demanda de amparo indirecto', 15, 'habiles', 'Ley de Amparo, art. 17', 'Hay supuestos de excepción con plazos distintos o sin plazo. Revisa el art. 17 completo antes de aplicar los 15 días.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.demanda.indirecto' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.demanda.directo', 'amparo', 'Demanda de amparo directo', 15, 'habiles', 'Ley de Amparo, art. 17', 'Se presenta ante la autoridad responsable, no ante el Tribunal Colegiado. Agenda el lugar de presentación junto con la fecha.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.demanda.directo' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.demanda.norma_autoaplicativa', 'amparo', 'Amparo contra norma general autoaplicativa', 30, 'habiles', 'Ley de Amparo, art. 17, fr. I', 'Corre desde la entrada en vigor de la norma. Si se reclama con motivo del primer acto de aplicación, el plazo es el general.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.demanda.norma_autoaplicativa' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.revision', 'amparo', 'Recurso de revisión', 10, 'habiles', 'Ley de Amparo, art. 86', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.revision' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.queja', 'amparo', 'Recurso de queja', 5, 'habiles', 'Ley de Amparo, art. 98', 'El plazo NO es uniforme: hay supuestos de dos días y otros en que procede en cualquier tiempo. Identifica la fracción aplicable antes de agendar.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.queja' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'amp.reclamacion', 'amparo', 'Recurso de reclamación', 3, 'habiles', 'Ley de Amparo, art. 105', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'amp.reclamacion' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'tfja.demanda.ordinaria', 'contencioso_administrativo', 'Demanda de nulidad — vía ordinaria', 30, 'habiles', 'Ley Federal de Procedimiento Contencioso Administrativo, art. 13', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'tfja.demanda.ordinaria' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'tfja.demanda.sumaria', 'contencioso_administrativo', 'Demanda de nulidad — vía sumaria', 15, 'habiles', 'Ley Federal de Procedimiento Contencioso Administrativo, art. 58-2', 'La vía sumaria depende de la cuantía y del tipo de resolución. Si el asunto encuadra en sumaria y presentas en 30 días, llegas tarde.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'tfja.demanda.sumaria' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'tfja.ampliacion', 'contencioso_administrativo', 'Ampliación de demanda', 10, 'habiles', 'Ley Federal de Procedimiento Contencioso Administrativo, art. 17', null
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'tfja.ampliacion' and despacho_id is null);
insert into public.plazos_catalogo (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
select null, 'cff.revocacion', 'fiscal_administrativo', 'Recurso de revocación', 30, 'habiles', 'Código Fiscal de la Federación, art. 121', 'Si la notificación fue por buzón tributario, la fecha de notificación no es la del envío. Revisa el acuse.'
 where not exists (select 1 from public.plazos_catalogo
                    where clave = 'cff.revocacion' and despacho_id is null);

-- =============================================================================
-- FIN — 0008
-- =============================================================================
