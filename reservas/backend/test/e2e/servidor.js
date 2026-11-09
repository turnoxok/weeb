// Servidor de pruebas: sirve el panel / la página de reservas y responde /exec con el backend real (Codigo.gs) sobre el simulador.
const http = require('http'), fs = require('fs'), path = require('path');
const { crear } = require('../mock');
const PL = path.join(__dirname, '..', '..', '..', 'plantillas');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function semilla() {
  const a = crear(); a.setNow(Date.parse('2026-11-05T12:00:00-03:00')); a.run('instalar()');
  a.run("definirUsuario_('dueno@mail.com','clave-segura-123','Ana','admin')");
  const cfg = { nombre: 'Lemadavami', colorPrincipal: '#8149bd', whatsapp: '5491155551234', direccion: 'Av. Siempreviva 742', mapsUrl: 'https://maps.google.com/?q=x', transferAlias: 'lemadavami.fiestas', transferTitular: 'Ana Pérez', transferCbu: '0000003100012345678901', transferBanco: 'Mercado Pago', emailAdmin: 'dueno@mail.com' };
  Object.keys(cfg).forEach(k => a.run(`actualizar_('Config', leer_('Config').filter(r => r.clave === '${k}')[0]._row, { valor: ${JSON.stringify(cfg[k])} })`));
  const adm = (accion, p) => { const lg = a.post({ action: 'login', email: 'dueno@mail.com', clave: 'clave-segura-123' }); return a.post(Object.assign({ action: accion, token: lg.data.token }, p)); };
  adm('admin.guardarTurno', { salonId: 'S1', dias: '5,6,0', inicio: '14:00', fin: '18:00', etiqueta: 'Tarde', precio: 100000, senaTipo: 'pct', senaValor: 30 });
  adm('admin.guardarTurno', { salonId: 'S1', dias: '5,6,0', inicio: '19:00', fin: '23:00', etiqueta: 'Noche', precio: 120000, senaTipo: 'monto', senaValor: 20000 });
  adm('admin.guardarTurno', { salonId: 'S1', dias: '1,2,3,4', inicio: '16:00', fin: '19:00', etiqueta: 'Semana', precio: 60000, senaTipo: 'ninguna' });
  return a;
}
function iniciar(carpeta, puerto, a) {
  a = a || semilla();
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/exec') {
      const fin = out => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out.getContent()); };
      if (req.method === 'POST') { let b = ''; req.on('data', c => (b += c)); req.on('end', () => fin(a.ctx.doPost({ postData: { contents: b } }))); } else fin(a.ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }));
      return;
    }
    if (u.pathname === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ api: '/exec', volver: '/volver.html' })); }
    let rel = u.pathname === '/' ? 'index.html' : u.pathname.slice(1), f = path.join(PL, carpeta, rel);
    if (!fs.existsSync(f)) f = path.join(PL, rel);
    if (!f.startsWith(PL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  return new Promise(ok => srv.listen(puerto, () => ok({ srv, a })));
}
module.exports = { iniciar, semilla };
if (require.main === module) iniciar(process.argv[2] || 'panel', +process.argv[3] || 8780).then(() => console.log('listo'));
