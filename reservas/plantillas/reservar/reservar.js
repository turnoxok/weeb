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
async function fetchSeguro(url, opts) { if (window.TEMA && TEMA.demoId) { if (!window.DEMO_BACKEND) throw new Error('No se pudo iniciar la demo. Recargá la página.'); return DEMO_BACKEND.fetch(url, opts); } const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45000); try { return await fetch(url, { ...(opts || {}), signal: ctl.signal }); } catch (e) { throw new Error(e && e.name === 'AbortError' ? 'Está tardando demasiado. Probá de nuevo en un momento.' : 'No hay conexión. Revisá tu internet y probá de nuevo.'); } finally { clearTimeout(tm); } }
async function llamar(action, data, post) {
  if (/PENDIENTE/.test(S.cfg.api || '')) throw new Error((S.cfg.demoAviso) || 'Demostración: las reservas se activan cuando se conecta la hoja de cálculo del salón.');
  if (post && S.cfg.demo) throw new Error(S.cfg.demoAviso || 'Esto es una demostración: las reservas se activan cuando se conecta la hoja del salón.');
  const r = await fetchSeguro(S.cfg.api + (post ? '' : '?' + new URLSearchParams({ action, ...(data || {}) })), post ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...(data || {}) }) } : {});
  let j; try { j = await r.json(); } catch (e) { throw new Error('No hay conexión. Probá de nuevo o escribinos por WhatsApp.'); }
  if (!j.ok) { const e = new Error(j.mensaje || j.error); e.codigo = j.error; throw e; } return action === 'config' && S.cfg.demo ? Object.assign(j.data, S.cfg.demo) : j.data;   // config.json puede traer "demo": nombre/logo/contacto propios sin tocar la hoja
}
const wa = (txt) => S.pub.whatsapp ? 'https://wa.me/' + S.pub.whatsapp.replace(/\D/g, '') + (txt ? '?text=' + encodeURIComponent(txt) : '') : '';
function cabecera() {
  const emb = window.parent !== window, txt = '← Volver al sitio', volver = emb ? [h('button', { class: 'weeb-back', onclick: () => parent.postMessage('weeb-cerrar', location.origin) }, txt), h('div', { style: 'height:46px' })] : S.cfg.volver ? [h('a', { class: 'weeb-back', href: S.cfg.volver }, txt), h('div', { style: 'height:46px' })] : '';
  const w = wa(`Hola! Quiero consultar por una reserva en ${S.pub.nombre}.`);
  return h('div', null, volver, h('div', { class: 'head' }, h('img', { src: (window.TEMA && TEMA.logo) || S.pub.logoUrl || 'weeb-logo.svg', alt: S.pub.nombre, onerror: ev => { if (!ev.target.dataset.f) { ev.target.dataset.f = 1; ev.target.src = 'weeb-logo.svg'; } } }), h('h1', null, S.pub.nombre), S.pub.direccion ? h('p', { class: 'muted small', style: 'margin:.3rem 0 0' }, S.pub.direccion) : ''),
    h('div', { class: 'acts' }, w ? h('a', { class: 'btn soft sm', href: w, target: '_blank', rel: 'noopener' }, 'WhatsApp') : '', S.pub.mapsUrl ? h('a', { class: 'btn soft sm', href: S.pub.mapsUrl, target: '_blank', rel: 'noopener' }, 'Cómo llegar') : '', h('button', { class: 'btn soft sm', onclick: consultar }, 'Mi reserva')));
}
const firma = () => h('div', { class: 'firma' }, 'Hecho con ', h('a', { href: 'https://www.tuweeb.com', target: '_blank', rel: 'noopener' }, 'tuweeb'));
const pasos = n => h('div', { class: 'steps', 'aria-hidden': 'true' }, [1, 2, 3, 4].map(i => h('i', { class: i <= n ? 'on' : '' })));
const setPaso = n => document.querySelectorAll('.steps i').forEach((e, i) => e.classList.toggle('on', i < n));
const pagina = (paso, ...c) => $('#app').replaceChildren(h('div', { class: 'page' }, cabecera(), pasos(paso), ...c, firma()));

async function iniciar() {
  const P = window.__pre;
  S.cfg = await (P ? P.cfg : fetch('config.json', { cache: 'no-store' }).then(r => r.json()));
  try { const pj = P && P.pub ? await P.pub : null; S.pub = pj && pj.ok ? (S.cfg.demo ? Object.assign(pj.data, S.cfg.demo) : pj.data) : await llamar('config'); if (window.TEMA && TEMA.nombre) S.pub.nombre = TEMA.nombre; } catch (e) { $('#app').replaceChildren(h('div', { style: 'text-align:center;padding:26vh 1.2rem' }, h('p', { class: 'empty' }, e.message), h('button', { class: 'btn', onclick: () => location.reload() }, 'Reintentar')), window.parent !== window ? h('button', { class: 'weeb-back', onclick: () => parent.postMessage('weeb-cerrar', location.origin) }, '← Volver al sitio') : S.cfg.volver ? h('a', { class: 'weeb-back', href: S.cfg.volver }, '← Volver al sitio') : ''); return; }
  document.title = 'Reservar · ' + S.pub.nombre;
  const ref = refDe();
  if (ref) return estado(ref);
  S.mes = new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1); calendario();
}

/* ───── 1. calendario y horarios ───── */
async function calendario() {
  pagina(1, h('h2', { class: 't' }, 'Elegí el día'), h('p', { class: 'empty' }, h('img', { class: 'tw3d', src: 'tuweeb-icono.svg', alt: 'tuweeb' })));
  let d; try { const P = window.__pre, pj = P && P.mes === S.mes && !S.usoPre && P.disp ? (S.usoPre = 1, await P.disp) : null; d = S.disp = pj && pj.ok ? pj.data : await llamar('disponibilidad', { mes: S.mes }); } catch (e) { return pagina(1, h('div', { class: 'err' }, e.message)); }
  const [y, m] = S.mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const ini = d.hoy.slice(0, 7), fin = d.hasta.slice(0, 7), cel = [...['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => h('div', { class: 'dow' }, x)), ...Array(off).fill(0).map(() => h('div', { class: 'off' }))];
  for (let i = 1; i <= n; i++) {
    const f = `${S.mes}-${pad(i)}`, sl = d.dias[f] || [], libres = sl.filter(s => s.estado === 'libre').length, mostrable = sl.some(s => s.estado === 'libre' || s.estado === 'ocupado');
    cel.push(h('button', { class: (libres ? 'libre' : sl.some(s => s.estado === 'ocupado') ? 'lleno' : '') + (f === S.fecha ? ' sel' : ''), disabled: !mostrable, 'aria-label': flarga(f) + (libres ? ' disponible' : ' no disponible'), onclick: () => { S.fecha = f; calendario2(); } }, i));
  }
  const cont = h('div', { id: 'horarios' }), hayLugar = Object.keys(d.dias).some(k => k.startsWith(S.mes) && d.dias[k].some(x => x.estado === 'libre')), wsp = wa(`Hola! Quiero consultar fechas para una fiesta en ${S.pub.nombre}.`);
  pagina(S.fecha && mesDe(S.fecha) === S.mes ? 2 : 1, h('h2', { class: 't' }, 'Elegí el día'), h('div', { class: 'nav' }, h('button', { class: 'icon', 'aria-label': 'Mes anterior', disabled: S.mes <= ini, onclick: () => { S.mes = sumMes(S.mes, -1); S.fecha = ''; calendario(); } }, '‹'), h('h3', null, nomMes(S.mes)), h('button', { class: 'icon', 'aria-label': 'Mes siguiente', disabled: S.mes >= fin, onclick: () => { S.mes = sumMes(S.mes, 1); S.fecha = ''; calendario(); } }, '›')),
    h('div', { class: 'cal' }, cel), hayLugar ? h('p', { class: 'muted small', style: 'margin:.6rem 0' }, 'Los días con borde de color tienen lugar. Podés reservar hasta ' + nomMes(fin) + '.') : h('div', { class: 'card', style: 'margin:.8rem 0' }, h('b', null, 'Todavía no hay horarios disponibles en ' + nomMes(S.mes) + '.'), h('p', { class: 'muted small', style: 'margin:.3rem 0 .7rem' }, S.mes < fin ? 'Probá con el mes siguiente' + (wsp ? ' o escribinos y te ayudamos a encontrar fecha.' : '.') : 'Escribinos y te ayudamos a encontrar fecha.'), wsp ? h('a', { class: 'btn soft sm', href: wsp, target: '_blank', rel: 'noopener' }, 'Escribinos por WhatsApp') : ''), cont);
  if (S.fecha && mesDe(S.fecha) === S.mes) horarios();
}
function calendario2() { setPaso(2); document.querySelectorAll('.cal button').forEach(b => b.classList.remove('sel')); document.querySelectorAll('.cal button').forEach(b => { if (b.getAttribute('aria-label') && b.getAttribute('aria-label').startsWith(flarga(S.fecha) + ' ')) b.classList.add('sel'); }); horarios(); }
/** Precio y seña de un plan en el horario elegido (si el plan tiene precio puntual para ese horario, vale ese). */
/** Planes que ofrece cada salón: los suyos y los que valen para todos. */
const colorDe = id => (S.cfg.colores || {})[id] || '';
function leyenda() {   // referencia de colores por salón (config.json: "colores" {idSalón: color} y "extras" [{nombre,color,nota}])
  const it = [...(S.pub.salones || []).filter(x => colorDe(x.id)).map(x => ({ nombre: x.nombre, color: colorDe(x.id) })), ...(S.cfg.extras || [])];
  return it.length < 2 ? '' : h('ul', { class: 'ley', 'aria-label': 'Referencia de colores' }, it.map(x => h('li', { style: '--sc:' + x.color }, h('i'), h('span', null, x.nombre, x.nota ? h('em', null, x.nota) : ''))));
}
function planesDe(salonId) { return (S.pub.planes || []).filter(p => !p.salonId || p.salonId === salonId); }
function valePlan(p, turnoId) {
  const pr = p.precios && p.precios[turnoId] != null ? Number(p.precios[turnoId]) : p.precio;
  const sena = p.senaTipo === 'pct' ? Math.round(pr * Math.min(100, Math.max(0, p.senaValor)) / 100) : p.senaTipo === 'monto' ? Math.min(pr, p.senaValor) : (p.senaTipo ? 0 : p.sena);
  return { ...p, precio: pr, sena };
}
function horarios() {
  const sl = (S.disp.dias[S.fecha]) || [], multi = (S.pub.salones || []).length > 1, nom = id => ((S.pub.salones || []).find(s => s.id === id) || {}).nombre;
  const cont = $('#horarios'); cont.replaceChildren(h('h2', { class: 't' }, 'Horarios del ' + flarga(S.fecha)), leyenda(), h('div', { class: 'slots' }, sl.map(s => s.estado !== 'libre' ? h('div', { class: 'slot off' + (colorDe(s.salonId) ? ' sc' : ''), style: colorDe(s.salonId) ? '--sc:' + colorDe(s.salonId) : null, 'aria-disabled': 'true' }, h('div', null, h('b', null, `${s.inicio} a ${s.fin} hs`), h('span', { class: 'muted small' }, [s.etiqueta, multi ? nom(s.salonId) : ''].filter(Boolean).join(' · '))), h('div', { class: 'p muted' }, 'No disponible')) : h('button', { class: 'slot' + (colorDe(s.salonId) ? ' sc' : ''), style: colorDe(s.salonId) ? '--sc:' + colorDe(s.salonId) : null, onclick: () => { S.slot = s; S.plan = null; formulario(); } }, h('div', null, h('b', null, `${s.inicio} a ${s.fin} hs`), h('span', { class: 'muted small' }, [s.etiqueta, multi ? nom(s.salonId) : ''].filter(Boolean).join(' · '))), planesDe(s.salonId).length ? h('div', { class: 'p small' }, 'Desde ' + money(Math.min(...planesDe(s.salonId).map(p => valePlan(p, s.turnoId).precio)))) : h('div', { class: 'p' }, money(s.precio), h('div', { class: 'muted small', style: 'font-weight:600' }, s.sena > 0 ? 'Seña ' + money(s.sena) : 'Sin seña'))))));
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ───── 2. datos y confirmación ───── */
function formulario(error) {
  const s = S.slot, metodos = [S.pub.pagoTransferencia && ['transferencia', 'Transferencia bancaria', 'Te pasamos los datos y la reserva queda guardada para vos.'], S.pub.pagoMercadoPago && ['mercadopago', 'Mercado Pago', 'Pagás online con tarjeta o saldo.']].filter(Boolean);
  const planes = planesDe(s.salonId).map(p => valePlan(p, s.turnoId)), tieneP = planes.length > 0, cur = () => tieneP ? (S.plan || null) : s;
  const totEl = h('div', null), payBox = h('div', { class: 'pay' }), goBtn = h('button', { class: 'btn block', id: 'go' }, 'Confirmar reserva');
  const modoBox = h('div', { class: 'pay', hidden: true }, h('span', { class: 'muted small', style: 'font-weight:600' }, 'Cómo querés reservar'),
    h('label', null, h('input', { type: 'radio', name: 'modo', value: 'sena', checked: !S.pagoTotal, onchange: () => { S.pagoTotal = false; act(); } }), h('div', null, h('b', { class: 'm-sena' }))),
    h('label', null, h('input', { type: 'radio', name: 'modo', value: 'total', checked: !!S.pagoTotal, onchange: () => { S.pagoTotal = true; act(); } }), h('div', null, h('b', { class: 'm-total' }))));
  const act = () => {
    const c0 = cur(), dsc = Number(S.plan && S.plan.descTotal) || 0, conDesc = !!(c0 && tieneP && dsc > 0), tot = conDesc && S.pagoTotal ? Math.round(c0.precio * (100 - dsc) / 100) : null;
    const c = tot != null ? { ...c0, precio: tot, sena: tot } : c0;
    modoBox.hidden = !conDesc; if (conDesc) { modoBox.querySelector('.m-sena').textContent = 'Reservar con seña de ' + money(c0.sena); modoBox.querySelector('.m-total').textContent = 'Pagar todo ahora: ' + money(Math.round(c0.precio * (100 - dsc) / 100)) + ' (' + dsc + '% OFF)'; }
    totEl.textContent = c ? (tot != null ? 'Total ' + money(c.precio) + ' · ' + dsc + '% OFF por pago total (antes ' + money(c0.precio) + ')' : 'Total ' + money(c.precio) + (c.sena > 0 ? ' · Seña ' + money(c.sena) : ' · Sin seña')) : 'Elegí un plan para ver el precio';
    const sn = c ? c.sena : 0; payBox.hidden = !(sn > 0 && metodos.length); payBox.querySelector('.lbl').textContent = (tot != null ? 'Cómo querés pagar los ' : 'Cómo querés pagar la seña de ') + money(sn);
    goBtn.textContent = !c ? 'Elegí un plan' : sn > 0 ? (tot != null ? 'Reservar y pagar todo' : 'Reservar y pagar la seña') : 'Confirmar reserva';
  };
  payBox.append(h('span', { class: 'muted small lbl', style: 'font-weight:600' }), ...metodos.map(([v, t, d], i) => h('label', null, h('input', { type: 'radio', name: 'metodo', value: v, checked: i === 0 }), h('div', null, h('b', null, t), h('div', { class: 'muted small' }, d)))));
  const planBox = tieneP ? h('div', { class: 'pay', id: 'planes' }, h('span', { class: 'muted small', style: 'font-weight:600' }, 'Elegí tu plan'), planes.map(p => h('label', null, h('input', { type: 'radio', name: 'plan', value: p.id, checked: S.plan && S.plan.id === p.id, onchange: () => { S.plan = p; act(); } }), h('div', null, h('b', null, p.nombre + ' · ' + money(p.precio)), p.descripcion ? h('div', { class: 'muted small' }, p.descripcion) : '')))) : '';
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); if (tieneP && !S.plan) { const pb = $('#planes'); pb.classList.add('shake'); pb.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; } enviar(f); } },
    planBox, modoBox,
    h('label', { class: 'field' }, h('span', null, 'Tu nombre'), h('input', { name: 'nombre', required: true, autocomplete: 'name', maxlength: '80' })),
    h('label', { class: 'field' }, h('span', null, 'Teléfono / WhatsApp'), h('input', { name: 'telefono', type: 'tel', required: true, autocomplete: 'tel', maxlength: '30' })),
    h('label', { class: 'field' }, h('span', null, 'Mail (para mandarte la confirmación)'), h('input', { name: 'email', type: 'email', autocomplete: 'email', maxlength: '120' })),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Cantidad de invitados'), h('input', { name: 'personas', type: 'number', min: '1', max: '500', inputmode: 'numeric' })), ''),
    h('label', { class: 'field' }, h('span', null, 'Comentarios (opcional)'), h('textarea', { name: 'nota', rows: 2, maxlength: '400' })),
    payBox,
    h('div', { class: 'hp', 'aria-hidden': 'true' }, h('input', { name: 'xr_cmp', type: 'text', tabindex: '-1', autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true' })),
    error ? h('div', { class: 'err' }, error) : '', goBtn,
    h('button', { type: 'button', class: 'btn line block', style: 'margin-top:.6rem', onclick: () => calendario() }, 'Volver'));
  pagina(3, h('h2', { class: 't' }, 'Tus datos'), h('div', { class: 'resumen' }, h('b', null, flarga(S.fecha)), `${s.inicio} a ${s.fin} hs` + (s.etiqueta ? ' · ' + s.etiqueta : ''), totEl), f);
  act();
  window.scrollTo(0, 0);
}
async function enviar(f) {
  const b = $('#go'), x = Object.fromEntries(new FormData(f)); b.disabled = true; b.textContent = 'Reservando…';
  try {
    const r = await llamar('reservar', { turnoId: S.slot.turnoId, fecha: S.fecha, nombre: x.nombre, telefono: x.telefono, email: x.email, personas: x.personas, nota: x.nota, metodo: x.metodo || 'transferencia', planId: S.plan ? S.plan.id : undefined, pagoTotal: S.plan && S.pagoTotal && Number(S.plan.descTotal) > 0 ? true : undefined, web: x.xr_cmp }, true);
    history.replaceState(null, '', '?reserva=' + r.id); resultado(r, true);
  } catch (e) {
    if (e.codigo === 'PLAN_INVALIDO') { S.plan = null; S.pub = await llamar('config').catch(() => S.pub); return formulario(e.message); }
    if (e.codigo === 'OCUPADO') { S.fecha = ''; await calendario(); const c = $('#horarios'); if (c) c.before(h('div', { class: 'err' }, 'Ese horario se acaba de ocupar. Elegí otro, por favor.')); return; }
    const v = $('form'); if (v) { b.disabled = false; b.textContent = 'Reservar'; const old = $('.err', v); if (old) old.remove(); b.before(h('div', { class: 'err' }, e.message)); }
  }
}

/* ───── comprobante de seña: el cliente sube foto o PDF ───── */
function leerArchivo(f) {
  return new Promise((ok, mal) => {
    const fin = (blob, tipo) => { const fr = new FileReader(); fr.onload = () => ok({ nombre: f.name, tipo, datos: String(fr.result).split(',')[1] || '' }); fr.onerror = () => mal(new Error('No pudimos leer el archivo')); fr.readAsDataURL(blob); };
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { if (f.size > 4.5 * 1048576) return mal(new Error('El archivo pesa demasiado (máximo 4 MB)')); return fin(f, f.type); }
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? fin(b, 'image/jpeg') : mal(new Error('No pudimos preparar la foto')), 'image/jpeg', 0.82); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No pudimos abrir esa imagen. Probá con otra foto o un PDF.')); };
    img.src = url;
  });
}
function bloqueComprobante(r) {
  const c = r.comprobante, msg = h('p', { class: 'small', style: 'margin-top:.6rem' }), inp = h('input', { type: 'file', accept: 'image/*,application/pdf', style: 'display:none' });
  const btn = h('button', { class: c ? 'btn line block' : 'btn block', style: 'margin-top:.8rem', onclick: () => inp.click() }, c ? 'Cambiar comprobante' : 'Subir comprobante de la transferencia');
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    S.subiendo = true; btn.disabled = true; btn.textContent = 'Enviando…'; msg.className = 'small muted'; msg.textContent = 'Subiendo el archivo, no cierres esta página.';
    try { const a = await leerArchivo(f); r = await llamar('comprobante', { id: r.id, ...a }, true); S.subiendo = false; resultado(r, false); }
    catch (e) { S.subiendo = false; btn.disabled = false; btn.textContent = c ? 'Cambiar comprobante' : 'Subir comprobante de la transferencia'; msg.className = 'small err'; msg.textContent = e.message + ' Podés mandarlo por WhatsApp.'; inp.value = ''; }
  });
  return h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', { style: 'margin-bottom:.3rem' }, c ? '✓ Comprobante recibido' : 'Mandanos el comprobante'),
    h('p', { class: 'muted small' }, c ? 'Recibimos «' + c.nombre + '». En cuanto revisemos el pago, confirmamos tu reserva.' : 'Sacale una foto o subí el PDF de la transferencia. Así confirmamos tu reserva más rápido.'), inp, btn, msg);
}
/* ───── 3. resultado y estado ───── */
const refDe = () => { const q = new URLSearchParams(location.search); return q.get('codigo') ? { codigo: q.get('codigo') } : q.get('reserva') ? { id: q.get('reserva') } : null; };
async function estado(ref) {
  let r; try { r = await llamar('estado', ref); } catch (e) { return noEncontrada(e, ref); }
  if (ref.codigo && r.codigo) history.replaceState(null, '', '?codigo=' + r.codigo);
  resultado(r, false);
  if (r.estado === 'pendiente') setTimeout(() => { if (!S.subiendo && JSON.stringify(refDe()) === JSON.stringify({ codigo: r.codigo })) estado({ codigo: r.codigo }); else if (!S.subiendo && JSON.stringify(refDe()) === JSON.stringify(ref)) estado(ref); }, 20000);
}
function noEncontrada(e, ref) {
  const w = wa('Hola! No encuentro mi reserva' + (ref && ref.codigo ? ' (código ' + ref.codigo + ')' : '') + '.');
  return pagina(4, h('div', { class: 'big' }, h('div', { class: 'ico b' }, '?'), h('h2', null, e.codigo === 'NO_ENCONTRADA' ? 'No encontramos esa reserva' : 'No pudimos consultar'), h('p', { class: 'muted' }, e.message)),
    h('button', { class: 'btn block', onclick: consultar }, 'Probar con otro código'), w ? h('a', { class: 'btn line block', style: 'margin-top:.7rem', href: w, target: '_blank', rel: 'noopener' }, 'Escribinos por WhatsApp') : '');
}
/** Pantalla para ver el estado de una reserva con su código (6 letras y números). */
function consultar() {
  history.replaceState(null, '', location.pathname);
  const msg = h('p', { class: 'small', style: 'min-height:1.2em;margin-top:.6rem' }), inp = h('input', { name: 'codigo', class: 'codein', placeholder: 'K7M4PQ', maxlength: 14, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Código de reserva' });
  const f = h('form', { onsubmit: async ev => {
    ev.preventDefault(); const c = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 4) { msg.className = 'small err'; msg.textContent = 'Escribí el código de tu reserva (6 letras y números).'; return; }
    const b = $('button', f); b.disabled = true; b.textContent = 'Buscando…'; msg.className = 'small muted'; msg.textContent = '';
    let r; try { r = await llamar('estado', { codigo: c }); } catch (e) { b.disabled = false; b.textContent = 'Ver mi reserva'; msg.className = 'small err'; msg.textContent = e.message; return; }
    history.replaceState(null, '', '?codigo=' + r.codigo); resultado(r, false); if (r.estado === 'pendiente') setTimeout(() => { if (!S.subiendo && JSON.stringify(refDe()) === JSON.stringify({ codigo: r.codigo })) estado({ codigo: r.codigo }); }, 20000);
  } }, h('p', { class: 'muted' }, 'Escribí el código que te llegó cuando reservaste (está en la pantalla y en tu mail).'), inp, h('button', { class: 'btn block', style: 'margin-top:.8rem' }, 'Ver mi reserva'), msg);
  pagina(4, h('h2', { class: 't' }, 'Consultá tu reserva'), f, h('button', { class: 'btn line block', style: 'margin-top:1rem', onclick: () => { S.fecha = ''; S.slot = null; calendario(); } }, 'Volver al calendario'));
  setTimeout(() => inp.focus(), 50);
}
function copiar(label, valor) { return h('div', { class: 'copy' }, h('div', null, h('span', null, label), h('b', null, valor)), h('button', { class: 'btn soft sm', onclick: e => { navigator.clipboard && navigator.clipboard.writeText(valor); e.target.textContent = '¡Copiado!'; setTimeout(() => (e.target.textContent = 'Copiar'), 1500); } }, 'Copiar')); }
const fila = (k, v, cls) => v === '' || v == null ? '' : [h('dt', null, k), h('dd', { class: cls || '' }, v)];
function resultado(r, nueva) {
  const fh = flarga(r.fecha) + ' · ' + r.inicio + ' a ' + r.fin + ' hs', ok = r.estado === 'confirmada' || r.estado === 'saldada', pend = r.estado === 'pendiente';
  const vence = pend && r.venceEn ? new Date(r.venceEn).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const cab = ok ? h('div', { class: 'big' }, h('div', { class: 'ico' }, '✓'), h('h2', null, r.saldo > 0 ? '¡Reserva confirmada!' : '¡Reserva confirmada y paga!'), h('p', null, fh), nueva && !pend ? h('p', { class: 'muted small' }, 'Si dejaste tu mail, te mandamos la confirmación.') : '')
    : pend ? h('div', { class: 'big' }, h('div', { class: 'ico w' }, '⏳'), h('h2', null, nueva ? '¡Casi listo!' : 'Reserva pendiente de pago'), h('p', null, fh), vence ? h('p', { class: 'muted' }, 'Te guardamos el turno hasta el ' + vence.replace(/\.$/, '') + '. Si no recibimos la seña a tiempo, el turno se libera.') : '')
    : h('div', { class: 'big' }, h('div', { class: 'ico b' }, '✕'), h('h2', null, r.estado === 'vencida' ? 'La reserva venció' : 'Reserva cancelada'), h('p', { class: 'muted' }, r.estado === 'vencida' ? 'No recibimos la seña a tiempo y el turno se liberó. Podés volver a reservar.' : 'Esta reserva fue cancelada.'));
  const volver = h('button', { class: 'btn line block', style: 'margin-top:1rem', onclick: () => { history.replaceState(null, '', location.pathname); S.fecha = ''; S.slot = null; calendario(); } }, 'Hacer otra reserva');
  const codigo = r.codigo ? h('div', { class: 'card codebox' }, h('span', { class: 'muted small' }, 'Tu código de reserva'), h('b', null, r.codigo), h('button', { class: 'btn soft sm', onclick: e => { const t = e.target; navigator.clipboard && navigator.clipboard.writeText(r.codigo); t.textContent = '¡Copiado!'; setTimeout(() => (t.textContent = 'Copiar'), 1500); } }, 'Copiar')) : '';
  if (!ok && !pend) return pagina(4, cab, codigo, volver);
  const det = h('div', { class: 'card', style: 'margin-top:1rem' }, h('dl', { class: 'kv' }, fila('Reserva de', r.nombre), fila('Fecha', flarga(r.fecha)), fila('Horario', r.inicio + ' a ' + r.fin + ' hs'), fila('Plan', r.plan), fila('Invitados', r.personas || ''), fila('Detalles', r.nota),
    fila('Total', money(r.total)), r.sena > 0 ? fila('Seña', money(r.sena)) : '', r.pagado ? fila('Pagado', money(r.pagado)) : '', (pend && r.sena > 0 && !r.pagado && r.total > r.sena ? fila('Saldo después de la seña', money(r.total - r.sena), 'deb') : fila(r.saldo > 0 ? 'Saldo a pagar' : 'Saldo', money(Math.max(0, r.saldo)), r.saldo > 0 ? 'deb' : 'ok'))));
  const t = r.transferencia, aviso = wa(`Hola! Ya hice la transferencia de la seña. Reserva ${r.codigo || r.id}, a nombre de ${r.nombre}, ${flarga(r.fecha)} de ${r.inicio} a ${r.fin} hs.`);
  const ampliar = wa(`Hola! Quiero ampliar mi plan o sumar invitados. Reserva ${r.codigo || r.id}, a nombre de ${r.nombre}, ${flarga(r.fecha)} de ${r.inicio} a ${r.fin} hs.`);
  const pie = pend ? 'Cuando confirmemos el pago, esta página y tu mail van a mostrar la reserva como confirmada. Para volver a verla, entrá a «Mi reserva» y escribí tu código.' : 'El saldo se abona antes del festejo, como te indiquemos. Para cualquier cambio escribinos con tu código.';
  return pagina(4, cab, codigo, pend ? (t ? h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:.4rem' }, 'Transferí la seña de ' + money(t.importe)), t.alias ? copiar('Alias', t.alias) : '', t.cbu ? copiar('CBU / CVU', t.cbu) : '', t.titular ? copiar('Titular', t.titular) : '', t.banco ? h('p', { class: 'muted small' }, 'Banco o billetera: ' + t.banco) : '', t.nota ? h('p', { class: 'small' }, t.nota) : '') : h('div', { class: 'card' }, h('p', null, 'Para confirmar el turno, coordiná el pago de la seña con nosotros.'))) : '',
    pend && t ? bloqueComprobante(r) : '', det,
    pend && aviso ? h('a', { class: 'btn line block', style: 'margin-top:1rem', href: aviso, target: '_blank', rel: 'noopener' }, r.comprobante ? 'Avisar por WhatsApp' : 'Prefiero avisar por WhatsApp') : '',
    ampliar ? h('a', { class: 'btn line block', style: 'margin-top:.7rem', href: ampliar, target: '_blank', rel: 'noopener' }, 'Ampliar mi plan o sumar invitados') : '',
    h('p', { class: 'muted small', style: 'text-align:center;margin-top:.8rem' }, pie), volver);
}
iniciar().catch(e => { $('#app').replaceChildren(h('p', { style: 'text-align:center;padding:30vh 1rem' }, 'No se pudo cargar: ' + e.message)); });
