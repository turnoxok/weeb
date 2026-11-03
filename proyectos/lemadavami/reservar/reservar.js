'use strict';
/* Weeb Reservas — página de reservas para el cliente final. Sin dependencias. Todo el texto se inserta con textContent. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], DSEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad = n => String(n).padStart(2, '0'), $ = (s, r = document) => r.querySelector(s);
const parse = f => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); };
const flarga = f => { const d = parse(f); return `${DSEM[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const mesDe = f => f.slice(0, 7), nomMes = m => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} ${y}`; };
const sumMes = (m, n) => { const [y, mm] = m.split('-').map(Number), d = new Date(y, mm - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const money = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
function h(tag, props, ...kids) {
  const e = document.createElement(tag), post = {};
  for (const [k, v] of Object.entries(props || {})) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value' || k === 'checked') post[k] = v; else e.setAttribute(k, v === true ? '' : v); }
  kids.flat(Infinity).forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  if ('value' in post) e.value = post.value; if ('checked' in post) e.checked = !!post.checked; return e;
}
const S = { cfg: null, pub: null, mes: '', disp: null, fecha: '', slot: null };
async function llamar(action, data, post) {
  const r = await fetch(S.cfg.api + (post ? '' : '?' + new URLSearchParams({ action, ...(data || {}) })), post ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...(data || {}) }) } : {});
  let j; try { j = await r.json(); } catch (e) { throw new Error('No hay conexión. Probá de nuevo o escribinos por WhatsApp.'); }
  if (!j.ok) { const e = new Error(j.mensaje || j.error); e.codigo = j.error; throw e; } return j.data;
}
const wa = (txt) => S.pub.whatsapp ? 'https://wa.me/' + S.pub.whatsapp.replace(/\D/g, '') + (txt ? '?text=' + encodeURIComponent(txt) : '') : '';
function cabecera() {
  const emb = window.parent !== window, volver = emb ? h('button', { class: 'btn line sm back', onclick: () => parent.postMessage('weeb-cerrar', location.origin) }, '← Volver a la web') : S.cfg.volver ? h('a', { class: 'btn line sm back', href: S.cfg.volver }, '← Volver a la web') : '';
  const w = wa(`Hola! Quiero consultar por una reserva en ${S.pub.nombre}.`);
  return h('div', null, volver, h('div', { class: 'head' }, h('img', { src: S.pub.logoUrl || 'weeb-logo.svg', alt: S.pub.nombre, onerror: ev => { if (!ev.target.dataset.f) { ev.target.dataset.f = 1; ev.target.src = 'weeb-logo.svg'; } } }), S.pub.direccion ? h('p', { class: 'muted small', style: 'margin:.3rem 0 0' }, S.pub.direccion) : ''),
    h('div', { class: 'acts' }, w ? h('a', { class: 'btn soft sm', href: w, target: '_blank', rel: 'noopener' }, 'WhatsApp') : '', S.pub.mapsUrl ? h('a', { class: 'btn soft sm', href: S.pub.mapsUrl, target: '_blank', rel: 'noopener' }, 'Cómo llegar') : ''));
}
const firma = () => h('div', { class: 'firma' }, 'Hecho con ', h('a', { href: 'https://www.tuweeb.com', target: '_blank', rel: 'noopener' }, 'tuweeb'));
const pasos = n => h('div', { class: 'steps', 'aria-hidden': 'true' }, [1, 2, 3, 4].map(i => h('i', { class: i <= n ? 'on' : '' })));
const setPaso = n => document.querySelectorAll('.steps i').forEach((e, i) => e.classList.toggle('on', i < n));
const pagina = (paso, ...c) => $('#app').replaceChildren(h('div', { class: 'page' }, cabecera(), pasos(paso), ...c, firma()));

async function iniciar() {
  S.cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
  try { S.pub = await llamar('config'); } catch (e) { $('#app').replaceChildren(h('p', { class: 'empty', style: 'text-align:center;padding:30vh 1rem' }, e.message)); return; }
  document.title = 'Reservar · ' + S.pub.nombre;
  const id = new URLSearchParams(location.search).get('reserva');
  if (id) return estado(id);
  S.mes = new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1); calendario();
}

/* ───── 1. calendario y horarios ───── */
async function calendario() {
  pagina(1, h('h2', { class: 't' }, 'Elegí el día'), h('p', { class: 'empty' }, h('span', { class: 'spin' })));
  let d; try { d = S.disp = await llamar('disponibilidad', { mes: S.mes }); } catch (e) { return pagina(1, h('div', { class: 'err' }, e.message)); }
  const [y, m] = S.mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const ini = d.hoy.slice(0, 7), fin = d.hasta.slice(0, 7), cel = [...['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => h('div', { class: 'dow' }, x)), ...Array(off).fill(0).map(() => h('div', { class: 'off' }))];
  for (let i = 1; i <= n; i++) {
    const f = `${S.mes}-${pad(i)}`, sl = d.dias[f] || [], libres = sl.filter(s => s.estado === 'libre').length, mostrable = sl.some(s => s.estado === 'libre' || s.estado === 'ocupado');
    cel.push(h('button', { class: (libres ? 'libre' : sl.some(s => s.estado === 'ocupado') ? 'lleno' : '') + (f === S.fecha ? ' sel' : ''), disabled: !mostrable, 'aria-label': flarga(f) + (libres ? ' disponible' : ' no disponible'), onclick: () => { S.fecha = f; calendario2(); } }, i));
  }
  const cont = h('div', { id: 'horarios' });
  pagina(S.fecha && mesDe(S.fecha) === S.mes ? 2 : 1, h('h2', { class: 't' }, 'Elegí el día'), h('div', { class: 'nav' }, h('button', { class: 'icon', 'aria-label': 'Mes anterior', disabled: S.mes <= ini, onclick: () => { S.mes = sumMes(S.mes, -1); S.fecha = ''; calendario(); } }, '‹'), h('h3', null, nomMes(S.mes)), h('button', { class: 'icon', 'aria-label': 'Mes siguiente', disabled: S.mes >= fin, onclick: () => { S.mes = sumMes(S.mes, 1); S.fecha = ''; calendario(); } }, '›')),
    h('div', { class: 'cal' }, cel), h('p', { class: 'muted small', style: 'margin:.6rem 0' }, 'Los días con borde de color tienen lugar. Podés reservar hasta ' + nomMes(fin) + '.'), cont);
  if (S.fecha && mesDe(S.fecha) === S.mes) horarios();
}
function calendario2() { setPaso(2); document.querySelectorAll('.cal button').forEach(b => b.classList.remove('sel')); document.querySelectorAll('.cal button').forEach(b => { if (b.getAttribute('aria-label') && b.getAttribute('aria-label').startsWith(flarga(S.fecha) + ' ')) b.classList.add('sel'); }); horarios(); }
function horarios() {
  const sl = (S.disp.dias[S.fecha]) || [], multi = (S.pub.salones || []).length > 1, nom = id => ((S.pub.salones || []).find(s => s.id === id) || {}).nombre;
  const cont = $('#horarios'); cont.replaceChildren(h('h2', { class: 't' }, 'Horarios del ' + flarga(S.fecha)), h('div', { class: 'slots' }, sl.map(s => s.estado !== 'libre' ? h('div', { class: 'slot off', 'aria-disabled': 'true' }, h('div', null, h('b', null, `${s.inicio} a ${s.fin} hs`), h('span', { class: 'muted small' }, (s.etiqueta ? s.etiqueta : '') + (multi ? ' · ' + nom(s.salonId) : ''))), h('div', { class: 'p muted' }, 'No disponible')) : h('button', { class: 'slot', onclick: () => { S.slot = s; formulario(); } }, h('div', null, h('b', null, `${s.inicio} a ${s.fin} hs`), h('span', { class: 'muted small' }, (s.etiqueta ? s.etiqueta : '') + (multi ? ' · ' + nom(s.salonId) : ''))), h('div', { class: 'p' }, money(s.precio), h('div', { class: 'muted small', style: 'font-weight:600' }, s.sena > 0 ? 'Seña ' + money(s.sena) : 'Sin seña'))))));
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ───── 2. datos y confirmación ───── */
function formulario(error) {
  const s = S.slot, metodos = [S.pub.pagoTransferencia && ['transferencia', 'Transferencia bancaria', 'Te pasamos los datos y la reserva queda guardada para vos.'], S.pub.pagoMercadoPago && ['mercadopago', 'Mercado Pago', 'Pagás online con tarjeta o saldo.']].filter(Boolean);
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); enviar(f); } },
    h('label', { class: 'field' }, h('span', null, 'Tu nombre'), h('input', { name: 'nombre', required: true, autocomplete: 'name', maxlength: '80' })),
    h('label', { class: 'field' }, h('span', null, 'Teléfono / WhatsApp'), h('input', { name: 'telefono', type: 'tel', required: true, autocomplete: 'tel', maxlength: '30' })),
    h('label', { class: 'field' }, h('span', null, 'Mail (para mandarte la confirmación)'), h('input', { name: 'email', type: 'email', autocomplete: 'email', maxlength: '120' })),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Cantidad de invitados'), h('input', { name: 'personas', type: 'number', min: '1', max: '500', inputmode: 'numeric' })), ''),
    h('label', { class: 'field' }, h('span', null, 'Comentarios (opcional)'), h('textarea', { name: 'nota', rows: 2, maxlength: '400' })),
    s.sena > 0 && metodos.length ? h('div', { class: 'pay' }, h('span', { class: 'muted small', style: 'font-weight:600' }, 'Cómo querés pagar la seña de ' + money(s.sena)), metodos.map(([v, t, d], i) => h('label', null, h('input', { type: 'radio', name: 'metodo', value: v, checked: i === 0 }), h('div', null, h('b', null, t), h('div', { class: 'muted small' }, d))))) : '',
    h('div', { class: 'hp', 'aria-hidden': 'true' }, h('input', { name: 'web', tabindex: '-1', autocomplete: 'off' })),
    error ? h('div', { class: 'err' }, error) : '', h('button', { class: 'btn block', id: 'go' }, s.sena > 0 ? 'Reservar y pagar la seña' : 'Confirmar reserva'),
    h('button', { type: 'button', class: 'btn line block', style: 'margin-top:.6rem', onclick: () => calendario() }, 'Volver'));
  pagina(3, h('h2', { class: 't' }, 'Tus datos'), h('div', { class: 'resumen' }, h('b', null, flarga(S.fecha)), `${s.inicio} a ${s.fin} hs` + (s.etiqueta ? ' · ' + s.etiqueta : ''), h('div', null, 'Total ' + money(s.precio) + (s.sena > 0 ? ' · Seña ' + money(s.sena) : ' · Sin seña'))), f);
  window.scrollTo(0, 0);
}
async function enviar(f) {
  const b = $('#go'), x = Object.fromEntries(new FormData(f)); b.disabled = true; b.textContent = 'Reservando…';
  try {
    const r = await llamar('reservar', { turnoId: S.slot.turnoId, fecha: S.fecha, nombre: x.nombre, telefono: x.telefono, email: x.email, personas: x.personas, nota: x.nota, metodo: x.metodo || 'transferencia', web: x.web }, true);
    history.replaceState(null, '', '?reserva=' + r.id); resultado(r, true);
  } catch (e) {
    if (e.codigo === 'OCUPADO') { S.fecha = ''; await calendario(); const c = $('#horarios'); if (c) c.before(h('div', { class: 'err' }, 'Ese horario se acaba de ocupar. Elegí otro, por favor.')); return; }
    const v = $('form'); if (v) { b.disabled = false; b.textContent = 'Reservar'; const old = $('.err', v); if (old) old.remove(); b.before(h('div', { class: 'err' }, e.message)); }
  }
}

/* ───── 3. resultado y estado ───── */
async function estado(id) {
  let r; try { r = await llamar('estado', { id }); } catch (e) { return pagina(4, h('div', { class: 'err' }, e.codigo === 'NO_ENCONTRADA' ? 'No encontramos esa reserva. Revisá el link o escribinos por WhatsApp.' : e.message)); }
  resultado(r, false); if (r.estado === 'pendiente') setTimeout(() => { if (new URLSearchParams(location.search).get('reserva') === id) estado(id); }, 20000);
}
function copiar(label, valor) { return h('div', { class: 'copy' }, h('div', null, h('span', null, label), h('b', null, valor)), h('button', { class: 'btn soft sm', onclick: e => { navigator.clipboard && navigator.clipboard.writeText(valor); e.target.textContent = '¡Copiado!'; setTimeout(() => (e.target.textContent = 'Copiar'), 1500); } }, 'Copiar')); }
function resultado(r, nueva) {
  const fh = flarga(r.fecha) + ' · ' + r.inicio + ' a ' + r.fin + ' hs', cod = h('p', { class: 'muted small', style: 'text-align:center' }, 'Código de reserva: ' + r.id), volver = h('button', { class: 'btn line block', style: 'margin-top:1rem', onclick: () => { history.replaceState(null, '', location.pathname); S.fecha = ''; S.slot = null; calendario(); } }, 'Hacer otra reserva');
  if (r.estado === 'confirmada' || r.estado === 'saldada') return pagina(4, h('div', { class: 'big' }, h('div', { class: 'ico' }, '✓'), h('h2', null, '¡Reserva confirmada!'), h('p', null, fh), r.pagado ? h('p', { class: 'muted' }, 'Pagaste ' + money(r.pagado) + (r.saldo > 0 ? ' · Saldo ' + money(r.saldo) : '')) : '', nueva ? h('p', { class: 'muted small' }, 'Si dejaste tu mail, te mandamos la confirmación.') : ''), cod, volver);
  if (r.estado === 'pendiente') {
    const t = r.transferencia, aviso = wa(`Hola! Ya hice la transferencia de la seña. Reserva ${r.id}, a nombre de ${r.nombre}, ${flarga(r.fecha)} de ${r.inicio} a ${r.fin} hs.`);
    return pagina(4, h('div', { class: 'big' }, h('div', { class: 'ico w' }, '⏳'), h('h2', null, nueva ? '¡Casi listo!' : 'Reserva pendiente de pago'), h('p', null, fh), h('p', { class: 'muted' }, 'Guardamos el turno para vos hasta el ' + new Date(r.venceEn).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))),
      t ? h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:.4rem' }, 'Transferí la seña de ' + money(t.importe)), t.alias ? copiar('Alias', t.alias) : '', t.cbu ? copiar('CBU / CVU', t.cbu) : '', t.titular ? copiar('Titular', t.titular) : '', t.banco ? h('p', { class: 'muted small' }, 'Banco o billetera: ' + t.banco) : '', t.nota ? h('p', { class: 'small' }, t.nota) : '') : h('div', { class: 'card' }, h('p', null, 'Para confirmar el turno, coordiná el pago de la seña con nosotros.')),
      aviso ? h('a', { class: 'btn block', style: 'margin-top:1rem', href: aviso, target: '_blank', rel: 'noopener' }, 'Ya transferí: avisar por WhatsApp') : '', h('p', { class: 'muted small', style: 'text-align:center;margin-top:.8rem' }, 'Cuando confirmemos el pago, esta página y tu mail van a mostrar la reserva como confirmada. Guardá este link para volver.'), cod);
  }
  return pagina(4, h('div', { class: 'big' }, h('div', { class: 'ico b' }, '✕'), h('h2', null, r.estado === 'vencida' ? 'La reserva venció' : 'Reserva cancelada'), h('p', { class: 'muted' }, r.estado === 'vencida' ? 'No recibimos la seña a tiempo y el turno se liberó. Podés volver a reservar.' : 'Esta reserva fue cancelada.')), cod, volver);
}
iniciar().catch(e => { $('#app').replaceChildren(h('p', { style: 'text-align:center;padding:30vh 1rem' }, 'No se pudo cargar: ' + e.message)); });
