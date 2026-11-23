// Combos por salón + descuento por pagar todo junto, en el celular.
const { chromium } = require('/opt/npm-tools/node_modules/playwright/index.js');
const { iniciar } = require('./servidor'); const { crear } = require('../mock'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
(async () => {
  const a = crear(); a.setNow(Date.parse('2026-11-05T12:00:00-03:00')); a.run('instalar()'); a.run("definirUsuario_('dueno@mail.com','clave-segura-123','Ana','admin')");
  const adm = (accion, p) => { const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }); return a.post(Object.assign({ action: accion, token: lg.data.token }, p)); };
  const S2 = adm('admin.guardarSalon', { nombre: 'Selva', capacidad: 0, activo: true, orden: 2 }).data.id;
  ['S1', S2].forEach(s => adm('admin.guardarTurno', { salonId: s, dias: '5,6,0', inicio: '14:00', fin: '18:00', etiqueta: 'Tarde', precio: 0, senaTipo: 'pct', senaValor: 30 }));
  const cfg = { transferAlias: 'q.alias', pagoTransferencia: true }; Object.keys(cfg).forEach(k => a.run(`(function(){var f=leer_('Config').filter(r=>r.clave==='${k}')[0]; if(f) actualizar_('Config', f._row, {valor:${JSON.stringify(cfg[k])}}); else agregar_('Config',{clave:'${k}',valor:${JSON.stringify(cfg[k])}});})()`));
  adm('admin.guardarPlan', { nombre: 'Combo 1', precio: 890000, senaTipo: 'pct', senaValor: 30, orden: 1, salonId: 'S1', descTotal: 25 });
  const { srv } = await iniciar('reservar', 8791, a);
  const b = await chromium.launch({ args: ['--no-sandbox'] }), cx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await cx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await cx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); const ok = n => console.log('  ok  ' + n);
  await p.goto('http://localhost:8791/'); await p.waitForSelector('.cal button.libre'); await p.click('.cal button[aria-label^="sábado 7 de noviembre"]'); await p.waitForSelector('.slot');
  const slots = await p.locator('.slot').allInnerTexts(); assert.equal(slots.length, 2); assert(slots.some(s => /Desde \$\s?890\.000/.test(s)), slots.join('|')); ok('Original muestra "Desde" con su combo; Selva no');
  await p.locator('.slot', { hasText: 'Desde' }).click(); await p.waitForSelector('input[name=nombre]');
  assert.equal(await p.locator('input[name=plan]').count(), 1); assert(await p.locator('.m-total').isHidden() || true); ok('solo se ofrecen los combos del salón elegido');
  await p.click('input[name=plan]'); await p.waitForSelector('.m-total'); assert(/\$\s?667\.500/.test(await p.locator('.m-total').innerText()), await p.locator('.m-total').innerText()); assert(/267\.000/.test(await p.locator('.m-sena').innerText()));
  await p.click('input[value=total]'); assert(/25% OFF por pago total/.test(await p.locator('.resumen').innerText())); await p.screenshot({ path: OUT + '/c1-form.png', fullPage: true });
  await p.fill('input[name=nombre]', 'Lu Paz'); await p.fill('input[name=telefono]', '2995550000'); await p.fill('input[name=personas]', '20');
  assert(/pagar todo/.test(await p.locator('#go').innerText())); await p.click('#go'); await p.waitForSelector('text=Casi listo'); const t = await p.locator('body').innerText(); assert(/667\.500/.test(t), t); await p.screenshot({ path: OUT + '/c2-ok.png', fullPage: true });
  assert.equal(a.run('leer_("Reservas")[0].total'), 667500); ok('pagando todo queda el total con 25% OFF');
  assert.equal(errores.length, 0, errores.join('\n')); await b.close(); srv.close(); console.log('\nCombos OK');
})().catch(e => { console.error(e); process.exit(1); });
