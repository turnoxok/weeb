// Panel: pestaña Juego (hora de juego) en un navegador real, contra el backend verdadero (simulado).
const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, a } = await iniciar('panel', 8783);
  const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' });
  a.post({ action: 'admin.guardarConfig', token: lg.data.token, valores: { juegoActivo: true, juegoCupo: 10, juegoPrecio: 20000 } });
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = n => console.log('  ok  ' + n), shot = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  await p.goto('http://localhost:8783/'); await p.waitForSelector('form'); await p.fill('input[name=email]', 'dueno@mail.com'); await p.fill('input[name=clave]', 'clave-segura-123'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.cal .day');
  assert(await p.locator('.tabs button:has-text("Juego")').count()); assert((await p.locator('.tabs.tabs7').count()) === 1); ok('con hora de juego activa aparece la pestaña Juego');
  await p.click('.tabs button:has-text("Juego")'); await p.waitForSelector('h3.sec'); await shot('j1-semana');
  assert((await p.locator('.list .item:has-text("0/10")').count()) >= 2); ok('los horarios sin cumple aparecen abiertos solos con su cupo');
  // anotar desde el panel (como si llegara por WhatsApp), con pago y comprobante
  await p.click('button:has-text("+ Anotar")'); await p.waitForSelector('input[name=nombre]'); await p.fill('input[name=fecha]', '2026-11-06'); await p.fill('input[name=nombre]', 'Lucía Paz'); await p.fill('input[name=telefono]', '2995550000'); await p.fill('input[name=chicos]', '3'); await p.fill('input[name=pagado]', '60000');
  await p.setInputFiles('input[name=comp]', { name: 'transf.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') }); await shot('j2-anotar'); await p.click('.sheet button:has-text("Anotar")'); await p.waitForSelector('.toast.ok');
  await p.waitForTimeout(1500); await shot('j3-lista'); await p.waitForSelector('.list .item:has-text("Lucía Paz")'); assert.equal(a.run('leer_("JuegoReservas").length'), 1); ok('anotar por WhatsApp con pago y comprobante');
  // una familia reserva por la web y la dueña confirma el pago
  const r = a.post({ action: 'reservarJuego', nombre: 'Marta Díaz', telefono: '2995551111', chicos: 4, fecha: '2026-11-07', turnoId: a.run('leer_("Turnos")[0].id'), salonId: 'S1' }); assert(r.ok, JSON.stringify(r));
  await p.click('.tabs button:has-text("Reservas")'); await p.click('.tabs button:has-text("Juego")'); await p.waitForSelector('.list .item:has-text("Marta")'); assert(await p.locator('text=esperando que confirmes').count()); ok('avisa cuando hay un pago por confirmar');
  await p.click('.list .item:has-text("Marta")'); await p.waitForSelector('.money'); await shot('j4-detalle'); await p.click('button:has-text("Confirmar pago")'); await p.waitForSelector('.toast.ok'); await p.waitForSelector('.chip.confirmada'); ok('confirmar pago');
  await p.click('.sheet-head .icon'); await p.waitForTimeout(300);
  // cerrar un horario
  await p.click('.list .item:has-text("0/10") >> nth=0'); await p.waitForSelector('button:has-text("Cerrar")'); await p.click('.sheet button:has-text("Cerrar")'); await p.waitForSelector('.toast.ok'); await p.waitForTimeout(500);
  assert((await p.locator('.chip:has-text("Cerrado")').count()) >= 1); ok('cerrar un horario a mano');
  // caja
  await p.click('.tabs button:has-text("Caja")'); await p.waitForSelector('.stats'); const st = await p.locator('.stats').innerText(); assert(st.includes('$140.000') || st.includes('$60.000'), st); await shot('j5-caja'); assert(await p.locator('text=Hora de juego').count() || (await p.locator('.list').innerText()).includes('Lucía')); ok('los cobros de hora de juego entran a la caja');
  // ajustes
  await p.click('.tabs button:has-text("Ajustes")'); await p.waitForSelector('input[name=juegoCupo]'); assert.equal(await p.inputValue('input[name=juegoCupo]'), '10'); ok('ajustes de hora de juego');
  assert.deepEqual(errores, []); await b.close(); srv.close(); console.log('Juego OK');
})().catch(e => { console.error(e); process.exit(1); });
