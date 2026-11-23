/* Hora de juego — parte pública. Una sola pieza para todos los salones:
   · en la página de hora de juego (un elemento con id="horas"): lista de días y horarios con cupo, y la reserva online con comprobante;
   · en el inicio (script con data-popup): aviso emergente chiquito cuando hay hora de juego disponible.
   Lee la dirección del sistema de ./reservar/config.json (la deja armar_cliente.py). */
(function () {
  var S = document.currentScript, BASE = (S && S.src || location.href).replace(/[^\/?#]*([?#].*)?$/, '');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var money = function (n) { return '$' + Math.round(n || 0).toLocaleString('es-AR'); };
  var fl = function (f, hoy) { var p = f.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); if (f === hoy) return 'Hoy'; var m = new Date(new Date(hoy + 'T12:00:00').getTime() + 864e5); if (f === m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-' + String(m.getDate()).padStart(2, '0')) return 'Mañana'; return DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1) + ' ' + d.getDate() + ' de ' + MES[d.getMonth()]; };
  var hoyAR = function () { return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); };
  function e(tag, attrs) { var el = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'class') el.className = attrs[k]; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k]); }); for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; [].concat(c).forEach(function (x) { if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(String(x))); }); } return el; }
  var apiP = null;
  function api() { return apiP || (apiP = window.JUEGO_API ? Promise.resolve(window.JUEGO_API) : fetch(BASE + 'reservar/config.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (c) { return c.api; })); }
  function llamar(action, data, post) {
    return api().then(function (u) {
      var req = post ? fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, data || {})) }) : fetch(u + '?' + new URLSearchParams(Object.assign({ action: action }, data || {})));
      return req.then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) { var x = new Error(j.mensaje || 'No se pudo completar. Probá de nuevo.'); x.codigo = j.error; throw x; } return j.data; });
    });
  }
  var CSS = '.jg-card{display:flex;align-items:center;gap:12px;padding:14px 16px;margin:0 0 10px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:inherit;font:inherit}.jg-card b{display:block;font-size:1.05rem;font-weight:800}.jg-card small{display:block;opacity:.8;font-size:.82rem;margin-top:2px}.jg-card .m{flex:1;min-width:0}.jg-btn{border:0;border-radius:999px;padding:.7em 1.2em;font:700 .92rem/1 inherit;font-family:inherit;background:var(--jg,#e8693a);color:#fff;cursor:pointer;white-space:nowrap}.jg-btn[disabled]{opacity:.5}.jg-btn.l{background:transparent;color:inherit;border:1px solid currentColor}.jg-claro .jg-card{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.14)}.jg-claro .jg-chip{background:rgba(0,0,0,.12)}.jg-claro .jg-chip.no{background:#7a2a2a;color:#fff}.jg-dia{margin:22px 0 8px;font-weight:800;font-size:1rem}.jg-fly{width:100%;max-width:520px;border-radius:18px;display:block;margin:0 0 16px}.jg-chip{font-size:.78rem;font-weight:700;padding:.35em .8em;border-radius:999px;background:rgba(255,255,255,.14)}.jg-chip.ok{background:#1f7a4a}.jg-chip.no{background:#7a2a2a}.jg-bk{position:fixed;inset:0;z-index:2147483000;background:rgba(10,8,24,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center}.jg-sh{width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#1c1733;color:#fff;border-radius:24px 24px 0 0;padding:20px 20px calc(22px + env(safe-area-inset-bottom));font-family:inherit;box-shadow:0 -12px 40px rgba(0,0,0,.45)}@media(min-width:600px){.jg-bk{align-items:center}.jg-sh{border-radius:24px}}.jg-sh h3{margin:0 0 4px;font-size:1.25rem}.jg-sh p{margin:.3em 0;opacity:.85;line-height:1.45}.jg-sh label{display:block;margin:12px 0 4px;font-size:.8rem;font-weight:700;opacity:.8}.jg-sh input{width:100%;box-sizing:border-box;padding:.8em 1em;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:1rem}.jg-sh .tot{display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;margin:16px 0 4px}.jg-sh .x{float:right;background:none;border:0;color:#fff;font-size:1.4rem;cursor:pointer}.jg-err{color:#ffb4b4;font-size:.9rem;min-height:1.2em;margin:8px 0 0}.jg-kv{background:rgba(255,255,255,.08);border-radius:14px;padding:10px 14px;margin:10px 0;font-size:.95rem;line-height:1.7}.jg-kv b{font-weight:800}.jg-pop{position:fixed;left:12px;right:12px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:2147482000;max-width:420px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-radius:20px;background:rgba(24,18,44,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;font-family:inherit;box-shadow:0 10px 30px rgba(0,0,0,.4);animation:jgin .5s ease both}.jg-pop b{display:block;font-size:.95rem}.jg-pop small{display:block;opacity:.85;font-size:.8rem;margin-top:2px}.jg-pop .m{flex:1;min-width:0}.jg-pop .c{background:none;border:0;color:#fff;font-size:1.2rem;opacity:.7;padding:6px;cursor:pointer}@keyframes jgin{from{opacity:0;transform:translateY(12px)}}@media(prefers-reduced-motion:reduce){.jg-pop{animation:none}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  function leerArchivo(f) {
    return new Promise(function (ok, mal) {
      var fin = function (blob, tipo) { var fr = new FileReader(); fr.onload = function () { ok({ nombre: f.name, tipo: tipo, datos: String(fr.result).split(',')[1] || '' }); }; fr.onerror = function () { mal(new Error('No pudimos leer el archivo')); }; fr.readAsDataURL(blob); };
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { if (f.size > 4.5 * 1048576) return mal(new Error('El archivo pesa demasiado (máximo 4 MB)')); return fin(f, f.type); }
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? fin(b, 'image/jpeg') : mal(new Error('No pudimos procesar la imagen')); }, 'image/jpeg', .82); };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No pudimos abrir esa imagen. Probá con otra foto o un PDF.')); };
      img.src = url;
    });
  }
  function hoja(titulo, cuerpo) {
    var bk = e('div', { class: 'jg-bk', onclick: function (ev) { if (ev.target === bk) bk.remove(); } }, e('div', { class: 'jg-sh', role: 'dialog', 'aria-label': titulo }, e('button', { class: 'x', 'aria-label': 'Cerrar', onclick: function () { bk.remove(); } }, '✕'), e('h3', null, titulo), cuerpo));
    document.body.appendChild(bk); return bk;
  }
  function wa(txt) { var n = (window.QK && QK.wa) || window.JUEGO_WA || ''; return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(txt) : ''; }
  /* ── resultado de la reserva: cómo pagar y subir el comprobante ── */
  function resultado(r, datos) {
    try { localStorage.setItem('juego-ultima', JSON.stringify({ id: r.id, codigo: r.codigo })); } catch (x) {}
    var cont = e('div'), msg = e('p', { class: 'jg-err' });
    function pintar(r) {
      cont.replaceChildren();
      var t = r.transferencia;
      cont.append(e('div', { class: 'jg-kv' }, e('div', null, e('b', null, fl(r.fecha, hoyAR())), ' · ', r.inicio + ' a ' + r.fin + ' hs'), e('div', null, r.salon), e('div', null, r.chicos + (r.chicos === 1 ? ' chico' : ' chicos') + ' · total ', e('b', null, money(r.total))), e('div', null, 'Tu código: ', e('b', { style: 'letter-spacing:.16em' }, r.codigo))));
      if (r.estado === 'confirmada' || r.estado === 'saldada') { cont.append(e('p', null, '¡Listo! Tu lugar está confirmado. Te esperamos.')); return; }
      if (r.estado === 'vencida' || r.estado === 'cancelada') { cont.append(e('p', null, 'Esta reserva ya no está activa. Podés hacer otra o escribirnos.')); return; }
      cont.append(e('p', null, 'Para confirmar tu lugar, transferí ', e('b', null, money(t ? t.importe : r.total)), ' y subí el comprobante. Te guardamos el lugar hasta ' + new Date(r.venceEn).toLocaleString('es-AR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '') + ' hs.'));
      if (t && (t.alias || t.cbu)) cont.append(e('div', { class: 'jg-kv' }, t.titular ? e('div', null, 'Titular: ', e('b', null, t.titular)) : '', t.alias ? e('div', null, 'Alias: ', e('b', null, t.alias)) : '', t.cbu ? e('div', null, 'CBU/CVU: ', e('b', null, t.cbu)) : '', t.banco ? e('div', null, t.banco) : ''));
      if (r.comprobante) cont.append(e('p', null, '✔ Recibimos tu comprobante. En cuanto lo revisemos, te confirmamos.'));
      var fi = e('input', { type: 'file', accept: 'image/*,application/pdf', style: 'display:none' }), b = e('button', { class: 'jg-btn', onclick: function () { fi.click(); } }, r.comprobante ? 'Subir otro comprobante' : 'Subir comprobante');
      fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (!f) return; b.disabled = true; b.textContent = 'Subiendo…'; msg.textContent = ''; leerArchivo(f).then(function (a) { return llamar('comprobanteJuego', { id: r.id, nombre: a.nombre, tipo: a.tipo, datos: a.datos }, true); }).then(function (n) { pintar(n); }).catch(function (x) { msg.textContent = x.message; b.disabled = false; b.textContent = 'Subir comprobante'; }); });
      cont.append(e('div', { style: 'margin-top:12px' }, b, fi));
      var w = wa('Hola! Anoté a mis chicos en la hora de juego (código ' + r.codigo + ').'); if (w) cont.append(e('p', { style: 'margin-top:14px' }, e('a', { href: w, target: '_blank', rel: 'noopener', style: 'color:inherit' }, 'Prefiero mandarlo por WhatsApp')));
    }
    pintar(r); cont.append(msg); return cont;
  }
  /* ── reservar un horario ── */
  function reservar(s, precio, alFinal) {
    var f = e('form', { novalidate: '' }), err = e('p', { class: 'jg-err' }), tot = e('b', null, money(precio));
    var nom = e('input', { name: 'nombre', autocomplete: 'name', placeholder: 'Nombre y apellido', required: '' }), tel = e('input', { name: 'telefono', type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: 'Con código de área', required: '' });
    var ch = e('input', { name: 'chicos', type: 'number', min: '1', max: String(s.libres), value: '1', inputmode: 'numeric' }), web = e('input', { name: 'web', tabindex: '-1', autocomplete: 'off', style: 'position:absolute;left:-9999px', 'aria-hidden': 'true' });
    var go = e('button', { class: 'jg-btn', style: 'width:100%;margin-top:12px;padding:1em' }, 'Anotar a mis chicos');
    var act = function () { var n = Math.max(0, Math.min(s.libres, parseInt(ch.value, 10) || 0)); tot.textContent = money(n * (s.precio || precio)); }; ch.addEventListener('input', act); act();
    f.append(e('p', null, fl(s.fecha, hoyAR()) + ' · ' + s.inicio + ' a ' + s.fin + ' hs · ' + s.salon), e('label', null, 'Tu nombre (adulto responsable)'), nom, e('label', null, 'Tu WhatsApp'), tel, e('label', null, 'Cantidad de chicos (quedan ' + s.libres + ' lugares)'), ch, web, e('div', { class: 'tot' }, e('span', null, 'Total'), tot), e('p', { style: 'font-size:.82rem;opacity:.75' }, 'Pagás por transferencia y subís el comprobante en el paso siguiente.'), err, go);
    var bk = hoja('Hora de juego', f);
    f.addEventListener('submit', function (ev) { ev.preventDefault(); err.textContent = ''; go.disabled = true; go.textContent = 'Un momento…';
      llamar('reservarJuego', { fecha: s.fecha, salonId: s.salonId, turnoId: s.turnoId, nombre: nom.value, telefono: tel.value, chicos: parseInt(ch.value, 10), web: web.value }, true).then(function (r) { bk.querySelector('.jg-sh').replaceChildren(e('button', { class: 'x', onclick: function () { bk.remove(); alFinal && alFinal(); } }, '✕'), e('h3', null, '¡Anotados!'), resultado(r)); }).catch(function (x) { err.textContent = x.message; go.disabled = false; go.textContent = 'Anotar a mis chicos'; if (x.codigo === 'COMPLETO' || x.codigo === 'CUPO' || x.codigo === 'NO_DISPONIBLE') alFinal && alFinal(); });
    });
  }
  function miReserva(codigo) { return llamar('estadoJuego', { codigo: codigo }).then(function (r) { hoja('Tu reserva', resultado(r)); }); }
  /* ── página de hora de juego ── */
  function pagina(box) {
    var m = /(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(box).color || ''); if (m && (+m[1] * .299 + +m[2] * .587 + +m[3] * .114) < 128) box.classList.add('jg-claro');   // texto oscuro = fondo claro
    box.textContent = 'Cargando horarios…';
    var pintar = function () {
      llamar('juego').then(function (d) {
        box.replaceChildren();
        if (d.flyer) box.append(e('img', { class: 'jg-fly', src: d.flyer, alt: 'Hora de juego', loading: 'lazy' }));
        if (!d.activo) { box.append(e('p', null, 'Por ahora no hay hora de juego online. Escribinos por WhatsApp y te contamos.')); return; }
        box.append(e('p', null, (d.texto || 'Los chicos juegan ' + (d.duracion || '2 horas') + ' en el salón.') + ' ' + money(d.precio) + ' por chico.'));
        var ult = null; try { ult = JSON.parse(localStorage.getItem('juego-ultima') || 'null'); } catch (x) {}
        var cod = e('button', { class: 'jg-btn l', style: 'margin:6px 0 4px', onclick: function () { var c = (ult && ult.codigo) || prompt('Ingresá tu código de reserva'); if (c) miReserva(c).catch(function (x) { alert(x.message); }); } }, 'Ver mi reserva'); box.append(cod);
        if (!d.slots.length) { box.append(e('p', { style: 'margin-top:14px' }, 'Todavía no hay horarios abiertos. Pasate de nuevo en unos días o escribinos por WhatsApp.')); return; }
        var por = {}, hoy = hoyAR(); d.slots.forEach(function (s) { (por[s.fecha] = por[s.fecha] || []).push(s); });
        Object.keys(por).sort().forEach(function (f) {
          box.append(e('div', { class: 'jg-dia' }, fl(f, hoy)));
          por[f].forEach(function (s) {
            box.append(e('div', { class: 'jg-card' }, e('div', { class: 'm' }, e('b', null, s.inicio + ' a ' + s.fin + ' hs'), e('small', null, s.salon + (s.nota ? ' · ' + s.nota : '')), e('small', null, s.completo ? 'Completo' : 'Quedan ' + s.libres + (s.libres === 1 ? ' lugar' : ' lugares') + ' · ' + money(s.precio) + ' por chico')),
              s.completo ? e('span', { class: 'jg-chip no' }, 'Completo') : e('button', { class: 'jg-btn', onclick: function () { reservar(s, d.precio, pintar); } }, 'Anotar')));
          });
        });
      }).catch(function () { box.replaceChildren(e('p', null, 'No pudimos cargar los horarios ahora. Probá de nuevo en un momento o escribinos por WhatsApp.'), e('button', { class: 'jg-btn l', onclick: pintar }, 'Reintentar')); });
    };
    pintar();
    var q = new URLSearchParams(location.search).get('codigo'); if (q) miReserva(q).catch(function () {});
  }
  /* ── aviso emergente en el inicio ── */
  function aviso() {
    try { if (sessionStorage.getItem('juego-pop-x')) return; } catch (x) {}
    llamar('juego').then(function (d) {
      if (!d.activo || d.popup === false) return;
      var libres = d.slots.filter(function (s) { return !s.completo; }); if (!libres.length) return;
      var s = libres[0], total = libres.reduce(function (a, x) { return a + x.libres; }, 0), pag = (S && S.getAttribute('data-pagina')) || 'hora-de-juego.html';
      var pop = e('div', { class: 'jg-pop', role: 'status' }, e('div', { class: 'm' }, e('b', null, 'Hora de juego disponible'), e('small', null, fl(s.fecha, hoyAR()) + ' · ' + s.inicio + ' hs · ' + s.salon + (libres.length > 1 ? ' y más horarios' : ''))),
        e('a', { class: 'jg-btn', href: BASE + pag, style: 'text-decoration:none;padding:.7em 1em' }, 'Ver'), e('button', { class: 'c', 'aria-label': 'Cerrar aviso', onclick: function () { pop.remove(); try { sessionStorage.setItem('juego-pop-x', '1'); } catch (x) {} } }, '✕'));
      document.body.appendChild(pop);
    }).catch(function () {});
  }
  function iniciar() {
    var box = $('#horas'); if (box) pagina(box);
    if (S && S.hasAttribute('data-popup')) { var go = function () { setTimeout(aviso, 3500); }; if (document.readyState === 'complete') go(); else addEventListener('load', go); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
