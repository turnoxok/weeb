// Encargada: la dueña le crea el acceso desde Ajustes; ella ve solo cumples confirmados que vienen, sin plata; marca listo y anota. Navegador real contra el backend verdadero (simulado).
const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/enc';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, a } = await iniciar('panel', 8786);
  const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }), adm = (ac, p) => a.post(Object.assign({ action: ac, token: lg.data.token }, p));
  const turnos = JSON.parse(a.run('JSON.stringify(leer_("Turnos").map(function(t){return t.id}))'));
  const mk = (turnoId, nombre) => { const r = a.post({ action: 'reservar', nombre, telefono: '+54 9 299 555-1234', email: 'x@mail.com', fecha: '2026-11-07', personas: 25, metodo: 'transferencia', turnoId }); assert(r.ok, JSON.stringify(r)); return r.data; };
  const pend = mk(turnos[0], 'Pendiente Pérez'), conf = mk(turnos[1], 'Ana Confirmada'); assert(adm('admin.actualizarReserva', { id: conf.id, estado: 'confirmada' }).ok);
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = n => console.log('  ok  ' + n), shot = async (pg, n) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  const entrar = async (pg, mail, clave) => { await pg.goto('http://localhost:8786/'); await pg.waitForSelector('form'); await pg.fill('input[name=email]', mail); await pg.fill('input[name=clave]', clave); await pg.click('button:has-text("Entrar")'); };
  // 1) la dueña crea el acceso desde Ajustes
  await entrar(p, 'dueno@mail.com', 'clave-segura-123'); await p.waitForSelector('.tabs'); await p.click('.tabs button:has-text("Ajustes")'); await p.waitForSelector('button:has-text("Crear acceso para la encargada")'); await shot(p, 'e1-ajustes');
  await p.click('button:has-text("Crear acceso para la encargada")'); await p.waitForSelector('.sheet input[name=clave]'); const clave = await p.inputValue('.sheet input[name=clave]'); assert(clave.length >= 8, 'clave generada'); ok('el panel propone una clave');
  await p.fill('.sheet input[name=nombre]', 'Lucía'); await p.fill('.sheet input[name=email]', 'lucia@mail.com'); await shot(p, 'e2-form'); await p.click('.sheet button.block:has-text("Crear acceso")'); await p.waitForSelector('.sheet:has-text("Acceso listo"), .toast.err', { timeout: 8000 }); if (await p.locator('.toast.err').count()) throw new Error('toast: ' + await p.locator('.toast.err').innerText()); await shot(p, 'e3-listo');
  assert(await p.locator('.sheet:has-text("lucia@mail.com")').count() && await p.locator('.sheet:has-text("' + clave + '")').count() && await p.locator('.sheet a:has-text("WhatsApp")').count()); ok('muestra mail y clave para pasárselos (copiar / WhatsApp)');
  await p.click('.sheet-head .icon'); await p.waitForSelector('.item.static:has-text("lucia@mail.com")'); ok('queda listada con Cambiar clave y Quitar acceso');
  // 2) la encargada entra
  const q = await ctx.newPage(); q.on('dialog', d => d.accept()); q.on('pageerror', e => errores.push(e.message)); await q.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await entrar(q, 'lucia@mail.com', clave); await q.waitForSelector('.enc'); await shot(q, 'e4-encargada');
  assert.equal(await q.locator('.tabs').count(), 0); assert.equal(await q.locator('.enc').count(), 1); assert(await q.locator('.enc:has-text("Ana Confirmada")').count()); assert.equal(await q.locator('text=Pendiente Pérez').count(), 0); ok('solo ve el cumple confirmado y no hay pestañas del panel');
  const txt = await q.locator('main').innerText(); assert(!/\$\s?\d/.test(txt), 'hay precios: ' + txt); assert(!/555-1234|@mail/.test(txt), 'hay contacto'); ok('sin precios ni teléfonos ni mails');
  await q.click('.enc button.listo'); await q.waitForSelector('.enc button.listo.on'); assert(await q.locator('.enc .chip:has-text("Listo")').isVisible()); assert.equal(adm('admin.reserva', { id: conf.id }).data.reserva.listo, true); ok('marcar listo se guarda');
  await q.fill('.enc textarea[name=texto]', 'Los globos están en la bodega'); await q.click('.enc .nota-nueva button'); await q.waitForSelector('.enc .nota:has-text("globos")');
  await q.click('.enc .nota [aria-label="Editar anotación"]'); await q.fill('.enc .nota textarea', 'Los globos están en el depósito'); await q.click('.enc .nota button:has-text("Guardar")'); await q.waitForSelector('.enc .nota:has-text("depósito")'); await shot(q, 'e5-notas');
  assert(await q.locator('.enc .nota:has-text("editada")').count()); ok('anotar y editar anotaciones');
  await q.click('.seg button:has-text("Por preparar")'); await q.waitForSelector('.empty:has-text("Todo listo"), .empty:has-text("nada por preparar")'); ok('lo listo sale de «Por preparar»');
  // 3) la dueña ve lo que anotó la encargada y deja otra; la encargada la ve
  await p.click('.tabs button:has-text("Reservas")'); await p.waitForSelector('.list .item:has-text("Ana Confirmada")'); assert(await p.locator('.list .item:has-text("Ana Confirmada"):has-text("Listo")').count()); ok('en Reservas la dueña ve ✓ Listo');
  await p.click('.list .item:has-text("Ana Confirmada")'); await p.waitForSelector('.notas .nota:has-text("depósito")'); await shot(p, 'e6-dueña'); await p.fill('.sheet textarea[name=texto]', 'Recordar la torta sin maní'); await p.click('.sheet .nota-nueva button'); await p.waitForSelector('.sheet .nota:has-text("sin maní")'); ok('la dueña ve las anotaciones de la encargada y deja la suya');
  await q.click('button:has-text("Actualizar")'); await q.waitForSelector('.seg'); await q.click('.seg button:has-text("Todos")'); await q.waitForSelector('.enc .nota:has-text("sin maní")'); await q.click('.enc .nota:has-text("sin maní") [aria-label="Borrar anotación"]'); await q.waitForFunction(() => !document.body.innerText.includes('sin maní')); ok('la encargada ve la nota de la dueña y puede borrarla');
  // 4) quitar acceso
  await p.click('.sheet-head .icon'); await p.click('.tabs button:has-text("Ajustes")'); await p.waitForSelector('button:has-text("Quitar acceso")'); await p.click('button:has-text("Quitar acceso")'); await p.waitForSelector('button:has-text("Crear acceso para la encargada")');
  await q.click('button:has-text("Actualizar")'); await q.waitForSelector('form'); ok('al quitarle el acceso vuelve a la pantalla de entrada');
  assert.deepEqual(errores, []); await b.close(); srv.close(); console.log('encargada OK');
})().catch(e => { console.error(e); process.exit(1); });
