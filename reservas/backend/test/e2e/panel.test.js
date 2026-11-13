// Prueba de punta a punta del panel en un navegador real, contra el backend verdadero (simulado).
const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, a } = await iniciar('panel', 8781);
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }), _c = await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')), p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = (n) => console.log('  ok  ' + n); const shot = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  await p.goto('http://localhost:8781/'); await p.waitForSelector('form');
  assert.equal(await p.title(), 'Panel · Salón Demo'); await shot('01-login'); ok('muestra login con el nombre del negocio');
  await p.fill('input[name=email]', 'dueno@mail.com'); await p.fill('input[name=clave]', 'mala'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.toast.err'); ok('clave incorrecta muestra error');
  await p.fill('input[name=clave]', 'clave-segura-123'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.cal .day'); await shot('02-agenda'); ok('entra y muestra la agenda');
  // reservar a mano desde el calendario: sábado 7 de nov
  await p.click('.cal .day:has(b:text-is("7"))'); await p.waitForSelector('.sheet'); await shot('03-dia'); assert((await p.locator('.sheet .item').count()) >= 2); ok('el día muestra sus turnos');
  await p.click('.sheet .item:has-text("14:00") button:has-text("Reservar")'); await p.waitForSelector('input[name=nombre]');
  await p.fill('input[name=nombre]', 'Doña Rosa'); await p.fill('input[name=telefono]', '1155559999'); await p.fill('input[name=personas]', '25'); await p.fill('input[name=pagoMonto]', '30000'); await shot('04-nueva');
  await p.click('button:has-text("Guardar reserva")'); await p.waitForSelector('.sheet:has-text("Doña Rosa")'); await p.waitForSelector('.money'); await shot('05-detalle');
  const txt = await p.locator('.money').innerText(); assert(txt.includes('$100.000') && txt.includes('$70.000'), txt); ok('reserva a mano con pago en efectivo: saldo correcto');
  await p.fill('form input[name=monto]', '70000'); await p.click('button:has-text("Registrar pago")'); await p.waitForSelector('.chip.saldada'); ok('registrar el saldo la deja saldada');
  await p.click('.sheet-head .icon'); await p.waitForTimeout(400);
  // el turno quedó ocupado en la API pública
  const disp = await (await fetch('http://localhost:8781/exec?action=disponibilidad&mes=2026-11')).json(); assert.equal(disp.data.dias['2026-11-07'][0].estado, 'ocupado'); ok('el turno quedó ocupado en el calendario público');
  // reservas
  await p.click('.tabs button:has-text("Reservas")'); await p.waitForSelector('.item'); await p.fill('input[type=search]', 'rosa'); assert.equal(await p.locator('.list .item').count(), 1); await shot('06-reservas'); ok('lista y búsqueda de reservas');
  // turnos
  await p.click('.tabs button:has-text("Turnos")'); await p.waitForSelector('.item'); await shot('07-turnos');
  await p.click('button:has-text("+ Bloquear")'); await p.waitForSelector('input[name=desde]'); await p.fill('input[name=desde]', '2026-11-14'); await p.fill('input[name=motivo]', 'Feriado'); await p.click('.sheet button:has-text("Bloquear")'); await p.waitForSelector('.item:has-text("Feriado")'); ok('bloquear un día');
  assert(a.get({ action: 'disponibilidad', mes: '2026-11' }).data.dias['2026-11-14'].every(x => x.estado === 'no_disponible')); ok('el bloqueo se refleja en la web pública');
  // nuevo turno de 3 horas con helper de duración
  await p.click('button:has-text("+ Turno")'); await p.waitForSelector('select[aria-label=Duración]'); await p.fill('input[name=inicio]', '10:00'); await p.selectOption('select[aria-label=Duración]', '3'); assert.equal(await p.inputValue('input[name=fin]'), '13:00'); await shot('08-turno-form'); ok('el selector de duración calcula la hora de fin');
  await p.fill('input[name=precio]', '90000'); await p.click('input[name=senaValor]'); await p.keyboard.press('Control+A'); await p.keyboard.type('45'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  assert.equal(await p.locator('.sheet').count(), 1); assert.equal(await p.inputValue('input[name=senaValor]'), '45'); ok('Enter en un campo no cierra ni envía el formulario a medio completar');
  await p.click('.sheet-head .icon'); await p.waitForTimeout(300);
  // caja
  await p.click('.tabs button:has-text("Caja")'); await p.waitForSelector('.stats'); await p.click('button:has-text("+ Movimiento")'); await p.fill('input[name=monto]', '8000'); await p.fill('input[name=categoria]', 'Limpieza'); await p.click('.sheet button:has-text("Guardar")'); await p.waitForSelector('.item:has-text("Limpieza")');
  const stats = await p.locator('.stats').innerText(); assert(stats.includes('$100.000') && stats.includes('$8.000'), stats); await shot('09-caja'); ok('caja: cobros, egreso y balance');
  // ajustes
  await p.click('.tabs button:has-text("Ajustes")'); await p.waitForSelector('input[name=nombre]'); await p.fill('input[name=nombre]', 'Salón Demo Fiestas'); await p.click('button:has-text("Guardar ajustes")'); await p.waitForSelector('.toast.ok'); await p.waitForTimeout(500);
  assert.equal(a.get({ action: 'config' }).data.nombre, 'Salón Demo Fiestas'); await shot('10-ajustes'); ok('ajustes se guardan');
  // recarga mantiene la sesión; salir
  await p.reload(); await p.waitForSelector('.tabs'); ok('la sesión sigue después de recargar'); await p.click('button[aria-label=Salir]'); await p.waitForSelector('form'); ok('salir');
  // escritorio
  await p.setViewportSize({ width: 1280, height: 800 }); await p.fill('input[name=email]', 'dueno@mail.com'); await p.fill('input[name=clave]', 'clave-segura-123'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.cal .day'); await shot('11-escritorio');
  assert.equal(errores.length, 0, errores.join('\n')); ok('sin errores en la consola'); await b.close(); srv.close(); console.log('\nPanel OK');
})().catch(e => { console.error('FALLA', e.message); process.exit(1); });
