// El script completo de Quokka (Codigo.gs + datos de Quokka) cargado en el simulador.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { crear } = require('./mock');
const R = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(R, 'backend', 'Codigo.gs'), 'utf8') + fs.readFileSync(path.join(R, 'clientes', 'quokka', 'Quokka.gs'), 'utf8');
const a = crear(); a.setNow(Date.parse('2026-11-23T18:00:00-03:00'));
vm.runInContext(fs.readFileSync(path.join(R, 'clientes', 'quokka', 'Quokka.gs'), 'utf8'), a.ctx, { filename: 'Quokka.gs' });
let n = 0; const t = (nombre, f) => { f(); n++; console.log('  ok  ' + nombre); };
t('carga los datos de Quokka', () => { a.run('cargarQuokka_()'); assert.equal(a.run('leer_("Salones").length'), 2); assert.equal(a.run('leer_("Turnos").length'), 2 * 5); assert.equal(a.run('config_().nombre'), 'Quokka Pelotero'); assert.equal(a.run('config_().juegoActivo'), true); });
t('se puede correr de nuevo sin duplicar ni pisar cambios', () => {
  a.run('actualizar_("Config", leer_("Config").filter(r => r.clave === "juegoPrecio")[0]._row, { valor: 25000 })'); a.run('cargarQuokka_()');
  assert.equal(a.run('leer_("Salones").length'), 2); assert.equal(a.run('leer_("Turnos").length'), 10); assert.equal(a.run('config_().juegoPrecio'), 25000);
});
t('lunes a viernes 2 horarios y fin de semana 3, por salón', () => {
  const ts = a.run('leer_("Turnos").filter(t => t.salonId === "S2")'); assert.equal(ts.filter(x => x.dias === '1,2,3,4,5').length, 2); assert.equal(ts.filter(x => x.dias === '6,0').length, 3);
  const d = a.get({ action: 'disponibilidad', mes: '2026-12' }).data.dias; assert.equal(d['2026-12-05'].length, 6); assert.equal(d['2026-12-02'].length, 4);   // sábado: 3+3, miércoles: 2+2
});
t('hora de juego: cerca de la fecha aparece en los dos salones', () => { const j = a.get({ action: 'juego' }).data; assert(j.activo); assert(j.slots.length > 0); assert(new Set(j.slots.map(s => s.salon)).size === 2); assert.equal(j.slots[0].cupo, 20); });
t('lo que paga Quokka a tuweeb queda cargado', () => { assert.equal(a.run('leer_("Servicio").filter(r => r.clave === "precioTotal")[0].valor'), 890000); });
t('los cumples sin precio no se confirman solos', () => {
  const lg = (a.run('definirUsuario_("c@q.com","clave-segura-123","Constanza","admin")'), a.post({ action: 'login', email: 'c@q.com', clave: 'clave-segura-123' })); assert(lg.ok);
  const id = a.run('leer_("Turnos")[0].id'), r = a.post({ action: 'reservar', turnoId: id, fecha: '2026-12-09', nombre: 'Ana Ruiz', telefono: '2995550000', personas: 10, metodo: 'transferencia' }); assert(r.ok, JSON.stringify(r)); assert.equal(r.data.estado, 'pendiente');
});
console.log(`\n${n} pruebas ok`);
