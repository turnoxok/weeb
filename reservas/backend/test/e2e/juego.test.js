// Panel: pestaña «hs de juego» y botón «Habilitar hs de juego» en un turno bloqueado. Navegador real contra el backend verdadero (simulado).
const pkg = require('/opt/npm-tools/node_modules/playwright/index.js'); const { chromium } = pkg;
const { iniciar } = require('./servidor'); const assert = require('assert'); const OUT = process.argv[2] || '/tmp/e2e';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, a } = await iniciar('panel', 8783);
  const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }), adm = (ac, p) => a.post(Object.assign({ action: ac, token: lg.data.token }, p));
  adm('admin.guardarConfig', { valores: { juegoPrecio: 20000 } });   // la parte pública está apagada: se prende sola al habilitar
  adm('admin.bloquear', { desde: '2026-11-07', turnoId: '*', salonId: '*', motivo: 'Mantenimiento' });
  const b = await chromium.launch({ args: ['--no-sandbox'] }), ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR' }); await ctx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text())) errores.push(m.text()); }); p.on('dialog', d => d.accept());
  const ok = n => console.log('  ok  ' + n), shot = async n => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  await p.goto('http://localhost:8783/'); await p.waitForSelector('form'); await p.fill('input[name=email]', 'dueno@mail.com'); await p.fill('input[name=clave]', 'clave-segura-123'); await p.click('button:has-text("Entrar")'); await p.waitForSelector('.cal .day');
  assert.equal(await p.locator('.tabs button:has-text("hs de juego")').count(), 0); ok('sin nada habilitado todavía no hay pestaña');
  // día bloqueado → Habilitar hs de juego
  await p.click('.cal .day:has(b:text-is("7"))'); await p.waitForSelector('.sheet .item.static:has-text("Bloqueado")'); await shot('h1-bloqueado');
  assert(await p.locator('.sheet button:has-text("Habilitar hs de juego")').count() >= 1); assert(await p.locator('.sheet button:has-text("Desbloquear")').count() >= 1); ok('en un turno bloqueado aparece Habilitar hs de juego junto a Desbloquear');
  await p.click('.sheet .item.static >> nth=0 >> button:has-text("Habilitar hs de juego")'); await p.waitForSelector('input[name=cupo]'); await shot('h2-habilitar');
  assert.equal(await p.inputValue('input[name=cupo]'), '10'); assert(await p.locator('text=Cada niño paga $20.000').count()); assert(await p.locator('text=no se ofrece para cumpleaños').count()); ok('mesas 10 por defecto, precio por niño y aviso de cumpleaños');
  await p.fill('input[name=cupo]', '8'); await p.fill('input[name=adultosMax]', '4'); await p.fill('input[name=ninosMax]', '6'); await p.check('input[name^=t_] >> nth=1');
  await p.click('.sheet button:has-text("Habilitar hs de juego") >> nth=-1'); await p.waitForSelector('.toast.ok'); await p.waitForTimeout(600);
  const js = JSON.parse(a.run('JSON.stringify(leer_("Juego"))')); assert.equal(js.length, 2); assert(js.every(x => x.cupo === 8 && x.adultosMax === 4 && x.ninosMax === 6 && x.estado === 'abierto')); assert.equal(a.run('config_().juegoActivo'), true); ok('habilita dos turnos de una vez y prende la parte pública');
  assert.equal(adm('admin.agenda', { mes: '2026-11' }).data.dias['2026-11-07'][0].estado, 'bloqueado'); ok('el turno sigue bloqueado para cumpleaños');
  await p.click('.cal .day:has(b:text-is("7"))'); await p.waitForSelector('.sheet .chip:has-text("mesas")'); await shot('h3-chip'); assert(await p.locator('.sheet button:has-text("Editar hs de juego")').count() >= 1); ok('el turno muestra que ya está habilitado');
  await p.click('.sheet-head .icon'); await p.waitForTimeout(300);
  // pestaña
  await p.reload(); await p.waitForSelector('.cal .day'); assert(await p.locator('.tabs button:has-text("hs de juego")').count()); await p.click('.tabs button:has-text("hs de juego")'); await p.waitForSelector('h3.sec'); await shot('h4-lista');
  assert((await p.locator('.list .item:has-text("0/8 mesas")').count()) >= 2); ok('la pestaña lista los horarios con mesas ocupadas/total');
  // anotar a mano (WhatsApp)
  await p.click('button:has-text("+ Anotar")'); await p.waitForSelector('input[name=nombre]'); await p.fill('input[name=fecha]', '2026-11-07'); await p.fill('input[name=nombre]', 'Lucía Paz'); await p.fill('input[name=telefono]', '2995550000'); await p.fill('input[name=email]', 'lucia@mail.com'); await p.fill('input[name=adultos]', '2'); await p.fill('input[name=chicos]', '3'); await p.fill('input[name=pagado]', '60000');
  await p.setInputFiles('input[name=comp]', { name: 'transf.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') }); await p.click('.sheet button:has-text("Anotar")'); await p.waitForSelector('.toast.ok');
  await p.waitForSelector('.list .item:has-text("Lucía Paz")'); assert.equal(a.run('leer_("JuegoReservas").length'), 1); assert.equal(a.run('leer_("JuegoReservas")[0].adultos'), 2); ok('anotar por WhatsApp con adultos, niños, mail, pago y comprobante');
  // una familia reserva por la web y la dueña confirma el pago
  const r = a.post({ action: 'reservarJuego', nombre: 'Marta Díaz', telefono: '2995551111', email: 'marta@mail.com', adultos: 1, chicos: 4, fecha: '2026-11-07', turnoId: a.run('leer_("Turnos")[0].id'), salonId: 'S1' }); assert(r.ok, JSON.stringify(r));
  await p.click('.tabs button:has-text("Reservas")'); await p.click('.tabs button:has-text("hs de juego")'); await p.waitForSelector('.list .item:has-text("Marta")'); assert(await p.locator('text=esperando que confirmes').count()); ok('avisa cuando hay un pago por confirmar');
  await p.click('.tabs button:has-text("Caja")'); await p.waitForSelector('.stats'); await p.click('.tabs button:has-text("Caja")'); await p.waitForSelector('.chip:has-text("Pendiente")'); await shot('h5-caja-pendiente');
  assert(await p.locator('text=hs de juego anotadas que todavía no pagaron').count()); ok('la caja muestra lo pendiente aparte, sin sumarlo al balance');
  await p.click('.tabs button:has-text("hs de juego")'); await p.waitForSelector('.list .item:has-text("Marta")');
  await p.click('.list .item:has-text("Marta")'); await p.waitForSelector('.money'); await shot('h6-detalle'); assert(await p.locator('dt:text-is("Mail")').count()); await p.click('button:has-text("Confirmar pago")'); await p.waitForSelector('.toast.ok'); await p.waitForSelector('.chip.confirmada'); ok('confirmar pago');
  await p.click('.sheet-head .icon'); await p.waitForTimeout(300);
  await p.click('.tabs button:has-text("Caja")'); await p.waitForSelector('.stats'); const st = await p.locator('.stats').innerText(); assert(st.includes('$140.000'), st); assert.equal(await p.locator('.chip:has-text("Pendiente")').count(), 0); await shot('h7-caja'); ok('confirmado entra al balance');
  // cerrar un horario
  await p.click('.tabs button:has-text("hs de juego")'); await p.waitForSelector('h3.sec'); await p.click('.list .item:has-text("mesas") >> nth=0'); await p.waitForSelector('input[name=adultosMax]'); await p.click('.sheet button:has-text("Cerrar")'); await p.waitForSelector('.toast.ok'); await p.waitForTimeout(500);
  assert((await p.locator('.chip:has-text("Cerrado")').count()) >= 1); ok('cerrar un horario a mano');
  assert.deepEqual(errores, []); await b.close(); srv.close(); console.log('hs de juego panel OK');
})().catch(e => { console.error(e); process.exit(1); });
