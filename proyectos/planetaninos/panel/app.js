'use strict';
/* Weeb Reservas — panel del dueño. Sin dependencias ni paso de compilación. Todo el texto se inserta con textContent (nada de innerHTML con datos). */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], DIAS_L = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => ymd(new Date());
const parse = f => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); };
const fcorta = f => { const d = parse(f); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };
const flarga = f => { const d = parse(f); return `${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const mesDe = f => f.slice(0, 7);
const sumMes = (mes, n) => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const nomMes = mes => { const [y, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n || 0)).toLocaleString('es-AR');
const horas = (i, f) => { let a = +i.slice(0, 2) * 60 + +i.slice(3), b = +f.slice(0, 2) * 60 + +f.slice(3); if (b <= a) b += 1440; const h = (b - a) / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + ' hs'; };
const $ = (s, r = document) => r.querySelector(s);

function h(tag, props, ...kids) {
  const e = document.createElement(tag), post = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') post[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  if ('value' in post) e.value = post.value; if ('checked' in post) e.checked = !!post.checked;
  return e;
}
const svg = d => { const w = document.createElement('span'); w.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; return w.firstChild; };
const IC = { agenda: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>', reservas: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', caja: '<rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="3"/>', turnos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' };

/* ───── estado y API ───── */
const S = { cfg: null, pub: null, token: localStorage.getItem('weeb_token') || '', user: null, view: 'agenda', mes: mesDe(hoy()), reFiltro: 'prox', reQ: '', cajaMes: mesDe(hoy()), salones: [], turnos: [], instalar: null };
const $app = () => $('#app');

async function llamar(action, data, publico) {
  const get = publico === 'get';
  const url = S.cfg.api + (get ? '?' + new URLSearchParams({ action, ...(data || {}) }) : '');
  const r = await fetch(url, get ? {} : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: S.token, ...(data || {}) }) });
  let j; try { j = await r.json(); } catch (e) { throw new Error('No hay conexión con el servidor. Probá de nuevo.'); }
  if (!j.ok) { if (j.error === 'NO_AUTORIZADO' && S.token) { salir(true); } const e = new Error(j.mensaje || j.error); e.codigo = j.error; throw e; }
  return j.data;
}
const api = (a, d) => llamar(a, d);

function toast(msg, tipo) { const t = h('div', { class: 'toast ' + (tipo || '') }, msg); document.body.append(t); setTimeout(() => t.remove(), 3200); }
async function accion(btn, fn) {
  const txt = btn && btn.textContent; if (btn) { btn.disabled = true; }
  try { return await fn(); } catch (e) { toast(e.message, 'err'); } finally { if (btn) { btn.disabled = false; btn.textContent = txt; } }
}

/* ───── sheets ───── */
let sheetEl = null;
function sheet(titulo, contenido) {
  cerrar(true);
  const back = h('div', { class: 'sheet-back', onpointerdown: e => { back._dn = e.target === back; }, onclick: e => { if (e.target === back && back._dn !== false) cerrar(); back._dn = undefined; } },   /* arrastrar para seleccionar texto y soltar afuera NO cierra */
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': titulo }, h('div', { class: 'sheet-head' }, h('h3', null, titulo), h('button', { class: 'icon', 'aria-label': 'Cerrar', onclick: () => cerrar() }, '✕')), h('div', { class: 'sheet-body' }, contenido)));
  /* Enter en un campo pasa al siguiente (como la tecla "Siguiente" del celular) en vez de enviar el formulario a medio completar */
  back.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || ['submit', 'button', 'checkbox', 'radio'].includes(e.target.type)) return;
    e.preventDefault(); const cs = [...back.querySelectorAll('input:not([type=hidden]),select,textarea')], i = cs.indexOf(e.target);
    if (i >= 0 && i < cs.length - 1) cs[i + 1].focus(); else e.target.blur();
  });
  document.body.append(back); requestAnimationFrame(() => back.classList.add('open')); sheetEl = back;
}
function cerrar(rapido) { if (!sheetEl) return; const s = sheetEl; sheetEl = null; s.classList.remove('open'); if (rapido) s.remove(); else setTimeout(() => s.remove(), 200); }
const campo = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
const inp = (name, p) => h('input', { name, ...p });
const datos = form => { const o = {}; new FormData(form).forEach((v, k) => { o[k] = v; }); form.querySelectorAll('input[type=checkbox]').forEach(c => { o[c.name] = c.checked; }); return o; };

/* ───── arranque ───── */
async function iniciar() {
  S.cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
  try { S.pub = await llamar('config', {}, 'get'); } catch (e) { S.pub = { nombre: 'Panel', colorPrincipal: '#8149bd', salones: [] }; }
  marca();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.instalar = e; if (S.user && !sheetEl && S.view === 'ajustes') render(); });
  if (S.token) { try { S.user = await api('admin.ping'); } catch (e) { S.token = ''; } }
  S.user ? await entrar() : pantallaLogin();
}
function marca() {
  document.title = 'Panel · ' + (S.pub.nombre || '');
}
function firma() { return h('div', { class: 'firma' }, 'Hecho con ', h('a', { href: 'https://www.tuweeb.com', target: '_blank', rel: 'noopener' }, 'tuweeb')); }
function logo(alto) { return h('img', { src: S.pub.logoUrl || 'weeb-logo.svg', alt: S.pub.nombre || 'tuweeb', style: 'max-height:' + alto + 'px', onerror: ev => { if (!ev.target.dataset.f) { ev.target.dataset.f = 1; ev.target.src = 'weeb-logo.svg'; } } }); }

function pantallaLogin() {
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const d = datos(f), b = $('button', f); accion(b, async () => { const r = await llamar('login', { email: d.email, clave: d.clave }); S.token = r.token; S.user = r; localStorage.setItem('weeb_token', r.token); localStorage.setItem('weeb_email', d.email); await entrar(); }); } },
    campo('Mail', inp('email', { type: 'email', required: true, autocomplete: 'username', value: localStorage.getItem('weeb_email') || '' })),
    campo('Clave', inp('clave', { type: 'password', required: true, autocomplete: 'current-password' })), h('button', { class: 'btn block' }, 'Entrar'));
  $app().replaceChildren(h('div', { class: 'login' }, logo(64), h('h1', null, S.pub.nombre || 'Panel'), h('p', { class: 'sub' }, 'Entrá para gestionar tus reservas.'), f, h('button', { type: 'button', class: 'link', onclick: () => { const m = (datos(f).email || ''); window.open('https://wa.me/5493435020970?text=' + encodeURIComponent('Hola tuweeb, olvidé la clave del panel de ' + (S.pub.nombre || 'mi salón') + (m ? '. Mi mail: ' + m : '')), '_blank', 'noopener'); } }, '¿Olvidaste tu clave?'), h('a', { class: 'link', href: '../' }, '← Volver al sitio'), firma()));
}
function salir(vencida) { S.token = ''; S.user = null; localStorage.removeItem('weeb_token'); cerrar(true); if (vencida) toast('La sesión venció. Volvé a entrar.', 'err'); pantallaLogin(); }

async function entrar() {
  await cargarBase(); render();
}
async function cargarBase() { [S.salones, S.turnos] = await Promise.all([api('admin.salones'), api('admin.turnos')]); }
const salonDe = id => (S.salones.find(s => s.id === id) || {}).nombre || '';

const VISTAS = { agenda: ['Agenda', vAgenda], reservas: ['Reservas', vReservas], caja: ['Caja', vCaja], turnos: ['Turnos', vTurnos], web: ['Mi web', vWeb], ajustes: ['Ajustes', vAjustes] };
function render() {
  const main = h('main', { class: 'wrap', id: 'vista' });
  const tabs = h('nav', { class: 'tabs' }, Object.entries(VISTAS).map(([k, [t]]) => h('button', { class: S.view === k ? 'on' : '', onclick: () => { S.view = k; render(); } }, svg(IC[k]), t)));
  $app().replaceChildren(
    h('header', { class: 'top' }, h('button', { class: 'icon', title: 'Volver al sitio', 'aria-label': 'Volver al sitio', onclick: () => { location.href = '../'; } }, '←'), logo(34), h('div', { class: 'name' }, S.pub.nombre), h('button', { class: 'icon', title: 'Salir', 'aria-label': 'Salir', onclick: () => salir() }, '⎋')),
    main, firma(), tabs);
  VISTAS[S.view][1](main);
}
const cargando = el => el.replaceChildren(h('p', { class: 'empty' }, h('img', { class: 'tw3d', src: 'tuweeb-icono.svg', alt: 'tuweeb' })));
const fab = fn => h('button', { class: 'fab', 'aria-label': 'Nueva reserva', onclick: fn }, '+');

/* ───── AGENDA ───── */
async function vAgenda(main) {
  cargando(main);
  let ag; try { ag = await api('admin.agenda', { mes: S.mes }); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const [y, m] = S.mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), off = (new Date(y, m - 1, 1).getDay() + 6) % 7, hoyF = hoy();
  const celdas = [...['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => h('div', { class: 'dow' }, d)), ...Array(off).fill(0).map(() => h('div', { class: 'day off' }))];
  let pend = 0, ocup = 0;
  for (let d = 1; d <= n; d++) {
    const f = `${S.mes}-${pad(d)}`, sl = ag.dias[f] || [];
    sl.forEach(s => { if (s.estado === 'ocupado') { ocup++; if (s.reservaEstado === 'pendiente') pend++; } });
    celdas.push(h('button', { class: 'day' + (f === hoyF ? ' hoy' : '') + (f < hoyF ? ' past' : ''), onclick: () => diaSheet(f, ag) }, h('b', null, d),
      h('div', { class: 'dots' }, sl.map(s => h('i', { class: 'dot ' + (s.estado === 'ocupado' ? (s.reservaEstado === 'pendiente' ? 'pend' : 'ocup') : s.estado === 'bloqueado' ? 'bloq' : '') })))));
  }
  main.replaceChildren(
    h('div', { class: 'bar' }, h('div', { class: 'row' }, h('button', { class: 'icon', 'aria-label': 'Mes anterior', onclick: () => { S.mes = sumMes(S.mes, -1); vAgenda(main); } }, '‹'), h('h2', null, nomMes(S.mes)), h('button', { class: 'icon', 'aria-label': 'Mes siguiente', onclick: () => { S.mes = sumMes(S.mes, 1); vAgenda(main); } }, '›')),
      h('button', { class: 'btn soft sm', onclick: () => { S.mes = mesDe(hoyF); vAgenda(main); } }, 'Hoy')),
    h('div', { class: 'cal' }, celdas),
    h('div', { class: 'legend' }, h('span', null, h('i', { class: 'dot' }), 'Libre'), h('span', null, h('i', { class: 'dot ocup' }), 'Reservado'), h('span', null, h('i', { class: 'dot pend' }), 'Pendiente de pago'), h('span', null, h('i', { class: 'dot bloq' }), 'Bloqueado')),
    h('p', { class: 'muted small' }, `${ocup} turnos reservados este mes` + (pend ? ` · ${pend} pendientes de pago` : '')), fab(() => nuevaReserva({})));
}
function diaSheet(f, ag) {
  const sl = ag.dias[f] || [], multi = S.salones.filter(s => s.activo).length > 1, cont = h('div', { class: 'list' });
  if (!sl.length) cont.append(h('p', { class: 'empty' }, 'No hay turnos configurados para este día.'));
  sl.forEach(s => {
    const info = h('div', { class: 'main' }, h('b', null, `${s.inicio} a ${s.fin}`, s.etiqueta ? ' · ' + s.etiqueta : ''), h('span', { class: 'muted small' }, (multi ? salonDe(s.salonId) + ' · ' : '') + horas(s.inicio, s.fin) + ' · ' + money(s.precio)));
    if (s.estado === 'ocupado') cont.append(h('button', { class: 'item', onclick: () => detalle(s.reservaId) }, info, h('div', null, h('div', null, s.nombre), h('span', { class: 'chip ' + s.reservaEstado }, s.reservaEstado))));
    else if (s.estado === 'bloqueado') cont.append(h('div', { class: 'item static' }, info, h('span', { class: 'muted small' }, 'Bloqueado' + (s.motivo ? ': ' + s.motivo : '')), h('button', { class: 'btn sm line', onclick: e => accion(e.target, async () => { await api('admin.desbloquear', { id: s.bloqueoId }); toast('Desbloqueado', 'ok'); cerrar(); render(); }) }, 'Desbloquear')));
    else cont.append(h('div', { class: 'item static' }, info, h('button', { class: 'btn sm', onclick: () => nuevaReserva({ fecha: f, turnoId: s.turnoId }) }, 'Reservar'),
      h('button', { class: 'btn sm line', onclick: e => accion(e.target, async () => { await api('admin.bloquear', { desde: f, salonId: s.salonId, turnoId: s.turnoId }); toast('Turno bloqueado', 'ok'); cerrar(); render(); }) }, 'Bloquear')));
  });
  cont.append(h('div', { class: 'row', style: 'margin-top:.8rem' }, h('button', { class: 'btn soft sm', onclick: () => nuevaReserva({ fecha: f }) }, 'Reserva a otra hora o fecha'),
    h('button', { class: 'btn line sm', onclick: e => bloqueoNuevo(f) }, 'Bloquear el día…')));
  sheet(flarga(f), cont);
}

/* ───── DETALLE DE RESERVA ───── */
async function detalle(id) {
  sheet('Reserva', h('p', { class: 'empty' }, h('img', { class: 'tw3d', src: 'tuweeb-icono.svg', alt: 'tuweeb' })));
  let d; try { d = await api('admin.reserva', { id }); } catch (e) { cerrar(); toast(e.message, 'err'); return; }
  const r = d.reserva, tel = r.telefono.replace(/\D/g, ''), pct = r.total ? Math.min(100, Math.round(r.pagado / r.total * 100)) : 0;
  const wa = tel ? 'https://wa.me/' + (tel.length <= 10 ? '54' + tel : tel) + '?text=' + encodeURIComponent(`Hola ${r.nombre.split(' ')[0]}! Te escribimos de ${S.pub.nombre} por tu reserva del ${flarga(r.fecha)} de ${r.inicio} a ${r.fin} hs.`) : '';
  const pf = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(pf); accion($('button', pf), async () => { await api('admin.pago', { id, monto: x.monto, metodo: x.metodo, fecha: x.fecha, nota: x.nota }); toast('Pago registrado', 'ok'); await refrescar(); detalle(id); }); } },
    h('div', { class: 'grid2' }, campo('Monto', inp('monto', { type: 'number', step: '1', required: true, value: r.estado === 'pendiente' && r.sena > r.pagado ? r.sena - r.pagado : Math.max(0, r.saldo) })),
      campo('Medio', h('select', { name: 'metodo' }, ['efectivo', 'transferencia', 'mercadopago', 'otro'].map(m => h('option', { value: m }, m === 'mercadopago' ? 'Mercado Pago' : m[0].toUpperCase() + m.slice(1))))) ),
    h('div', { class: 'grid2' }, campo('Fecha', inp('fecha', { type: 'date', value: hoy(), required: true })), campo('Nota', inp('nota', { placeholder: 'Opcional' }))),
    h('button', { class: 'btn block' }, 'Registrar pago'), h('p', { class: 'muted small' }, 'Para una devolución cargá el monto en negativo.'));
  const cuerpo = h('div', null,
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', null, r.nombre), h('span', { class: 'chip ' + r.estado }, r.estado)),
    h('dl', { class: 'kv' }, h('dt', null, 'Fecha'), h('dd', null, flarga(r.fecha)), h('dt', null, 'Horario'), h('dd', null, `${r.inicio} a ${r.fin} (${horas(r.inicio, r.fin)})` + (S.salones.length > 1 ? ' · ' + salonDe(r.salonId) : '')),
      h('dt', null, 'Contacto'), h('dd', null, r.telefono ? h('a', { href: 'tel:' + r.telefono }, r.telefono) : '—', r.email ? [' · ', h('a', { href: 'mailto:' + r.email }, r.email)] : ''),
      r.plan ? [h('dt', null, 'Plan'), h('dd', null, r.plan)] : '', h('dt', null, 'Invitados'), h('dd', null, r.personas || '—'), r.nota ? [h('dt', null, 'Nota'), h('dd', null, r.nota)] : '', h('dt', null, 'Origen'), h('dd', null, r.origen === 'manual' ? 'Cargada a mano' : 'Web'),
      r.estado === 'pendiente' && r.venceEn ? [h('dt', null, 'Vence'), h('dd', null, new Date(r.venceEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }))] : '', h('dt', null, 'Código'), h('dd', { class: 'small' }, r.id)),
    h('div', { class: 'money' }, h('div', null, h('b', null, money(r.total)), h('span', null, 'Total')), h('div', null, h('b', null, money(r.sena)), h('span', null, 'Seña')), h('div', null, h('b', null, money(r.pagado)), h('span', null, 'Pagado')), h('div', null, h('b', { class: r.saldo > 0 ? 'neg' : 'pos' }, money(r.saldo)), h('span', null, 'Saldo'))),
    h('div', { class: 'progress' }, h('i', { style: 'width:' + pct + '%' })),
    h('h3', { class: 'sec' }, 'Pagos'), d.pagos.length ? h('div', { class: 'list' }, d.pagos.map(p => h('div', { class: 'item static' }, h('div', { class: 'when' }, fcorta(p.fecha)), h('div', { class: 'main' }, h('b', null, money(p.monto)), h('span', { class: 'muted small' }, p.metodo + (p.nota ? ' · ' + p.nota : ''))),
      h('button', { class: 'icon', 'aria-label': 'Eliminar pago', onclick: e => { if (!confirm('¿Eliminar este pago?')) return; accion(e.target, async () => { await api('admin.pagoEliminar', { pagoId: p.id }); await refrescar(); detalle(id); }); } }, '🗑')))) : h('p', { class: 'muted small' }, 'Todavía no hay pagos.'),
    r.estado !== 'cancelada' && r.estado !== 'vencida' ? [h('h3', { class: 'sec' }, 'Registrar pago'), pf] : '',
    h('h3', { class: 'sec' }, 'Acciones'),
    h('div', { class: 'row' },
      r.estado === 'pendiente' ? h('button', { class: 'btn', onclick: e => accion(e.target, async () => { await api('admin.actualizarReserva', { id, estado: 'confirmada' }); toast('Reserva confirmada', 'ok'); await refrescar(); detalle(id); }) }, 'Confirmar sin pago') : '',
      r.estado === 'cancelada' || r.estado === 'vencida' ? h('button', { class: 'btn', onclick: e => accion(e.target, async () => { await api('admin.actualizarReserva', { id, estado: 'confirmada' }); toast('Reserva reactivada', 'ok'); await refrescar(); detalle(id); }) }, 'Reactivar') : '',
      h('button', { class: 'btn soft', onclick: () => editar(r) }, 'Editar / mover'), wa ? h('a', { class: 'btn soft', href: wa, target: '_blank', rel: 'noopener' }, 'WhatsApp') : '',
      r.estado !== 'cancelada' && r.estado !== 'vencida' ? h('button', { class: 'btn bad', onclick: e => { if (!confirm('¿Cancelar la reserva? El turno queda libre.')) return; accion(e.target, async () => { await api('admin.cancelar', { id }); toast('Reserva cancelada', 'ok'); await refrescar(); detalle(id); }); } }, 'Cancelar reserva') : ''));
  sheet('Reserva', cuerpo);
}
function refrescar() { cargandoSilencioso = true; return Promise.resolve().then(() => { const m = $('#vista'); if (m) VISTAS[S.view][1](m); }); }
let cargandoSilencioso = false;

function editar(r) {
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); accion($('button.btn:not(.line)', f), async () => { await api('admin.actualizarReserva', { id: r.id, nombre: x.nombre, telefono: x.telefono, email: x.email, personas: x.personas, nota: x.nota, total: x.total, sena: x.sena }); toast('Guardado', 'ok'); await refrescar(); detalle(r.id); }); } },
    campo('Nombre', inp('nombre', { required: true, value: r.nombre })), h('div', { class: 'grid2' }, campo('Teléfono', inp('telefono', { value: r.telefono })), campo('Mail', inp('email', { type: 'email', value: r.email }))),
    h('div', { class: 'grid2' }, campo('Invitados', inp('personas', { type: 'number', value: r.personas })), campo('Total $', inp('total', { type: 'number', value: r.total }))), campo('Seña $', inp('sena', { type: 'number', value: r.sena })),
    campo('Nota', h('textarea', { name: 'nota', rows: 2 }, r.nota)), h('button', { class: 'btn block' }, 'Guardar cambios'),
    h('h3', { class: 'sec' }, 'Mover a otro día o turno'), moverUI(r), h('button', { type: 'button', class: 'btn line block', style: 'margin-top:1rem', onclick: () => detalle(r.id) }, 'Volver'));
  sheet('Editar reserva', f);
}
function moverUI(r) {
  const out = h('div', { class: 'slotbtns' }), fi = inp('nuevaFecha', { type: 'date', value: r.fecha });
  const cargar = async () => { out.replaceChildren(h('img', { class: 'tw3d', src: 'tuweeb-icono.svg', alt: 'tuweeb' })); try { const ag = await api('admin.agenda', { mes: mesDe(fi.value) }); const sl = (ag.dias[fi.value] || []).filter(s => s.estado === 'libre'); out.replaceChildren(...(sl.length ? sl.map(s => h('button', { type: 'button', onclick: e => { if (!confirm(`¿Mover la reserva al ${flarga(fi.value)} de ${s.inicio} a ${s.fin}?`)) return; accion(e.target, async () => { await api('admin.actualizarReserva', { id: r.id, fecha: fi.value, turnoId: s.turnoId }); toast('Reserva movida', 'ok'); await refrescar(); detalle(r.id); }); } }, `${s.inicio} a ${s.fin}`)) : [h('span', { class: 'muted small' }, 'No hay turnos libres ese día.')])); } catch (e) { out.replaceChildren(e.message); } };
  fi.addEventListener('change', cargar); return h('div', null, campo('Nueva fecha', fi), out);
}

/* ───── NUEVA RESERVA MANUAL ───── */
function nuevaReserva(pre) {
  const st = { fecha: pre.fecha || hoy(), turnoId: pre.turnoId || '', slots: [], planes: [] };
  const planSel = h('select', { name: 'planId' }), planBox = h('span', { class: 'field', hidden: true }, h('span', { style: 'display:block;font-size:.82rem;color:var(--mute);font-weight:600;margin-bottom:.25rem' }, 'Plan'), planSel);
  const slotsEl = h('div', { class: 'slotbtns' }), fi = inp('fecha', { type: 'date', required: true, value: st.fecha }), tot = inp('total', { type: 'number', placeholder: 'Precio del turno' }), sen = inp('sena', { type: 'number', placeholder: 'Seña' });
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); if (!st.turnoId) { toast('Elegí un turno', 'err'); return; } if (st.planes.length && !planSel.value) { toast('Elegí un plan', 'err'); return; } const x = datos(f); accion($('button.btn.block', f), async () => {
    const r = await api('admin.crearReserva', { fecha: x.fecha, turnoId: st.turnoId, planId: st.planes.length ? x.planId : undefined, nombre: x.nombre, telefono: x.telefono, email: x.email, personas: x.personas, nota: x.nota, total: x.total, sena: x.sena, pago: Number(x.pagoMonto) ? { monto: x.pagoMonto, metodo: x.pagoMetodo } : undefined });
    toast('Reserva guardada', 'ok'); S.mes = mesDe(x.fecha); cerrar(); render(); detalle(r.reserva.id); }); } },
    campo('Fecha', fi), h('span', { class: 'field' }, h('span', { style: 'display:block;font-size:.82rem;color:var(--mute);font-weight:600' }, 'Turno'), slotsEl), planBox,
    campo('Nombre', inp('nombre', { required: true, placeholder: 'Quién reserva' })), h('div', { class: 'grid2' }, campo('Teléfono', inp('telefono', { type: 'tel' })), campo('Mail (opcional)', inp('email', { type: 'email' }))),
    h('div', { class: 'grid2' }, campo('Invitados', inp('personas', { type: 'number' })), campo('Total $', tot)), campo('Seña $', sen), campo('Nota', h('textarea', { name: 'nota', rows: 2 })),
    h('h3', { class: 'sec' }, '¿Ya pagó algo?'), h('div', { class: 'grid2' }, campo('Monto recibido', inp('pagoMonto', { type: 'number', placeholder: '0' })), campo('Medio', h('select', { name: 'pagoMetodo' }, h('option', { value: 'efectivo' }, 'Efectivo'), h('option', { value: 'transferencia' }, 'Transferencia'), h('option', { value: 'otro' }, 'Otro')))),
    h('button', { class: 'btn block' }, 'Guardar reserva'));
  const pintar = () => slotsEl.replaceChildren(...(st.slots.length ? st.slots.map(s => h('button', { type: 'button', class: st.turnoId === s.turnoId ? 'on' : '', onclick: () => { st.turnoId = s.turnoId; if (!st.planes.length) { tot.value = s.precio; sen.value = s.sena; } pintar(); } }, `${s.inicio} a ${s.fin}` + (S.salones.length > 1 ? ' · ' + salonDe(s.salonId) : ''))) : [h('span', { class: 'muted small' }, 'No hay turnos libres ese día. Probá con otra fecha o desbloqueá el turno.')]));
  const cargar = async () => { slotsEl.replaceChildren(h('img', { class: 'tw3d', src: 'tuweeb-icono.svg', alt: 'tuweeb' })); try { const ag = await api('admin.agenda', { mes: mesDe(fi.value) }); st.slots = (ag.dias[fi.value] || []).filter(s => s.estado === 'libre'); if (!st.slots.some(s => s.turnoId === st.turnoId)) st.turnoId = ''; else if (!st.planes.length) { const s = st.slots.find(s => s.turnoId === st.turnoId); tot.value = s.precio; sen.value = s.sena; } pintar(); } catch (e) { slotsEl.replaceChildren(e.message); } };
  const calcSena = p => p.senaTipo === 'pct' ? Math.round(p.precio * p.senaValor / 100) : p.senaTipo === 'monto' ? Math.min(p.precio, p.senaValor) : 0;
  planSel.addEventListener('change', () => { const p = st.planes.find(x => x.id === planSel.value); if (p) { tot.value = p.precio; sen.value = calcSena(p); } });
  api('admin.planes').then(l => { st.planes = l.filter(p => p.activo); if (!st.planes.length) return; planSel.replaceChildren(h('option', { value: '' }, 'Elegí un plan…'), ...st.planes.map(p => h('option', { value: p.id }, p.nombre + ' · ' + money(p.precio)))); planBox.hidden = false; tot.placeholder = 'Lo define el plan'; }).catch(() => {});
  fi.addEventListener('change', cargar); cargar(); sheet('Nueva reserva', f);
}

/* ───── RESERVAS (lista) ───── */
async function vReservas(main) {
  cargando(main);
  let lista; try { lista = await api('admin.reservas', {}); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const f0 = hoy(), q = () => S.reQ.toLowerCase();
  const filtros = { prox: ['Próximas', r => r.fecha >= f0 && (r.estado === 'confirmada' || r.estado === 'pendiente' || r.estado === 'saldada')], pend: ['Pendientes', r => r.estado === 'pendiente'], saldo: ['Con saldo', r => r.saldo > 0 && (r.estado === 'confirmada' || r.estado === 'pendiente')], pas: ['Pasadas', r => r.fecha < f0], canc: ['Canceladas', r => r.estado === 'cancelada' || r.estado === 'vencida'], todas: ['Todas', () => true] };
  const lst = h('div', { class: 'list' });
  const pintar = () => {
    const f = filtros[S.reFiltro][1], filas = lista.filter(r => f(r) && (!q() || (r.nombre + r.telefono + r.email + r.id).toLowerCase().includes(q())));
    if (S.reFiltro === 'pas' || S.reFiltro === 'canc' || S.reFiltro === 'todas') filas.reverse();
    lst.replaceChildren(...(filas.length ? filas.map(r => h('button', { class: 'item', onclick: () => detalle(r.id) }, h('div', { class: 'when' }, fcorta(r.fecha).split(' ').slice(1).join(' '), h('small', null, DIAS[parse(r.fecha).getDay()] + ' ' + r.inicio)),
      h('div', { class: 'main' }, h('b', null, r.nombre), h('span', { class: 'muted small' }, (S.salones.length > 1 ? salonDe(r.salonId) + ' · ' : '') + (r.personas ? r.personas + ' invitados' : '') + (r.origen === 'manual' ? ' · a mano' : ''))),
      h('div', { style: 'text-align:right' }, h('span', { class: 'chip ' + r.estado }, r.estado), r.saldo > 0 && r.estado !== 'cancelada' && r.estado !== 'vencida' ? h('div', { class: 'small neg' }, 'Saldo ' + money(r.saldo)) : ''))) : [h('p', { class: 'empty' }, 'No hay reservas en esta vista.')]));
  };
  const seg = h('div', { class: 'seg' }, Object.entries(filtros).map(([k, [t]]) => h('button', { class: S.reFiltro === k ? 'on' : '', onclick: e => { S.reFiltro = k; seg.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); pintar(); } }, t)));
  main.replaceChildren(h('div', { class: 'bar' }, h('h2', null, 'Reservas')), h('input', { type: 'search', placeholder: 'Buscar por nombre, teléfono o código', value: S.reQ, style: 'margin-bottom:.7rem', oninput: e => { S.reQ = e.target.value; pintar(); } }), seg, lst, fab(() => nuevaReserva({}))); pintar();
}

/* ───── CAJA ───── */
async function vCaja(main) {
  cargando(main);
  let c, res; try { [c, res] = await Promise.all([api('admin.caja', { mes: S.cajaMes }), api('admin.reservas', { desde: S.cajaMes + '-01', hasta: S.cajaMes + '-31' })]); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const nom = {}; (c.pagos || []).forEach(p => { nom[p.reservaId] = ''; });
  let todas = []; try { todas = await api('admin.reservas', {}); } catch (e) {} todas.forEach(r => { nom[r.id] = r.nombre; });
  const filas = [...c.pagos.map(p => ({ f: p.fecha, t: nom[p.reservaId] || 'Reserva', sub: 'Pago · ' + p.metodo + (p.nota ? ' · ' + p.nota : ''), m: p.monto, id: p.reservaId })), ...c.movimientos.map(x => ({ f: x.fecha, t: x.categoria || (x.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'), sub: x.descripcion, m: x.tipo === 'ingreso' ? x.monto : -x.monto, mov: x.id }))].sort((a, b) => (a.f < b.f ? 1 : -1));
  const st = (t, v, cls) => h('div', { class: 'card stat' }, h('b', { class: cls || '' }, money(v)), h('span', null, t));
  main.replaceChildren(
    h('div', { class: 'bar' }, h('div', { class: 'row' }, h('button', { class: 'icon', onclick: () => { S.cajaMes = sumMes(S.cajaMes, -1); vCaja(main); } }, '‹'), h('h2', null, nomMes(S.cajaMes)), h('button', { class: 'icon', onclick: () => { S.cajaMes = sumMes(S.cajaMes, 1); vCaja(main); } }, '›')),
      h('div', { class: 'row' }, h('button', { class: 'btn soft sm', onclick: () => csv(filas) }, 'Exportar'), h('button', { class: 'btn sm', onclick: () => movimientoNuevo() }, '+ Movimiento'))),
    h('div', { class: 'stats' }, st('Cobrado en reservas', c.ingresosReservas), st('Otros ingresos', c.ingresosExtra), st('Egresos', c.egresos, 'neg'), st('Balance del mes', c.balance, c.balance >= 0 ? 'pos' : 'neg'), st('Saldos por cobrar', c.porCobrar)),
    Object.keys(c.porMetodo).length ? h('p', { class: 'muted small' }, 'Por medio: ' + Object.entries(c.porMetodo).map(([k, v]) => `${k} ${money(v)}`).join(' · ')) : '',
    h('h3', { class: 'sec' }, 'Movimientos'), filas.length ? h('div', { class: 'list' }, filas.map(x => h('div', { class: 'item' + (x.id ? '' : ' static'), onclick: x.id ? () => detalle(x.id) : null }, h('div', { class: 'when' }, fcorta(x.f).split(' ').slice(1).join(' '), h('small', null, DIAS[parse(x.f).getDay()])), h('div', { class: 'main' }, h('b', null, x.t), h('span', { class: 'muted small' }, x.sub)), h('b', { class: x.m < 0 ? 'neg' : 'pos' }, money(x.m)),
      x.mov ? h('button', { class: 'icon', 'aria-label': 'Eliminar', onclick: e => { e.stopPropagation(); if (!confirm('¿Eliminar este movimiento?')) return; accion(e.target, async () => { await api('admin.movimientoEliminar', { id: x.mov }); vCaja(main); }); } }, '🗑') : ''))) : h('p', { class: 'empty' }, 'Sin movimientos este mes.'));
}
function csv(filas) {
  const q = s => '"' + String(s || '').replace(/"/g, '""') + '"', t = 'Fecha,Concepto,Detalle,Monto\n' + filas.map(x => [x.f, q(x.t), q(x.sub), x.m].join(',')).join('\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv' })), download: `caja-${S.cajaMes}.csv` }); document.body.append(a); a.click(); a.remove();
}
function movimientoNuevo() {
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); accion($('button', f), async () => { await api('admin.movimiento', x); toast('Guardado', 'ok'); cerrar(); S.cajaMes = mesDe(x.fecha); render(); }); } },
    h('div', { class: 'grid2' }, campo('Tipo', h('select', { name: 'tipo' }, h('option', { value: 'egreso' }, 'Egreso (gasto)'), h('option', { value: 'ingreso' }, 'Ingreso extra'))), campo('Monto', inp('monto', { type: 'number', required: true, min: '1' }))),
    h('div', { class: 'grid2' }, campo('Fecha', inp('fecha', { type: 'date', value: hoy(), required: true })), campo('Categoría', inp('categoria', { placeholder: 'Limpieza, sueldos, venta…', list: 'cats' }))), h('datalist', { id: 'cats' }, ['Limpieza', 'Sueldos', 'Insumos', 'Mantenimiento', 'Publicidad', 'Impuestos', 'Alquiler', 'Servicios', 'Venta extra'].map(c => h('option', { value: c }))),
    campo('Descripción', inp('descripcion')), h('button', { class: 'btn block' }, 'Guardar'));
  sheet('Nuevo movimiento', f);
}

/* ───── TURNOS, SALONES Y BLOQUEOS ───── */
async function vTurnos(main) {
  cargando(main); let bl; let pl = []; try { await cargarBase(); [bl, pl] = await Promise.all([api('admin.bloqueos'), api('admin.planes')]); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const sen = t => t.senaTipo === 'pct' ? t.senaValor + '% de seña' : t.senaTipo === 'monto' ? money(t.senaValor) + ' de seña' : 'Sin seña', dias = t => h('span', { class: 'small' }, [1, 2, 3, 4, 5, 6, 0].map(d => String(t.dias).split(',').includes(String(d)) ? DIAS_L[d] : '·').join(' '));
  const bloques = S.salones.map(s => h('div', null, h('div', { class: 'bar', style: 'margin:1rem 0 .5rem' }, h('h3', null, s.nombre, s.activo ? '' : ' (inactivo)'), h('div', { class: 'row' }, h('button', { class: 'btn soft sm', onclick: () => salonForm(s) }, 'Editar salón'), h('button', { class: 'btn sm', onclick: () => turnoForm({ salonId: s.id }) }, '+ Turno'))),
    h('div', { class: 'list' }, S.turnos.filter(t => t.salonId === s.id).map(t => h('button', { class: 'item', onclick: () => turnoForm(t) }, h('div', { class: 'when' }, t.inicio, h('small', null, 'a ' + t.fin)), h('div', { class: 'main' }, h('b', null, (t.etiqueta || 'Turno') + ' · ' + horas(t.inicio, t.fin)), h('span', { class: 'muted small' }, money(t.precio) + ' · ' + sen(t) + (t.desde || t.hasta ? ` · ${t.desde || ''}→${t.hasta || ''}` : ''))), dias(t), t.activo ? '' : h('span', { class: 'chip' }, 'pausado'))),
      S.turnos.some(t => t.salonId === s.id) ? '' : h('p', { class: 'empty' }, 'Este salón todavía no tiene turnos.'))));
  const fut = bl.filter(b => (b.hasta || b.desde) >= hoy()).sort((a, b) => (a.desde < b.desde ? -1 : 1));
  main.replaceChildren(h('div', { class: 'bar' }, h('h2', null, 'Turnos y bloqueos'), h('button', { class: 'btn soft sm', onclick: () => salonForm({}) }, '+ Salón')), ...bloques,
    h('div', { class: 'bar', style: 'margin:1.6rem 0 .5rem' }, h('h3', null, 'Planes'), h('button', { class: 'btn sm', onclick: () => planForm({}) }, '+ Plan')),
    h('p', { class: 'muted small', style: 'margin-bottom:.5rem' }, 'Opcional. Si cargás planes, quien reserva elige día y horario y después un plan: el precio y la seña salen del plan. Sin planes, rige el precio de cada turno.'),
    pl.length ? h('div', { class: 'list' }, pl.map(p => h('button', { class: 'item', onclick: () => planForm(p) }, h('div', { class: 'main' }, h('b', null, p.nombre), h('span', { class: 'muted small' }, money(p.precio) + ' · ' + sen(p) + (p.descripcion ? ' · ' + p.descripcion : ''))), p.activo ? '' : h('span', { class: 'chip' }, 'pausado')))) : h('p', { class: 'empty' }, 'Todavía no hay planes. Las reservas usan el precio del turno.'),
    h('div', { class: 'bar', style: 'margin:1.6rem 0 .5rem' }, h('h3', null, 'Días y turnos bloqueados'), h('button', { class: 'btn sm', onclick: () => bloqueoNuevo() }, '+ Bloquear')),
    fut.length ? h('div', { class: 'list' }, fut.map(b => h('div', { class: 'item static' }, h('div', { class: 'main' }, h('b', null, b.hasta && b.hasta !== b.desde ? `${fcorta(b.desde)} → ${fcorta(b.hasta)}` : flarga(b.desde)), h('span', { class: 'muted small' }, (b.salonId === '*' ? 'Todos los salones' : salonDe(b.salonId)) + (b.turnoId !== '*' ? ' · un turno' : ' · todo el día') + (b.motivo ? ' · ' + b.motivo : ''))),
      h('button', { class: 'btn sm line', onclick: e => accion(e.target, async () => { await api('admin.desbloquear', { id: b.id }); vTurnos(main); }) }, 'Quitar')))) : h('p', { class: 'empty' }, 'No hay bloqueos cargados.'));
}
function planForm(p) {
  const nuevo = !p.id;
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); accion($('button.btn.block', f), async () => { await api('admin.guardarPlan', { id: p.id, nombre: x.nombre, descripcion: x.descripcion, precio: x.precio, senaTipo: x.senaTipo, senaValor: x.senaValor, orden: x.orden, activo: x.activo }); toast('Plan guardado', 'ok'); cerrar(); render(); }); } },
    campo('Nombre del plan', inp('nombre', { required: true, placeholder: 'Combo Órbita', value: p.nombre || '' })), campo('Qué incluye (opcional)', h('textarea', { name: 'descripcion', rows: 3, placeholder: '4 horas, 3 animadores, mesa dulce…' }, p.descripcion || '')),
    h('div', { class: 'grid2' }, campo('Precio $', inp('precio', { type: 'number', min: '0', required: true, value: p.precio ?? '' })), campo('Seña', h('select', { name: 'senaTipo', value: p.senaTipo || 'pct' }, h('option', { value: 'pct' }, 'Porcentaje %'), h('option', { value: 'monto' }, 'Monto fijo $'), h('option', { value: 'ninguna' }, 'Sin seña ($0)')))),
    h('div', { class: 'grid2' }, campo('Valor de la seña (30 = 30%)', inp('senaValor', { type: 'number', min: '0', value: p.senaValor ?? 30 })), campo('Orden', inp('orden', { type: 'number', value: p.orden || '' }))),
    h('label', { class: 'row', style: 'margin-bottom:1rem' }, inp('activo', { type: 'checkbox', checked: p.activo !== false }), 'Plan activo (se puede elegir)'), h('button', { class: 'btn block' }, 'Guardar plan'),
    nuevo ? '' : h('button', { type: 'button', class: 'btn line block', style: 'margin-top:.6rem', onclick: e => { if (!confirm('¿Borrar este plan? Las reservas ya hechas no cambian.')) return; accion(e.target, async () => { await api('admin.borrarPlan', { id: p.id }); toast('Plan borrado', 'ok'); cerrar(); render(); }); } }, 'Borrar plan'));
  sheet(nuevo ? 'Nuevo plan' : 'Editar plan', f);
}
function salonForm(s) {
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); accion($('button', f), async () => { await api('admin.guardarSalon', { id: s.id, nombre: x.nombre, capacidad: x.capacidad, activo: x.activo, orden: x.orden }); toast('Guardado', 'ok'); cerrar(); render(); }); } },
    campo('Nombre del salón', inp('nombre', { required: true, value: s.nombre || '' })), h('div', { class: 'grid2' }, campo('Capacidad (opcional)', inp('capacidad', { type: 'number', value: s.capacidad || '' })), campo('Orden', inp('orden', { type: 'number', value: s.orden || '' }))),
    h('label', { class: 'row', style: 'margin-bottom:1rem' }, inp('activo', { type: 'checkbox', checked: s.activo !== false }), 'Salón activo (se puede reservar)'), h('button', { class: 'btn block' }, 'Guardar'));
  sheet(s.id ? 'Editar salón' : 'Nuevo salón', f);
}
function turnoForm(t) {
  const nuevo = !t.id, ds = String(t.dias || '5,6,0').split(','), ini = inp('inicio', { type: 'time', required: true, value: t.inicio || '14:00' }), fin = inp('fin', { type: 'time', required: true, value: t.fin || '18:00' });
  const dur = h('select', { 'aria-label': 'Duración' }, [['', 'Otra'], ['3', '3 horas'], ['3.5', '3 h 30'], ['4', '4 horas'], ['5', '5 horas']].map(([v, l]) => h('option', { value: v }, l)));
  const calc = () => { if (!dur.value || !ini.value) return; const m = (+ini.value.slice(0, 2) * 60 + +ini.value.slice(3) + dur.value * 60) % 1440; fin.value = pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  dur.addEventListener('change', calc); ini.addEventListener('change', calc);
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f), dd = [1, 2, 3, 4, 5, 6, 0].filter(d => x['d' + d]).join(','); accion($('button.btn.block', f), async () => { await api('admin.guardarTurno', { id: t.id, salonId: x.salonId, dias: dd, inicio: x.inicio, fin: x.fin, etiqueta: x.etiqueta, precio: x.precio, senaTipo: x.senaTipo, senaValor: x.senaValor, desde: x.desde, hasta: x.hasta, activo: x.activo }); toast('Turno guardado', 'ok'); cerrar(); render(); }); } },
    S.salones.length > 1 ? campo('Salón', h('select', { name: 'salonId', value: t.salonId }, S.salones.map(s => h('option', { value: s.id }, s.nombre)))) : h('input', { type: 'hidden', name: 'salonId', value: t.salonId || S.salones[0].id }),
    campo('Nombre del turno (opcional)', inp('etiqueta', { placeholder: 'Tarde, Noche, Mañana…', value: t.etiqueta || '' })),
    h('span', { class: 'field' }, h('span', { style: 'display:block;font-size:.82rem;color:var(--mute);font-weight:600;margin-bottom:.25rem' }, 'Días'), h('div', { class: 'days' }, [1, 2, 3, 4, 5, 6, 0].map(d => h('label', null, inp('d' + d, { type: 'checkbox', checked: ds.includes(String(d)) }), DIAS[d])))),
    h('div', { class: 'grid2' }, campo('Empieza', ini), campo('Duración', dur)), campo('Termina', fin),
    h('div', { class: 'grid2' }, campo('Precio $', inp('precio', { type: 'number', min: '0', required: true, value: t.precio ?? '' })), campo('Seña', h('select', { name: 'senaTipo', value: t.senaTipo || 'pct' }, h('option', { value: 'pct' }, 'Porcentaje %'), h('option', { value: 'monto' }, 'Monto fijo $'), h('option', { value: 'ninguna' }, 'Sin seña ($0)')))),
    campo('Valor de la seña (30 = 30% o el monto)', inp('senaValor', { type: 'number', min: '0', value: t.senaValor ?? 30 })),
    h('div', { class: 'grid2' }, campo('Vale desde (opcional)', inp('desde', { type: 'date', value: t.desde || '' })), campo('Vale hasta (opcional)', inp('hasta', { type: 'date', value: t.hasta || '' }))),
    h('label', { class: 'row', style: 'margin-bottom:1rem' }, inp('activo', { type: 'checkbox', checked: t.activo !== false }), 'Turno activo'), h('button', { class: 'btn block' }, 'Guardar turno'),
    nuevo ? '' : h('button', { type: 'button', class: 'btn line block', style: 'margin-top:.6rem', onclick: e => { if (!confirm('¿Borrar este turno? Si tiene reservas futuras solo se pausa.')) return; accion(e.target, async () => { const r = await api('admin.borrarTurno', { id: t.id }); toast(r.desactivado ? 'Tenía reservas futuras: quedó pausado' : 'Turno borrado', 'ok'); cerrar(); render(); }); } }, 'Borrar turno'));
  sheet(nuevo ? 'Nuevo turno' : 'Editar turno', f);
}
function bloqueoNuevo(fecha) {
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); accion($('button', f), async () => { await api('admin.bloquear', { desde: x.desde, hasta: x.hasta || x.desde, salonId: x.salonId, turnoId: x.turnoId, motivo: x.motivo }); toast('Bloqueado', 'ok'); cerrar(); render(); }); } },
    h('div', { class: 'grid2' }, campo('Desde', inp('desde', { type: 'date', required: true, value: fecha || hoy() })), campo('Hasta (opcional)', inp('hasta', { type: 'date' }))),
    S.salones.length > 1 ? campo('Salón', h('select', { name: 'salonId' }, h('option', { value: '*' }, 'Todos'), S.salones.map(s => h('option', { value: s.id }, s.nombre)))) : h('input', { type: 'hidden', name: 'salonId', value: '*' }),
    campo('Turno', h('select', { name: 'turnoId' }, h('option', { value: '*' }, 'Todo el día'), S.turnos.map(t => h('option', { value: t.id }, `${t.etiqueta || 'Turno'} ${t.inicio}-${t.fin}` + (S.salones.length > 1 ? ' · ' + salonDe(t.salonId) : ''))))), campo('Motivo (opcional)', inp('motivo', { placeholder: 'Feriado, mantenimiento, evento privado…' })), h('button', { class: 'btn block' }, 'Bloquear'));
  sheet('Bloquear', f);
}

/* ───── MI WEB (solo lectura: lo carga tuweeb en la hoja) ───── */
const fanio = f => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
async function vWeb(main) {
  cargando(main); let v; try { v = await api('admin.servicio'); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const est = { pagado: ['Pagado', 'confirmada'], 'en cuotas': ['En cuotas', 'pendiente'], pendiente: ['Pendiente de pago', 'pendiente'] }[v.estado] || [v.estado, ''];
  const pct = v.precioTotal ? Math.min(100, Math.round(v.pagado / v.precioTotal * 100)) : 0;
  const venc = v.vencimiento ? (v.diasParaVencer < 0 ? 'Venció el ' + fanio(v.vencimiento) : fanio(v.vencimiento) + (v.diasParaVencer <= 60 ? ` (faltan ${v.diasParaVencer} días)` : '')) : 'Se cuenta desde el primer pago';
  main.replaceChildren(h('div', { class: 'bar' }, h('h2', null, 'Mi sitio web'), h('span', { class: 'chip ' + est[1] }, est[0])),
    h('p', { class: 'muted small', style: 'margin-bottom:.8rem' }, 'Acá ves cuánto es tu servicio, qué pagaste y cuándo toca el próximo pago. Es solo para consultar: si algo no coincide, escribile a tuweeb.'),
    h('div', { class: 'money', style: '--n:3' }, h('div', null, h('b', null, money(v.precioTotal)), h('span', null, 'Total del año')), h('div', null, h('b', null, money(v.pagado)), h('span', null, 'Pagado')), h('div', null, h('b', { class: v.saldo > 0 ? 'neg' : 'pos' }, money(v.saldo)), h('span', null, 'Falta'))),
    h('div', { class: 'progress' }, h('i', { style: 'width:' + pct + '%' })),
    h('p', { class: 'muted small', style: 'margin:.6rem 0 0' }, `Se paga de contado (${money(v.precioTotal)}) o hasta en ${v.cuotas} cuotas de ${money(v.valorCuota)}.`),
    v.proximaCuota ? h('div', { class: 'item static', style: 'margin-top:.8rem' }, h('div', { class: 'main' }, h('b', null, `Próximo pago: ${money(v.proximaCuota.monto)}`), h('span', { class: 'muted small' }, `Cuota ${v.proximaCuota.numero} de ${v.cuotas} · ya pagaste ${v.cuotasPagadas}`))) : '',
    h('h3', { class: 'sec' }, 'Qué incluye'), h('ul', { class: 'small', style: 'padding-left:1.1rem;line-height:1.7' }, v.incluye.map(x => h('li', null, x))),
    h('h3', { class: 'sec' }, 'Dominio y renovación'),
    h('dl', { class: 'kv' }, h('dt', null, 'Dominio'), h('dd', null, v.dominio || 'Se registra al recibir el primer pago'), h('dt', null, 'Inicio'), h('dd', null, v.dominioInicio ? fanio(v.dominioInicio) : '—'), h('dt', null, 'Próximo pago anual'), h('dd', null, venc)),
    h('p', { class: 'muted small' }, 'El año se cuenta desde que tuweeb compra el dominio, una vez que pagás la primera cuota o el total.'),
    h('h3', { class: 'sec' }, 'Ediciones'), h('p', { class: 'small' }, `${v.edicionesRestantes} de ${v.edicionesIncluidas} ediciones simples disponibles. Las complejas se cotizan aparte.`),
    h('h3', { class: 'sec' }, 'Pagos registrados'), v.pagos.length ? h('div', { class: 'list' }, v.pagos.map(p => h('div', { class: 'item static' }, h('div', { class: 'when' }, fcorta(p.fecha)), h('div', { class: 'main' }, h('b', null, money(p.monto)), p.nota ? h('span', { class: 'muted small' }, p.nota) : '')))) : h('p', { class: 'empty' }, 'Todavía no hay pagos registrados.'));
}

/* ───── AJUSTES ───── */
async function vAjustes(main) {
  cargando(main); let c; try { c = await api('admin.config'); } catch (e) { main.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  const t = (n, l, p) => campo(l, inp(n, { value: c[n], ...p })), chk = (n, l) => h('label', { class: 'row', style: 'margin-bottom:.7rem' }, inp(n, { type: 'checkbox', checked: c[n] }), l);
  const f = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(f); ['mesesAnticipacion', 'antelacionHoras', 'holdHorasTransferencia', 'maxPendientesPorContacto'].forEach(k => { x[k] = Number(x[k]); }); accion($('button.btn.block', f), async () => { await api('admin.guardarConfig', { valores: x }); S.pub = await llamar('config', {}, 'get'); marca(); toast('Ajustes guardados', 'ok'); render(); }); } },
    h('h3', { class: 'sec' }, 'Tu negocio'), t('nombre', 'Nombre', { required: true }), t('logoUrl', 'Logo (dirección de la imagen)', { placeholder: 'https://…/logo.png' }), t('colorPrincipal', 'Color principal', { type: 'color' }), t('whatsapp', 'WhatsApp (con código de país, solo números)', { placeholder: '5491155551234' }), t('direccion', 'Dirección'), t('mapsUrl', 'Link de "Cómo llegar" (Google Maps)'),
    h('h3', { class: 'sec' }, 'Cobro por transferencia'), chk('pagoTransferencia', 'Aceptar reservas con pago por transferencia'), t('transferTitular', 'Titular de la cuenta'), t('transferAlias', 'Alias'), t('transferCbu', 'CBU / CVU'), t('transferBanco', 'Banco o billetera'), t('transferNota', 'Mensaje para el cliente (opcional)'),
    h('h3', { class: 'sec' }, 'Reglas de reserva'), h('div', { class: 'grid2' }, t('mesesAnticipacion', 'Hasta cuántos meses antes se puede reservar', { type: 'number', min: '1' }), t('antelacionHoras', 'Mínimo de horas de anticipación', { type: 'number', min: '0' })),
    h('div', { class: 'grid2' }, t('holdHorasTransferencia', 'Horas que se guarda el turno esperando la transferencia', { type: 'number', min: '1' }), t('maxPendientesPorContacto', 'Máx. reservas pendientes por persona', { type: 'number', min: '1' })), chk('autoConfirmarSinSena', 'Si el turno no tiene seña, confirmarlo automáticamente'),
    h('h3', { class: 'sec' }, 'Avisos por mail'), chk('emailsActivos', 'Mandar mails de confirmación'), t('emailAdmin', 'Mail donde recibís los avisos', { type: 'email' }), campo('Mensaje extra en el mail al cliente', h('textarea', { name: 'textoConfirmacion', rows: 2 }, c.textoConfirmacion)),
    h('button', { class: 'btn block' }, 'Guardar ajustes'));
  const cf = h('form', { onsubmit: ev => { ev.preventDefault(); const x = datos(cf); accion($('button', cf), async () => { const r = await api('admin.cambiarClave', { actual: x.actual, nueva: x.nueva }); S.token = r.token; localStorage.setItem('weeb_token', r.token); cf.reset(); toast('Clave cambiada', 'ok'); }); } },
    campo('Clave actual', inp('actual', { type: 'password', required: true, autocomplete: 'current-password' })), campo('Clave nueva (mínimo 8 caracteres)', inp('nueva', { type: 'password', required: true, minlength: '8', autocomplete: 'new-password' })), h('button', { class: 'btn line' }, 'Cambiar clave'));
  const ios = /iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone;
  const app = S.instalar ? h('button', { class: 'btn soft', onclick: async () => { S.instalar.prompt(); await S.instalar.userChoice; S.instalar = null; render(); } }, '📲 Instalar como app') : ios ? h('p', { class: 'muted small' }, '📲 Para instalar en iPhone: tocá el botón Compartir de Safari y elegí "Agregar a inicio".') : h('p', { class: 'muted small' }, 'Si tu navegador lo permite, vas a ver acá el botón para instalar el panel como app.');
  main.replaceChildren(h('div', { class: 'bar' }, h('h2', null, 'Ajustes')), h('div', { class: 'card' }, app), f, h('h3', { class: 'sec' }, 'Seguridad'), h('div', { class: 'card' }, h('p', { class: 'muted small' }, 'Sesión: ' + S.user.email), cf));
}

iniciar().catch(e => { $app().replaceChildren(h('p', { class: 'empty' }, 'No se pudo cargar el panel: ' + e.message)); });
