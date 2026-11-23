import fs from 'fs'; import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright/index.js'); const { iniciar } = require('./servidor.js');
const { srv } = await iniciar(process.argv[2] || 'reservar', 8793); const css = fs.readFileSync(new URL('../../../clientes/quokka/tema.css', import.meta.url), 'utf8');
const b = await chromium.launch({ args: ['--no-sandbox'] }), cx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 }); await cx.clock.setFixedTime(new Date('2026-11-05T12:00:00-03:00')); const p = await cx.newPage();
await p.goto('http://localhost:8793/'); await p.addStyleTag({ content: css }); await p.waitForSelector('.cal button.libre'); await p.waitForTimeout(400); await p.screenshot({ path: '/tmp/e2e/tq-reservar.png' });
await p.click('.cal button.libre'); await p.waitForSelector('.slot'); await p.click('.slot'); await p.waitForSelector('input[name=nombre]'); await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/e2e/tq-form.png', fullPage: true });
await b.close(); srv.close();
