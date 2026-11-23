// Página pública de hora de juego: lista, reserva, comprobante, aviso emergente. Navegador real contra el backend verdadero (simulado).
const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/ejp';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, a } = await iniciar('juego', 8784);
  const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' });
  a.post({ action: 'admin.guardarConfig', token: lg.data.token, valores: { juegoActivo: true, juegoCupo: 6, juegoPrecio: 20000, transferAlias: 'quokka.pelotero', transferTitular: 'Constanza' } });
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = n => console.log('  ok  ' + n), shot = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  await p.goto('http://localhost:8784/pagina-ejemplo.html'); await p.waitForSelector('.jg-card'); await shot('p1-lista');
  assert((await p.locator('.jg-card').count()) >= 3); assert(await p.locator('text=Quedan 6 lugares').count()); ok('lista los horarios abiertos con cupo y precio');
  await p.waitForSelector('.jg-pop', { timeout: 8000 }); assert((await p.locator('.jg-pop').innerText()).includes('Hora de juego disponible')); await shot('p1b-aviso'); ok('aviso emergente cuando hay hora de juego');
  await p.click('.jg-pop .c'); assert.equal(await p.locator('.jg-pop').count(), 0); ok('el aviso se cierra');
  await p.click('.jg-card:has-text("14:00") .jg-btn'); await p.waitForSelector('.jg-sh form'); await p.fill('input[name=nombre]', 'Marta Díaz'); await p.fill('input[name=telefono]', '2995551234'); await p.fill('input[name=chicos]', '4'); assert((await p.locator('.jg-sh .tot').innerText()).includes('$80.000')); await shot('p2-form');
  await p.fill('input[name=chicos]', '9'); await p.click('.jg-sh .jg-btn'); await p.waitForSelector('.jg-err:has-text("Quedan")'); ok('no deja anotar más chicos que el cupo');
  await p.fill('input[name=chicos]', '4'); await p.click('.jg-sh .jg-btn'); await p.waitForSelector('.jg-sh:has-text("quokka.pelotero")'); await shot('p3-pagar'); assert((await p.locator('.jg-sh').innerText()).includes('$80.000')); ok('al anotar muestra cuánto y a dónde transferir');
  await p.setInputFiles('.jg-sh input[type=file]', { name: 'comp.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') }); await p.waitForSelector('.jg-sh:has-text("Recibimos tu comprobante")'); await shot('p4-comprobante');
  assert.equal(a.run('leer_("JuegoReservas")[0].estado'), 'pendiente'); assert(a.run('!!leer_("JuegoReservas")[0].compId')); ok('sube el comprobante y queda esperando la confirmación');
  const cod = a.run('leer_("JuegoReservas")[0].codigo'); await p.click('.jg-sh .x'); await p.waitForTimeout(500);
  await p.waitForSelector('.jg-card:has-text("Quedan 2 lugares")'); ok('el cupo baja para los demás'); await shot('p5-cupo');
  await p.reload(); await p.waitForSelector('.jg-card'); await p.click('button:has-text("Ver mi reserva")'); await p.waitForSelector('.jg-sh:has-text("' + cod + '")'); ok('Ver mi reserva recuerda el código');
  assert.deepEqual(errores, []); await b.close(); srv.close(); console.log('Juego público OK');
})().catch(e => { console.error(e); process.exit(1); });
