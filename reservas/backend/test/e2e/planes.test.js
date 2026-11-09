// Planes en la reserva + pestaña "Mi web" del panel, en navegador real (celular).
const { chromium } = require('/opt/npm-tools/node_modules/playwright/index.js');
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv: s1, a } = await iniciar('reservar', 8793); const { srv: s2 } = await iniciar('panel', 8794, a);
  const adm = (accion, p) => { const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }); return a.post(Object.assign({ action: accion, token: lg.data.token }, p)); };
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00'));
  const p = await ctx.newPage(), errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = n => console.log('  ok  ' + n), shot = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  // 1) el dueño carga planes desde el panel
  await p.goto('http://localhost:8794/'); await p.fill('input[name=email]', 'dueno@mail.com'); await p.fill('input[name=clave]', 'clave-segura-123'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.cal .day');
  await p.click('.tabs button:has-text("Turnos")'); await p.waitForSelector('button:has-text("+ Plan")'); await shot('p1-turnos-sin-planes'); ok('Turnos muestra la sección Planes (vacía y explicada)');
  for (const [n, pr] of [['Despegue', 180000], ['Órbita', 260000]]) { await p.click('button:has-text("+ Plan")'); await p.waitForSelector('input[name=nombre]'); await p.fill('input[name=nombre]', n); await p.fill('input[name=precio]', String(pr)); await p.click('button:has-text("Guardar plan")'); await p.waitForSelector('.item:has-text("' + n + '")'); }
  await shot('p2-planes'); assert.equal(adm('admin.planes').data.length, 2); ok('el dueño crea planes desde el panel');
  // 2) reserva manual con plan
  await p.click('.tabs button:has-text("Agenda")'); await p.waitForSelector('.cal .day'); await p.click('.cal .day:has(b:text-is("7"))'); await p.waitForSelector('.sheet'); await p.click('.sheet .item:has-text("14:00") button:has-text("Reservar")'); await p.waitForSelector('select[name=planId] option:nth-child(3)', { state: 'attached' });
  await p.fill('input[name=nombre]', 'Doña Rosa'); await p.fill('input[name=telefono]', '1155559999'); await p.click('button:has-text("Guardar reserva")'); await p.waitForSelector('.toast.err:has-text("plan")'); ok('sin elegir plan avisa');
  await p.selectOption('select[name=planId]', { index: 2 }); assert.equal(await p.inputValue('input[name=total]'), '260000'); assert.equal(await p.inputValue('input[name=sena]'), '78000'); await shot('p3-nueva'); await p.click('button:has-text("Guardar reserva")'); await p.waitForSelector('.sheet:has-text("Órbita")'); ok('reserva manual con plan: precio y seña salen del plan y el detalle muestra el plan');
  // 3) clienta en la web
  const c = await ctx.newPage(); c.on('pageerror', e => errores.push(e.message)); await c.goto('http://localhost:8793/'); await c.waitForSelector('.cal button.libre'); await c.click('.cal button[aria-label^="domingo 8 de noviembre"]'); await c.waitForSelector('.slot:has-text("Elegir")'); assert.equal(await c.locator('.slot:has-text("$")').count(), 0); ok('con planes el horario no muestra un precio suelto');
  await c.click('.slot >> nth=0'); await c.waitForSelector('#planes'); assert.equal(await c.locator('#planes label').count(), 2);
  await c.fill('input[name=nombre]', 'María Gómez'); await c.fill('input[name=telefono]', '1144443333'); await c.click('#go'); await c.waitForTimeout(500); assert(await c.locator('input[name=plan]').count()); assert(!(await c.locator('.big').count())); ok('no deja reservar sin elegir plan');
  await c.click('#planes label:has-text("Despegue")'); await c.waitForSelector('.resumen:has-text("Total $180.000 · Seña $54.000")'); await c.waitForTimeout(400); await c.screenshot({ path: OUT + '/p4-reservar-plan.png', fullPage: true }); ok('al elegir plan se actualiza total y seña');
  await c.click('#go'); await c.waitForSelector('text=Despegue', { timeout: 8000 }).catch(() => {}); const r = a.run('leer_("Reservas").filter(r=>r.nombre=="María Gómez")[0]'); assert.equal(r.plan, 'Despegue'); assert.equal(r.total, 180000); assert.equal(r.sena, 54000); ok('la reserva queda con el plan elegido');
  // 4) Mi web
  await p.mouse.click(195, 8); await p.waitForTimeout(400); await p.click('.tabs button:has-text("Mi web")'); await p.waitForSelector('h2:has-text("Mi sitio web")'); assert(await p.locator('text=$720.000').count()); assert(await p.locator('text=Pendiente de pago').count()); await shot('p5-miweb-pendiente');
  a.run("agregar_('ServicioPagos', { id: 'X1', fecha: '2026-11-05', monto: 120000, nota: 'cuota 1' })"); await p.click('.tabs button:has-text("Agenda")'); await p.click('.tabs button:has-text("Mi web")'); await p.waitForSelector('text=En cuotas'); assert(await p.locator('text=Cuota 2 de 6').count()); assert(await p.locator('text=2027').count()); assert.equal(await p.locator('.sheet input, #vista input, #vista textarea').count(), 0); await shot('p6-miweb-cuotas'); ok('Mi web muestra cuotas, próximo pago y vencimiento, sin campos para editar');
  assert.deepEqual(errores, []); ok('sin errores en la consola'); await b.close(); s1.close(); s2.close(); console.log('Planes OK');
})().catch(e => { console.error('FALLA', e.message); process.exit(1); });
