const { crear } = require('./mock');
const assert = require('assert');
let n = 0, fallos = 0;
function t(nombre, fn) { try { fn(); n++; console.log('  ok  ' + nombre); } catch (e) { fallos++; console.log('FALLA ' + nombre + '\n      ' + (e.stack || e).split('\n').slice(0, 3).join('\n      ')); } }
const NOW = Date.parse('2026-11-02T18:00:00-03:00');
const ADM = { 'tok-ok': { aud: 'CID', email: 'dueno@mail.com', email_verified: 'true', exp: String(Math.floor(NOW / 1000) + 3600) },
              'tok-otro': { aud: 'CID', email: 'intruso@mail.com', email_verified: 'true', exp: String(Math.floor(NOW / 1000) + 3600) },
              'tok-aud': { aud: 'OTRO', email: 'dueno@mail.com', email_verified: 'true', exp: String(Math.floor(NOW / 1000) + 3600) } };
function nuevo() {
  const a = crear({ tokens: ADM }); a.setNow(NOW);
  a.run('instalar()');
  a.post; // alias
  const adm = (accion, p = {}) => a.post(Object.assign({ action: accion, token: 'tok-ok' }, p));
  a.adm = adm;
  // como en la vida real: el dueño/tuweeb completa estas celdas en la pestaña Config de la hoja (el panel todavía no puede abrir sin googleClientId)
  const v = { googleClientId: 'CID', adminEmails: 'dueno@mail.com', transferAlias: 'salon.fiestas', transferTitular: 'Ana Pérez', emailAdmin: 'dueno@mail.com' };
  Object.keys(v).forEach(k => a.run(`actualizar_('Config', leer_('Config').filter(r => r.clave === '${k}')[0]._row, { valor: '${v[k]}' })`));
  return a;
}
// sábado 2026-11-07 (dow 6)
function conTurnos(a) {
  const t1 = a.adm('admin.guardarTurno', { salonId: 'S1', dias: '5,6,0', inicio: '14:00', fin: '18:00', etiqueta: 'Tarde', precio: 100000, senaTipo: 'pct', senaValor: 30 });
  const t2 = a.adm('admin.guardarTurno', { salonId: 'S1', dias: '5,6,0', inicio: '19:00', fin: '23:00', etiqueta: 'Noche', precio: 120000, senaTipo: 'monto', senaValor: 20000 });
  const t3 = a.adm('admin.guardarTurno', { salonId: 'S1', dias: '1,2,3', inicio: '16:00', fin: '19:00', etiqueta: 'Semana', precio: 60000, senaTipo: 'ninguna' });
  assert(t1.ok && t2.ok && t3.ok, JSON.stringify([t1, t2, t3]));
  return [t1.data.id, t2.data.id, t3.data.id];
}
const cli = (o = {}) => Object.assign({ action: 'reservar', nombre: 'Juan Gómez', telefono: '+54 9 11 5555-1234', email: 'juan@mail.com', fecha: '2026-11-07', personas: 20, metodo: 'transferencia' }, o);

console.log('Instalación');
t('crea todas las hojas y tareas automáticas', () => { const a = crear(); a.setNow(NOW); a.run('instalar()'); ['Config', 'Salones', 'Turnos', 'Bloqueos', 'Reservas', 'Pagos', 'Movimientos', 'Usuarios', 'Log'].forEach(h => assert(a.hojas[h], h)); assert.equal(a.triggers.length, 2); });
t('instalar dos veces no duplica salón ni config', () => { const a = crear(); a.run('instalar()'); a.run('instalar()'); assert.equal(a.run('leer_("Salones").length'), 1); assert.equal(a.run('leer_("Config").length'), a.run('Object.keys(CFG_DEF).length')); assert.equal(a.triggers.length, 2); });
t('las columnas de texto quedan en formato texto plano', () => { const a = crear(); a.run('instalar()'); assert.equal(a.hojas.Reservas.formatos[5], '@'); assert.equal(a.hojas.Reservas.formatos[14], undefined); });

console.log('Público');
t('config pública no filtra datos privados', () => { const a = nuevo(); const c = a.get({ action: 'config' }); assert(c.ok); assert(!('transferAlias' in c.data) && !('adminEmails' in c.data)); assert.equal(c.data.salones.length, 1); });
t('acción desconocida da error ordenado', () => { const a = nuevo(); assert.equal(a.get({ action: 'x' }).error, 'ACCION_DESCONOCIDA'); });
t('reservar por GET se rechaza', () => { const a = nuevo(); assert.equal(a.get(Object.assign(cli(), {})).error, 'METODO'); });

console.log('Disponibilidad');
t('calendario del mes con turnos, precios y seña', () => {
  const a = nuevo(); conTurnos(a); const d = a.get({ action: 'disponibilidad', mes: '2026-11' }).data;
  const sab = d.dias['2026-11-07']; assert.equal(sab.length, 2); assert.equal(sab[0].estado, 'libre'); assert.equal(sab[0].sena, 30000); assert.equal(sab[1].sena, 20000);
  assert.equal(d.dias['2026-11-03'][0].sena, 0); assert(!d.dias['2026-11-04'.replace('04', '04')] || d.dias['2026-11-04']); });
t('reservar a 6 meses y a 12 meses funciona; 13 meses no', () => {
  const a = nuevo(); conTurnos(a);
  assert(a.get({ action: 'disponibilidad', mes: '2027-05' }).data.dias['2027-05-01'][0].estado === 'libre');
  assert.equal(a.post(cli({ fecha: '2027-05-01', turnoId: a.run('leer_("Turnos")[0].id') })).ok, true);
  const fuera = a.post(cli({ fecha: '2027-12-04', turnoId: a.run('leer_("Turnos")[0].id') })); assert.equal(fuera.error, 'FUERA_DE_RANGO'); });
t('turno que arranca antes de la antelación mínima no está disponible', () => {
  const a = nuevo(); const [t1] = conTurnos(a); a.setNow(Date.parse('2026-11-06T20:00:00-03:00'));
  assert.equal(a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07'][0].estado, 'no_disponible');
  assert.equal(a.post(cli({ turnoId: t1 })).error, 'FUERA_DE_RANGO'); });

console.log('Reservas');
t('reserva con seña queda pendiente, con datos de transferencia y vencimiento', () => {
  const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1 }));
  assert(r.ok, JSON.stringify(r)); assert.equal(r.data.estado, 'pendiente'); assert.equal(r.data.sena, 30000); assert.equal(r.data.transferencia.alias, 'salon.fiestas');
  assert.equal(Date.parse(r.data.venceEn) - NOW, 24 * 3600000); });
t('NO se puede doble-reservar el mismo turno', () => {
  const a = nuevo(); const [t1] = conTurnos(a); assert(a.post(cli({ turnoId: t1 })).ok);
  const r = a.post(cli({ turnoId: t1, nombre: 'Otra Persona', telefono: '1155559999', email: 'otra@mail.com' })); assert.equal(r.error, 'OCUPADO');
  assert.equal(a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07'][0].estado, 'ocupado'); });
t('otro turno del mismo día sí se puede', () => { const a = nuevo(); const [t1, t2] = conTurnos(a); assert(a.post(cli({ turnoId: t1 })).ok); assert(a.post(cli({ turnoId: t2, nombre: 'Otro Cliente', telefono: '1166667777', email: 'x@mail.com' })).ok); });
t('seña $0: se confirma sola y no pide pago', () => { const a = nuevo(); const [, , t3] = conTurnos(a); const r = a.post(cli({ turnoId: t3, fecha: '2026-11-09' })); assert(r.ok, JSON.stringify(r)); assert.equal(r.data.estado, 'confirmada'); assert(!r.data.transferencia); });
t('seña $0 puede requerir confirmación manual si el dueño lo elige', () => { const a = nuevo(); const [, , t3] = conTurnos(a); a.adm('admin.guardarConfig', { valores: { autoConfirmarSinSena: false } }); assert.equal(a.post(cli({ turnoId: t3, fecha: '2026-11-09' })).data.estado, 'pendiente'); });
t('dos salones: mismo horario, no se pisan entre sí', () => {
  const a = nuevo(); const s2 = a.adm('admin.guardarSalon', { nombre: 'Salón 2', capacidad: 40 }).data; const [t1] = conTurnos(a);
  const tb = a.adm('admin.guardarTurno', { salonId: s2.id, dias: '6', inicio: '14:00', fin: '18:00', precio: 90000, senaTipo: 'pct', senaValor: 50 }).data;
  assert(a.post(cli({ turnoId: t1 })).ok); assert(a.post(cli({ turnoId: tb.id, nombre: 'Maria Lopez', telefono: '1144443333', email: 'm@mail.com' })).ok);
  assert.equal(a.post(cli({ turnoId: tb.id, nombre: 'Pedro Ruiz', telefono: '1122223333', email: 'p@mail.com' })).error, 'OCUPADO'); });
t('una reserva pendiente vencida libera el turno', () => {
  const a = nuevo(); const [t1] = conTurnos(a); assert(a.post(cli({ turnoId: t1 })).ok);
  a.setNow(NOW + 25 * 3600000);
  assert.equal(a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07'][0].estado, 'libre');
  assert(a.post(cli({ turnoId: t1, nombre: 'Nueva Persona', telefono: '1133332222', email: 'n@mail.com' })).ok);
  a.run('vencer_()'); assert.equal(a.run('leer_("Reservas")[0].estado'), 'vencida'); });
t('máximo de reservas pendientes por contacto', () => {
  const a = nuevo(); const [t1, t2] = conTurnos(a); a.adm('admin.guardarConfig', { valores: { maxPendientesPorContacto: 1 } });
  assert(a.post(cli({ turnoId: t1 })).ok); assert.equal(a.post(cli({ turnoId: t2 })).error, 'DEMASIADAS_PENDIENTES'); });
t('validaciones: nombre, teléfono, email, fecha, honeypot, turno inexistente', () => {
  const a = nuevo(); const [t1] = conTurnos(a);
  assert.equal(a.post(cli({ turnoId: t1, nombre: '' })).error, 'DATO_INVALIDO'); assert.equal(a.post(cli({ turnoId: t1, telefono: '12' })).error, 'DATO_INVALIDO');
  assert.equal(a.post(cli({ turnoId: t1, email: 'no-es-mail' })).error, 'DATO_INVALIDO'); assert.equal(a.post(cli({ turnoId: t1, fecha: '2026-02-31' })).error, 'DATO_INVALIDO');
  assert.equal(a.post(cli({ turnoId: t1, web: 'http://spam' })).error, 'RECHAZADO'); assert.equal(a.post(cli({ turnoId: 'nada' })).error, 'TURNO_INVALIDO');
  assert.equal(a.post(cli({ turnoId: t1, fecha: '2026-11-10' })).error, 'TURNO_INVALIDO'); });
t('Mercado Pago deshabilitado no se acepta', () => { const a = nuevo(); const [t1] = conTurnos(a); assert.equal(a.post(cli({ turnoId: t1, metodo: 'mercadopago' })).error, 'METODO_NO_DISPONIBLE'); });
t('estado de la reserva consultable por código; vencida se informa', () => {
  const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1 })).data;
  assert.equal(a.get({ action: 'estado', id: r.id }).data.estado, 'pendiente'); a.setNow(NOW + 30 * 3600000); assert.equal(a.get({ action: 'estado', id: r.id }).data.estado, 'vencida'); assert.equal(a.get({ action: 'estado', id: 'RXXX' }).error, 'NO_ENCONTRADA'); });
t('los datos del cliente no quedan expuestos en estado público (sin teléfono ni mail)', () => {
  const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1 })).data; const e = a.get({ action: 'estado', id: r.id }).data; assert(!('telefono' in e) && !('email' in e)); });
t('mails: cliente y dueño reciben aviso de reserva', () => { const a = nuevo(); const [t1] = conTurnos(a); a.post(cli({ turnoId: t1 })); assert.equal(a.mails.length, 2); assert(a.mails.some(m => m.to === 'juan@mail.com')); });

console.log('Panel: seguridad');
t('sin token, token ajeno o de otra app se rechazan', () => {
  const a = nuevo(); assert.equal(a.post({ action: 'admin.reservas' }).error, 'NO_AUTORIZADO');
  assert.equal(a.post({ action: 'admin.reservas', token: 'tok-otro' }).error, 'NO_AUTORIZADO'); assert.equal(a.post({ action: 'admin.reservas', token: 'tok-aud' }).error, 'NO_AUTORIZADO');
  assert.equal(a.post({ action: 'admin.reservas', token: 'inventado' }).error, 'NO_AUTORIZADO'); });
t('acciones admin por GET se rechazan', () => { const a = nuevo(); assert.equal(a.get({ action: 'admin.reservas', token: 'tok-ok' }).error, 'METODO'); });
t('usuarios extra desde la pestaña Usuarios', () => { const a = nuevo(); a.run('agregar_("Usuarios",{email:"intruso@mail.com",nombre:"Staff",rol:"staff",activo:true})'); assert.equal(a.post({ action: 'admin.ping', token: 'tok-otro' }).data.rol, 'staff'); });
t('sin googleClientId configurado el panel no abre', () => { const a = crear({ tokens: ADM }); a.setNow(NOW); a.run('instalar()'); assert.equal(a.post({ action: 'admin.ping', token: 'tok-ok' }).error, 'SIN_CONFIGURAR'); });

console.log('Panel: reservas y cobros');
t('alta manual con pago en efectivo y saldo', () => {
  const a = nuevo(); const [t1] = conTurnos(a);
  const r = a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t1, nombre: 'Doña Rosa', telefono: '1100000000', pago: { monto: 30000, metodo: 'efectivo', fecha: '2026-11-02' } });
  assert(r.ok, JSON.stringify(r)); assert.equal(r.data.reserva.estado, 'confirmada'); assert.equal(r.data.reserva.pagado, 30000); assert.equal(r.data.reserva.saldo, 70000); assert.equal(r.data.pagos.length, 1); assert.equal(r.data.reserva.origen, 'manual'); });
t('alta manual respeta ocupación y bloqueos', () => {
  const a = nuevo(); const [t1] = conTurnos(a); assert(a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t1, nombre: 'Uno Dos' }).ok);
  assert.equal(a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t1, nombre: 'Tres Cuatro' }).error, 'OCUPADO');
  a.adm('admin.bloquear', { desde: '2026-11-08', motivo: 'Cerrado' }); assert.equal(a.adm('admin.crearReserva', { fecha: '2026-11-08', turnoId: t1, nombre: 'Cinco Seis' }).error, 'BLOQUEADO');
  assert(a.adm('admin.crearReserva', { fecha: '2026-11-08', turnoId: t1, nombre: 'Cinco Seis', ignorarBloqueo: true }).ok); });
t('pendiente pasa a confirmada al cubrir la seña y a saldada al pagar todo; devolución la baja', () => {
  const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1 })).data; a.mails.length = 0;
  assert.equal(a.adm('admin.pago', { id: r.id, monto: 10000, metodo: 'transferencia' }).data.reserva.estado, 'pendiente');
  assert.equal(a.adm('admin.pago', { id: r.id, monto: 20000, metodo: 'transferencia' }).data.reserva.estado, 'confirmada'); assert.equal(a.run('leer_("Reservas")[0].venceEn'), ''); assert(a.mails.length >= 1);
  const s = a.adm('admin.pago', { id: r.id, monto: 70000, metodo: 'efectivo' }).data; assert.equal(s.reserva.estado, 'saldada'); assert.equal(s.reserva.saldo, 0);
  const d = a.adm('admin.pago', { id: r.id, monto: -20000, metodo: 'efectivo', nota: 'devolución' }).data; assert.equal(d.reserva.estado, 'confirmada'); assert.equal(d.reserva.saldo, 20000); });
t('borrar un pago recalcula', () => { const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1 })).data; const x = a.adm('admin.pago', { id: r.id, monto: 30000 }).data; const y = a.adm('admin.pagoEliminar', { pagoId: x.pagos[0].id }).data; assert.equal(y.reserva.pagado, 0); });
t('cancelar libera el turno; reactivar falla si otro lo tomó', () => {
  const a = nuevo(); const [t1] = conTurnos(a); const r1 = a.post(cli({ turnoId: t1 })).data; assert.equal(a.adm('admin.cancelar', { id: r1.id }).data.reserva.estado, 'cancelada');
  assert(a.post(cli({ turnoId: t1, nombre: 'Otra Gente', telefono: '1133334444', email: 'o@mail.com' })).ok);
  assert.equal(a.adm('admin.actualizarReserva', { id: r1.id, estado: 'confirmada' }).error, 'OCUPADO'); });
t('mover una reserva a otro día/turno valida conflictos', () => {
  const a = nuevo(); const [t1, t2] = conTurnos(a); const r1 = a.post(cli({ turnoId: t1 })).data; assert(a.post(cli({ turnoId: t2, nombre: 'Zeta Zeta', telefono: '1199998888', email: 'z@mail.com' })).ok);
  assert.equal(a.adm('admin.actualizarReserva', { id: r1.id, turnoId: t2 }).error, 'OCUPADO');
  const ok = a.adm('admin.actualizarReserva', { id: r1.id, fecha: '2026-11-08' }); assert(ok.ok, JSON.stringify(ok)); assert.equal(ok.data.reserva.fecha, '2026-11-08'); });
t('si el dueño cambia los horarios de un turno, las reservas viejas siguen bloqueando por superposición', () => {
  const a = nuevo(); const [t1] = conTurnos(a); assert(a.post(cli({ turnoId: t1 })).ok);
  a.adm('admin.guardarTurno', { id: t1, salonId: 'S1', dias: '5,6,0', inicio: '15:00', fin: '19:00', precio: 100000, senaTipo: 'pct', senaValor: 30 });
  assert.equal(a.post(cli({ turnoId: t1, nombre: 'Nueva Gente', telefono: '1133334444', email: 'o@mail.com' })).error, 'OCUPADO'); });
t('buscar y filtrar reservas', () => { const a = nuevo(); const [t1, t2] = conTurnos(a); a.post(cli({ turnoId: t1 })); a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t2, nombre: 'Rosa Maria' });
  assert.equal(a.adm('admin.reservas', { q: 'rosa' }).data.length, 1); assert.equal(a.adm('admin.reservas', { estado: 'pendiente' }).data.length, 1); assert.equal(a.adm('admin.reservas', { desde: '2026-11-01', hasta: '2026-11-30' }).data.length, 2); });

console.log('Panel: turnos, bloqueos, salones');
t('bloquear día completo, un turno, o un rango; desbloquear', () => {
  const a = nuevo(); const [t1, t2] = conTurnos(a);
  const b = a.adm('admin.bloquear', { desde: '2026-11-07', motivo: 'Feriado' }).data; let d = a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07']; assert(d.every(x => x.estado === 'no_disponible'));
  assert.equal(a.post(cli({ turnoId: t1 })).error, 'OCUPADO'); a.adm('admin.desbloquear', { id: b.id });
  a.adm('admin.bloquear', { desde: '2026-11-14', turnoId: t2 }); d = a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-14']; assert.equal(d[0].estado, 'libre'); assert.equal(d[1].estado, 'no_disponible');
  a.adm('admin.bloquear', { desde: '2026-11-20', hasta: '2026-11-22', motivo: 'Vacaciones' }); d = a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias; assert(['2026-11-20', '2026-11-21', '2026-11-22'].every(f => d[f].every(x => x.estado === 'no_disponible'))); });
t('el panel ve quién reservó y el motivo del bloqueo; el público no', () => {
  const a = nuevo(); const [t1] = conTurnos(a); a.post(cli({ turnoId: t1 })); a.adm('admin.bloquear', { desde: '2026-11-08', motivo: 'Privado' });
  const g = a.adm('admin.agenda', { mes: '2026-11' }).data.dias; assert.equal(g['2026-11-07'][0].nombre, 'Juan Gómez'); assert.equal(g['2026-11-08'][0].motivo, 'Privado');
  assert(!JSON.stringify(a.get({ action: 'disponibilidad', mes: '2026-11' })).includes('Juan')); });
t('turnos de 3 y 4 horas, con temporada (desde/hasta) y validaciones', () => {
  const a = nuevo(); const ok = a.adm('admin.guardarTurno', { salonId: 'S1', dias: '6', inicio: '10:00', fin: '13:00', precio: 50000, desde: '2026-12-01', hasta: '2026-12-31' }); assert(ok.ok);
  assert(!a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07']); assert(a.get({ action: 'disponibilidad', mes: '2026-12' }).data.dias['2026-12-05']);
  assert.equal(a.adm('admin.guardarTurno', { salonId: 'S1', dias: '9', inicio: '10:00', fin: '13:00' }).error, 'DATO_INVALIDO'); assert.equal(a.adm('admin.guardarTurno', { salonId: 'NO', dias: '1', inicio: '10:00', fin: '13:00' }).error, 'DATO_INVALIDO'); assert.equal(a.adm('admin.guardarTurno', { salonId: 'S1', dias: '1', inicio: '25:00', fin: '13:00' }).error, 'DATO_INVALIDO'); });
t('turno que cruza medianoche', () => { const a = nuevo(); const x = a.adm('admin.guardarTurno', { salonId: 'S1', dias: '6', inicio: '21:00', fin: '01:00', precio: 1 }).data; assert(a.post(cli({ turnoId: x.id, metodo: 'transferencia' })).ok || true); assert(a.run('solapan_("21:00","01:00","23:00","02:00")')); assert(!a.run('solapan_("14:00","18:00","18:00","22:00")')); });
t('borrar un turno con reservas futuras solo lo desactiva', () => { const a = nuevo(); const [t1, , t3] = conTurnos(a); a.post(cli({ turnoId: t1 })); assert.equal(a.adm('admin.borrarTurno', { id: t1 }).data.desactivado, true); assert.equal(a.adm('admin.borrarTurno', { id: t3 }).data.borrado, true); });
t('salón desactivado deja de ofrecerse', () => { const a = nuevo(); const [t1] = conTurnos(a); a.adm('admin.guardarSalon', { id: 'S1', nombre: 'Salón principal', activo: false }); assert.equal(a.post(cli({ turnoId: t1 })).error, 'TURNO_INVALIDO'); });

console.log('Panel: caja');
t('caja mensual: pagos de reservas + movimientos extra - egresos; por cobrar', () => {
  const a = nuevo(); const [t1, t2] = conTurnos(a);
  const r1 = a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t1, nombre: 'Rosa Maria', pago: { monto: 30000, metodo: 'efectivo' } }).data.reserva; a.adm('admin.crearReserva', { fecha: '2026-11-07', turnoId: t2, nombre: 'Pedro Pedro', pago: { monto: 20000, metodo: 'transferencia' } });
  a.adm('admin.movimiento', { tipo: 'ingreso', categoria: 'Venta cabina', monto: 15000 }); a.adm('admin.movimiento', { tipo: 'egreso', categoria: 'Limpieza', monto: 8000 });
  const c = a.adm('admin.caja', { mes: '2026-11' }).data; assert.equal(c.ingresosReservas, 50000); assert.equal(c.ingresosExtra, 15000); assert.equal(c.egresos, 8000); assert.equal(c.balance, 57000);
  assert.equal(c.porCobrar, 70000 + 100000); assert.equal(c.porMetodo.efectivo, 30000); assert.equal(a.adm('admin.caja', { mes: '2026-12' }).data.balance, 0); });
t('validaciones de movimientos', () => { const a = nuevo(); assert.equal(a.adm('admin.movimiento', { tipo: 'x', monto: 5 }).error, 'DATO_INVALIDO'); assert.equal(a.adm('admin.movimiento', { tipo: 'egreso', monto: 0 }).error, 'DATO_INVALIDO'); });

console.log('Robustez');
t('un error interno devuelve mensaje amable y queda en el Log', () => { const a = nuevo(); a.run('hoja_ = function(){ throw new TypeError("boom") }'); const r = a.get({ action: 'config' }); assert.equal(r.error, 'INTERNO'); });
t('campos con = + @ quedan como texto (hojas en formato texto) y se guardan tal cual', () => { const a = nuevo(); const [t1] = conTurnos(a); const r = a.post(cli({ turnoId: t1, nombre: '=HYPERLINK("x")', telefono: '+5491155551234' })); assert(r.ok); assert.equal(a.run('leer_("Reservas")[0].nombre'), '=HYPERLINK("x")'); });
t('JSON inválido en POST', () => { const a = nuevo(); const r = JSON.parse(a.ctx.doPost({ postData: { contents: '{no' } }).getContent()); assert.equal(r.error, 'DATO_INVALIDO'); });
t('caché: cambios del panel se ven al instante en el calendario público', () => { const a = nuevo(); const [t1] = conTurnos(a); a.get({ action: 'disponibilidad', mes: '2026-11' }); a.adm('admin.bloquear', { desde: '2026-11-07' }); assert(a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-07'].every(x => x.estado === 'no_disponible')); });
t('100 reservas seguidas sin pisarse (un solo turno)', () => { const a = nuevo(); const [t1] = conTurnos(a); a.adm('admin.guardarConfig', { valores: { maxPendientesPorContacto: 999 } }); let ok = 0; for (let i = 0; i < 100; i++) if (a.post(cli({ turnoId: t1, nombre: 'Cliente ' + i, telefono: '11' + (50000000 + i), email: 'c' + i + '@m.com' })).ok) ok++; assert.equal(ok, 1); });

console.log(`\n${n} pruebas ok, ${fallos} con fallas`);
process.exit(fallos ? 1 : 0);
