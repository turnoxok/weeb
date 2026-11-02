const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
(async () => {
  const { srv, a } = await iniciar('reservar', 8783);
  const b = await chromium.launch({ args: ['--no-sandbox'] }), p = await (await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' })).newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); });
  const ok = n => console.log('  ok  ' + n), shot = async n => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  await p.goto('http://localhost:8783/'); await p.waitForSelector('.cal button.libre'); assert.equal(await p.title(), 'Reservar · Lemadavami'); await shot('r1-calendario'); ok('calendario con días disponibles y datos del salón');
  assert((await p.locator('a:has-text("WhatsApp")').getAttribute('href')).includes('5491155551234')); assert(await p.locator('a:has-text("Cómo llegar")').count()); ok('botones WhatsApp y cómo llegar');
  await p.click('.cal button[aria-label^="sábado 7 de noviembre"]'); await p.waitForSelector('.slot'); assert.equal(await p.locator('.slot').count(), 2); await shot('r2-horarios'); ok('muestra horarios con precio y seña');
  await p.click('.slot:has-text("14:00")'); await p.waitForSelector('input[name=nombre]');
  await p.fill('input[name=nombre]', 'Juan Gómez'); await p.fill('input[name=telefono]', '1155551234'); await p.fill('input[name=email]', 'juan@mail.com'); await p.fill('input[name=personas]', '18'); await shot('r3-formulario');
  await p.click('#go'); await p.waitForSelector('text=Casi listo'); await shot('r4-pendiente'); assert((await p.locator('body').innerText()).includes('lemadavami.fiestas')); assert((await p.locator('body').innerText()).includes('$30.000')); ok('reserva con seña: muestra los datos de transferencia');
  const url = p.url(); assert(url.includes('?reserva=R')); ok('queda un link propio de la reserva');
  assert.equal(a.run('leer_("Reservas")[0].estado'), 'pendiente'); assert.equal(a.mails.length, 2);
  // el dueño confirma el pago → la página lo refleja
  a.setNow(Date.now()); const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }); a.post({ action: 'admin.pago', token: lg.data.token, id: a.run('leer_("Reservas")[0].id'), monto: 30000, metodo: 'transferencia' });
  await p.reload(); await p.waitForSelector('text=Reserva confirmada'); await shot('r5-confirmada'); ok('al registrar el pago, el link muestra "Reserva confirmada"');
  // el horario ya no está disponible para otro
  await p.goto('http://localhost:8783/'); await p.waitForSelector('.cal button.libre'); await p.click('.cal button[aria-label^="sábado 7 de noviembre"]'); await p.waitForSelector('.slot'); assert.equal(await p.locator('.slot').count(), 2); assert.equal(await p.locator('button.slot').count(), 1); assert((await p.locator('.slot.off').innerText()).includes('No disponible')); await shot('r5b-nodisp'); ok('el turno reservado aparece como "No disponible"');
  assert.equal(await p.locator('a.back').getAttribute('href'), '/volver.html'); ok('hay botón para volver a la web');
  // sin seña: turno de semana
  await p.click('.cal button[aria-label^="lunes 9 de noviembre"]'); await p.waitForSelector('.slot:has-text("Sin seña")'); await p.click('.slot'); await p.fill('input[name=nombre]', 'María López'); await p.fill('input[name=telefono]', '1166667777'); await p.click('#go'); await p.waitForSelector('text=Reserva confirmada'); ok('turno sin seña: se confirma al instante');
  // carrera: otro cliente ocupa el turno mientras completo el formulario
  await p.goto('http://localhost:8783/'); await p.waitForSelector('.cal button.libre'); await p.click('.cal button[aria-label^="domingo 8 de noviembre"]'); await p.waitForSelector('.slot'); await p.click('.slot:has-text("19:00")'); await p.fill('input[name=nombre]', 'Tardón Pérez'); await p.fill('input[name=telefono]', '1144443333');
  const tid = a.run('leer_("Turnos").filter(t=>t.inicio=="19:00")[0].id'); a.post({ action: 'reservar', turnoId: tid, fecha: '2026-11-08', nombre: 'Ganador Veloz', telefono: '1133332222', email: '', metodo: 'transferencia' });
  await p.click('#go'); await p.waitForSelector('text=se acaba de ocupar'); await shot('r6-ocupado'); ok('si alguien gana el turno, avisa y vuelve al calendario');
  // reserva inexistente y escritorio
  await p.goto('http://localhost:8783/?reserva=RNOEXISTE'); await p.waitForSelector('.err'); ok('código inexistente da un mensaje claro');
  assert.equal(errores.length, 0, errores.join('\n')); ok('sin errores en la consola'); await b.close(); srv.close(); console.log('\nReservar OK');
})().catch(e => { console.error('FALLA', e.message); process.exit(1); });
