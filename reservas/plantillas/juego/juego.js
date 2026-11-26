/* hs de juego — parte pública. Una sola pieza para todos los salones:
   · en la página hs-de-juego (un elemento con id="horas"): título, cómo funciona, días y horarios con mesas libres, y la reserva online con comprobante;
   · en el inicio (script con data-popup): aviso emergente chiquito cuando hay hs de juego disponibles.
   Cada familia que se anota ocupa UNA mesa (el cupo se cuenta en mesas, no en niños). Cada niño paga el precio fijado; los adultos no pagan.
   Lee la dirección del sistema de ./reservar/config.json (la deja armar_cliente.py). */
(function () {
  const S = document.currentScript, BASE = (S && S.src || location.href).replace(/[^\/?#]*([?#].*)?$/, '');
  const $ = (s, r) => (r || document).querySelector(s);
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const money = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const fl = (f, hoy) => { const p = f.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); if (f === hoy) return 'Hoy'; if (f === ymd(new Date(new Date(hoy + 'T12:00:00').getTime() + 864e5))) return 'Mañana'; return DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1) + ' ' + d.getDate() + ' de ' + MES[d.getMonth()]; };
  const urlOk = u => /^(https?:\/\/|\.{0,2}\/|data:image\/)/i.test(String(u || '')) || /^[\w\-./]+\.(png|jpe?g|webp|gif|avif)$/i.test(String(u || ''));
  function e(tag, attrs) { const el = document.createElement(tag); Object.keys(attrs || {}).forEach(k => { if (k === 'class') el.className = attrs[k]; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k]); }); for (let i = 2; i < arguments.length; i++) [].concat(arguments[i]).forEach(x => { if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(String(x))); }); return el; }
  let cfgP = null;
  const cfg = () => cfgP || (cfgP = (window.JUEGO_API ? Promise.resolve({ api: window.JUEGO_API }) : fetch(BASE + 'reservar/config.json', { cache: 'no-cache' }).then(r => r.json())));
  const api = () => cfg().then(c => c.api);
  function llamar(action, data, post) {
    return cfg().then(c => {
      const u = c.api, cl = c.cliente ? { cl: c.cliente } : {};
      const req = post ? fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, cl, data || {})) }) : fetch(u + '?' + new URLSearchParams(Object.assign({ action }, cl, data || {})));
      return req.then(r => r.json()).then(j => { if (!j.ok) { const x = new Error(j.mensaje || 'No se pudo completar. Probá de nuevo.'); x.codigo = j.error; throw x; } return j.data; });
    });
  }
  const CSS = `
.jg-root,.jg-bk,.jg-pop{--jb:var(--brand,#e8693a);--jbi:var(--brand-ink,#fff);--jink:var(--ink,#fff);--jmute:var(--mute,rgba(255,255,255,.74));--jline:var(--line2,rgba(255,255,255,.24));--jglow:var(--glow,rgba(232,105,58,.38));--jwarn:#f4cf6a}
.jg-root{color:var(--jink);font-family:inherit}
.jg-hero{margin:.2rem 0 1.1rem;animation:jgup .5s ease both}.jg-hero h1{margin:0 0 .35rem;font-size:1.7rem;font-weight:800;letter-spacing:.01em}.jg-hero p{margin:0 0 .8rem;color:var(--jmute);line-height:1.5}
.jg-price{display:inline-flex;align-items:baseline;gap:.5rem;padding:.55rem 1rem;border-radius:999px;background:var(--jb);color:var(--jbi);font-weight:700;box-shadow:0 0 22px -6px var(--jglow)}.jg-price b{font-size:1.25rem;font-weight:800}
.jg-how{list-style:none;margin:1.1rem 0 .4rem;padding:0;display:grid;gap:.55rem}.jg-how li{display:flex;gap:.8rem;align-items:center;padding:.7rem .9rem;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid var(--jline);font-size:.92rem;line-height:1.35;animation:jgup .5s ease both}.jg-how li:nth-child(2){animation-delay:.08s}.jg-how li:nth-child(3){animation-delay:.16s}
.jg-how i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--jb);color:var(--jbi);font-style:normal;font-weight:800;font-size:.85rem}
.jg-fly{width:100%;border-radius:18px;display:block;margin:0 0 1rem;animation:jgup .5s ease both}
.jg-dia{margin:1.5rem 0 .6rem;font-weight:800;font-size:1.02rem}
.jg-leg{display:flex;flex-wrap:wrap;gap:.4rem .9rem;margin:.9rem 0 0;font-size:.82rem;color:var(--jmute)}.jg-leg span{display:inline-flex;align-items:center;gap:.4rem}.jg-leg i{width:11px;height:11px;border-radius:50%;background:var(--c,var(--jb))}
.jg-card{position:relative;display:flex;gap:.9rem;align-items:center;padding:.95rem 1rem .95rem 1.15rem;margin:0 0 .65rem;border-radius:18px;background:rgba(255,255,255,.09);border:1px solid var(--jline);overflow:hidden;animation:jgup .45s ease both;animation-delay:calc(var(--i,0)*45ms)}
.jg-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--c,var(--jb))}
.jg-card .m{flex:1;min-width:0}.jg-card b{display:block;font-size:1.08rem;font-weight:800}.jg-card small{display:block;color:var(--jmute);font-size:.82rem;margin-top:2px}
.jg-meter{height:7px;border-radius:99px;background:rgba(255,255,255,.14);margin:.55rem 0 .25rem;overflow:hidden}.jg-meter i{display:block;height:100%;border-radius:99px;background:var(--c,var(--jb));transform-origin:left;animation:jgfill .8s .2s ease both}.jg-meter.poco i{background:var(--jwarn)}
.jg-btn{border:0;border-radius:999px;padding:.78em 1.25em;font:700 .92rem/1 inherit;font-family:inherit;background:var(--jb);color:var(--jbi);cursor:pointer;white-space:nowrap;transition:transform .15s,box-shadow .2s,opacity .2s;text-decoration:none;display:inline-block;text-align:center}
.jg-btn:hover{box-shadow:0 0 20px -4px var(--jglow)}.jg-btn:active{transform:scale(.97)}.jg-btn[disabled]{opacity:.5;cursor:default}.jg-btn.l{background:transparent;color:inherit;border:1px solid currentColor}
.jg-chip{font-size:.78rem;font-weight:700;padding:.4em .85em;border-radius:999px;background:rgba(255,255,255,.14);white-space:nowrap}.jg-chip.no{background:#7a2a2a;color:#fff}
.jg-vacio{padding:1.4rem 1.1rem;border-radius:18px;background:rgba(255,255,255,.07);border:1px dashed var(--jline);text-align:center;line-height:1.5;animation:jgup .5s ease both}
.jg-bk{position:fixed;inset:0;z-index:2147483000;background:rgba(10,8,24,.62);display:flex;align-items:flex-end;justify-content:center;animation:jgfade .25s ease both}
.jg-sh{width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#1c1733;color:#fff;border-radius:24px 24px 0 0;padding:20px 20px calc(24px + env(safe-area-inset-bottom));font-family:inherit;box-shadow:0 -12px 40px rgba(0,0,0,.45);animation:jgsheet .35s cubic-bezier(.2,.8,.2,1) both}
@media(min-width:600px){.jg-bk{align-items:center}.jg-sh{border-radius:24px}}
.jg-sh h3{margin:0 0 4px;font-size:1.25rem}.jg-sh p{margin:.3em 0;opacity:.88;line-height:1.45}.jg-sh .x{float:right;background:none;border:0;color:#fff;font-size:1.4rem;cursor:pointer}
.jg-sh label{display:block;margin:13px 0 4px;font-size:.8rem;font-weight:700;opacity:.85}
.jg-sh input{width:100%;box-sizing:border-box;padding:.8em 1em;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:1rem}.jg-sh input:focus{outline:2px solid var(--jb);outline-offset:1px}
.jg-quien{display:flex;gap:.7rem;align-items:center;padding:.7rem .9rem;border-radius:14px;background:rgba(255,255,255,.08);margin:.6rem 0 .2rem;border-left:5px solid var(--c,var(--jb))}.jg-quien b{display:block}.jg-quien small{opacity:.8}
.jg-par{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
.jg-st{display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);border-radius:14px;padding:.3rem}
.jg-st button{width:40px;height:40px;border-radius:11px;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:1.3rem;font-weight:700;cursor:pointer;transition:transform .12s}.jg-st button:active{transform:scale(.9)}.jg-st output{font-weight:800;font-size:1.15rem;min-width:2ch;text-align:center}
.jg-tope{font-size:.74rem;opacity:.7;margin-top:3px}
.jg-sh .tot{display:flex;justify-content:space-between;align-items:baseline;font-weight:800;font-size:1.15rem;margin:16px 0 2px}.jg-sh .tot small{font-weight:500;opacity:.75;font-size:.8rem}
.jg-err{color:#ffb4b4;font-size:.9rem;min-height:1.2em;margin:8px 0 0}
.jg-kv{background:rgba(255,255,255,.08);border-radius:14px;padding:10px 14px;margin:10px 0;font-size:.95rem;line-height:1.7}.jg-kv b{font-weight:800}
.jg-pago{border:1px solid var(--jb);border-radius:16px;padding:12px 14px;margin:12px 0;background:rgba(255,255,255,.05)}.jg-pago .al{display:flex;gap:.6rem;align-items:center;justify-content:space-between;margin-top:6px}.jg-pago .al b{font-size:1.1rem;word-break:break-all}
.jg-ok{display:block;margin:4px auto 10px}.jg-ok circle{stroke:var(--jb);stroke-width:3;fill:none;stroke-dasharray:166;stroke-dashoffset:166;animation:jgdraw .6s .1s ease forwards}.jg-ok path{stroke:var(--jb);stroke-width:4;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:48;stroke-dashoffset:48;animation:jgdraw .4s .6s ease forwards}
.jg-cod{letter-spacing:.16em}
.jg-pop{position:fixed;left:12px;right:12px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:2147482000;max-width:420px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-radius:20px;background:rgba(24,18,44,.88);color:#fff;font-family:inherit;box-shadow:0 10px 30px rgba(0,0,0,.4);animation:jgup .5s ease both}.jg-pop b{display:block;font-size:.95rem}.jg-pop small{display:block;opacity:.85;font-size:.8rem;margin-top:2px}.jg-pop .m{flex:1;min-width:0}.jg-pop .c{background:none;border:0;color:#fff;font-size:1.2rem;opacity:.7;padding:6px;cursor:pointer}
@keyframes jgup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes jgfade{from{opacity:0}to{opacity:1}}@keyframes jgsheet{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@keyframes jgfill{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes jgdraw{to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){.jg-hero,.jg-how li,.jg-fly,.jg-card,.jg-vacio,.jg-pop,.jg-bk,.jg-sh,.jg-meter i,.jg-ok circle,.jg-ok path{animation:none!important}.jg-ok circle,.jg-ok path{stroke-dashoffset:0}}`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  function leerArchivo(f) {
    return new Promise((ok, mal) => {
      const fin = (blob, tipo) => { const fr = new FileReader(); fr.onload = () => ok({ nombre: f.name, tipo, datos: String(fr.result).split(',')[1] || '' }); fr.onerror = () => mal(new Error('No pudimos leer el archivo')); fr.readAsDataURL(blob); };
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { if (f.size > 4.5 * 1048576) return mal(new Error('El archivo pesa demasiado (máximo 4 MB)')); return fin(f, f.type); }
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => { b ? fin(b, 'image/jpeg') : mal(new Error('No pudimos procesar la imagen')); }, 'image/jpeg', .82); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No pudimos abrir esa imagen. Probá con otra foto o un PDF.')); };
      img.src = url;
    });
  }
  function hoja(titulo, cuerpo) {
    const bk = e('div', { class: 'jg-bk', onclick: ev => { if (ev.target === bk) bk.remove(); } }, e('div', { class: 'jg-sh', role: 'dialog', 'aria-label': titulo }, e('button', { class: 'x', 'aria-label': 'Cerrar', onclick: () => bk.remove() }, '✕'), e('h3', null, titulo), cuerpo));
    document.body.appendChild(bk); return bk;
  }
  let pubP = null; const pub = () => pubP || (pubP = llamar('config').catch(() => ({})));
  const waNum = () => pub().then(p => String((window.QK && QK.wa) || window.JUEGO_WA || p.whatsapp || '').replace(/\D/g, ''));
  const colorDe = (c, id) => (c && c.colores && c.colores[id]) || '';
  /* ── resultado de la reserva: cómo pagar y subir el comprobante ── */
  function resultado(r) {
    try { localStorage.setItem('juego-ultima', JSON.stringify({ id: r.id, codigo: r.codigo })); } catch (x) {}
    const cont = e('div'), msg = e('p', { class: 'jg-err' });
    function pintar(r) {
      cont.replaceChildren();
      const t = r.transferencia, ok = r.estado === 'confirmada' || r.estado === 'saldada';
      const tilde = e('div', { 'aria-hidden': 'true' }); tilde.innerHTML = '<svg class="jg-ok" width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26.5"/><path d="M16 29l8 8 16-17"/></svg>'; cont.append(tilde);
      cont.append(e('p', { style: 'text-align:center;font-weight:800;font-size:1.05rem;margin:0 0 6px' }, ok ? '¡Tu mesa está confirmada!' : r.estado === 'vencida' || r.estado === 'cancelada' ? 'Esta reserva ya no está activa' : '¡Mesa reservada! Falta el pago'));
      cont.append(e('div', { class: 'jg-kv' }, e('div', null, e('b', null, fl(r.fecha, hoyAR())), ' · ', r.inicio + ' a ' + r.fin + ' hs'), e('div', null, r.salon), e('div', null, (r.adultos || 0) + (r.adultos === 1 ? ' adulto' : ' adultos') + ' · ' + r.chicos + (r.chicos === 1 ? ' niño' : ' niños')), e('div', null, 'Total ', e('b', null, money(r.total))), e('div', null, 'Tu código: ', e('b', { class: 'jg-cod' }, r.codigo))));
      if (ok) { cont.append(e('p', null, 'Te esperamos. Si algo cambia, escribinos por WhatsApp.')); return; }
      if (r.estado === 'vencida' || r.estado === 'cancelada') { cont.append(e('p', null, 'Podés hacer otra reserva o escribirnos.')); return; }
      cont.append(e('p', null, 'Para confirmar tu mesa, transferí ', e('b', null, money(t ? t.importe : r.total)), ' y subí el comprobante (o mandalo por WhatsApp). Te guardamos la mesa hasta ' + new Date(r.venceEn).toLocaleString('es-AR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '') + ' hs.'));
      if (t && (t.alias || t.cbu)) {
        const copiar = (txt, b) => { try { navigator.clipboard.writeText(txt).then(() => { const o = b.textContent; b.textContent = '¡Copiado!'; setTimeout(() => { b.textContent = o; }, 1400); }); } catch (x) {} };
        cont.append(e('div', { class: 'jg-pago' }, t.titular ? e('div', null, 'Titular: ', e('b', null, t.titular)) : '', t.banco ? e('div', null, t.banco) : '',
          t.alias ? e('div', { class: 'al' }, e('span', null, 'Alias ', e('b', null, t.alias)), e('button', { class: 'jg-btn l', style: 'padding:.55em .9em', onclick: ev => copiar(t.alias, ev.currentTarget) }, 'Copiar')) : '',
          t.cbu ? e('div', { class: 'al' }, e('span', null, 'CBU/CVU ', e('b', null, t.cbu)), e('button', { class: 'jg-btn l', style: 'padding:.55em .9em', onclick: ev => copiar(t.cbu, ev.currentTarget) }, 'Copiar')) : '', t.nota ? e('div', { style: 'opacity:.8;font-size:.85rem;margin-top:6px' }, t.nota) : ''));
      }
      if (r.comprobante) cont.append(e('p', null, '✔ Recibimos tu comprobante. En cuanto lo revisemos, te confirmamos por mail.'));
      const fi = e('input', { type: 'file', accept: 'image/*,application/pdf', style: 'display:none' }), b = e('button', { class: 'jg-btn', style: 'width:100%;padding:1em', onclick: () => fi.click() }, r.comprobante ? 'Subir otro comprobante' : 'Subir comprobante');
      fi.addEventListener('change', () => { const f = fi.files && fi.files[0]; if (!f) return; b.disabled = true; b.textContent = 'Subiendo…'; msg.textContent = ''; leerArchivo(f).then(a => llamar('comprobanteJuego', { id: r.id, nombre: a.nombre, tipo: a.tipo, datos: a.datos }, true)).then(n => pintar(n)).catch(x => { msg.textContent = x.message; b.disabled = false; b.textContent = 'Subir comprobante'; }); });
      cont.append(e('div', { style: 'margin-top:12px' }, b, fi));
      const wb = e('a', { class: 'jg-btn l', style: 'width:100%;box-sizing:border-box;margin-top:8px;padding:1em;display:none', target: '_blank', rel: 'noopener' }, 'Prefiero mandarlo por WhatsApp');
      cont.append(wb); waNum().then(n => { if (n) { wb.href = 'https://wa.me/' + n + '?text=' + encodeURIComponent('Hola! Reservé una mesa en hs de juego (código ' + r.codigo + ') para el ' + fl(r.fecha, hoyAR()) + ' a las ' + r.inicio + '. Te mando el comprobante.'); wb.style.display = 'block'; } });
      cont.append(e('p', { style: 'font-size:.82rem;opacity:.75;margin-top:12px' }, 'Te mandamos un mail con el código y estos datos.'));
    }
    pintar(r); cont.append(msg); return cont;
  }
  /* ── reservar un horario ── */
  function paso(min, max, val, alCambiar) {
    const o = e('output', null, String(val)), mas = e('button', { type: 'button', 'aria-label': 'Sumar' }, '+'), menos = e('button', { type: 'button', 'aria-label': 'Restar' }, '−');
    const set = n => { val = Math.max(min, Math.min(max, n)); o.textContent = val; menos.disabled = val <= min; mas.disabled = val >= max; alCambiar && alCambiar(val); };
    menos.addEventListener('click', () => set(val - 1)); mas.addEventListener('click', () => set(val + 1)); set(val);
    const w = e('div', { class: 'jg-st' }, menos, o, mas); w.valor = () => val; return w;
  }
  function reservar(s, precio, color, alFinal) {
    const f = e('form', { novalidate: '' }), err = e('p', { class: 'jg-err' }), tot = e('b', null, ''), det = e('small', null, '');
    const nom = e('input', { name: 'nombre', autocomplete: 'name', placeholder: 'Nombre y apellido', required: '' }), tel = e('input', { name: 'telefono', type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: 'Con código de área', required: '' }), mail = e('input', { name: 'email', type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'Para mandarte la confirmación', required: '' });
    const web = e('input', { name: 'web', tabindex: '-1', autocomplete: 'off', style: 'position:absolute;left:-9999px', 'aria-hidden': 'true' }), pr = s.precio || precio;
    let ni = null;
    const act = () => { const n = ni ? ni.valor() : 1; tot.textContent = money(n * pr); det.textContent = n + (n === 1 ? ' niño × ' : ' niños × ') + money(pr); };
    const ad = paso(0, s.adultosMax > 0 ? s.adultosMax : 20, 1); ni = paso(1, s.ninosMax > 0 ? s.ninosMax : 30, 1, act);
    const go = e('button', { class: 'jg-btn', style: 'width:100%;margin-top:12px;padding:1em' }, 'Reservar mi mesa');
    f.append(e('div', { class: 'jg-quien', style: color ? '--c:' + color : '' }, e('div', null, e('b', null, fl(s.fecha, hoyAR()) + ' · ' + s.inicio + ' a ' + s.fin + ' hs'), e('small', null, s.salon + (s.nota ? ' · ' + s.nota : '')))),
      s.flyer && urlOk(s.flyer) ? e('img', { class: 'jg-fly', src: s.flyer, alt: '', loading: 'lazy', style: 'margin-top:.7rem' }) : '',
      e('label', null, 'Tu nombre (adulto responsable)'), nom, e('label', null, 'Tu WhatsApp'), tel, e('label', null, 'Tu mail'), mail,
      e('div', { class: 'jg-par' }, e('div', null, e('label', null, 'Adultos'), ad, s.adultosMax > 0 ? e('div', { class: 'jg-tope' }, 'Hasta ' + s.adultosMax + ' por mesa') : ''), e('div', null, e('label', null, 'Niños'), ni, s.ninosMax > 0 ? e('div', { class: 'jg-tope' }, 'Hasta ' + s.ninosMax + ' por mesa') : '')),
      web, e('div', { class: 'tot' }, e('span', null, 'Total'), tot), e('div', { style: 'text-align:right' }, det), e('p', { style: 'font-size:.82rem;opacity:.75' }, 'Reservás una mesa para tu grupo. Pagás por transferencia y subís el comprobante en el paso siguiente.'), err, go);
    act(); const bk = hoja('Reservar mi mesa', f);
    f.addEventListener('submit', ev => {
      ev.preventDefault(); err.textContent = '';
      if (nom.value.trim().length < 2) { err.textContent = 'Escribí tu nombre.'; return nom.focus(); }
      if (tel.value.replace(/\D/g, '').length < 6) { err.textContent = 'Revisá tu WhatsApp.'; return tel.focus(); }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.value.trim())) { err.textContent = 'Escribí un mail válido para mandarte la confirmación.'; return mail.focus(); }
      go.disabled = true; go.textContent = 'Un momento…';
      llamar('reservarJuego', { fecha: s.fecha, salonId: s.salonId, turnoId: s.turnoId, nombre: nom.value, telefono: tel.value, email: mail.value.trim(), adultos: ad.valor(), chicos: ni.valor(), web: web.value }, true)
        .then(r => { bk.querySelector('.jg-sh').replaceChildren(e('button', { class: 'x', 'aria-label': 'Cerrar', onclick: () => { bk.remove(); alFinal && alFinal(); } }, '✕'), e('h3', null, 'Listo'), resultado(r)); alFinal && alFinal(); })
        .catch(x => { err.textContent = x.message; go.disabled = false; go.textContent = 'Reservar mi mesa'; if (['COMPLETO', 'NO_DISPONIBLE'].indexOf(x.codigo) >= 0) alFinal && alFinal(); });
    });
  }
  function miReserva(codigo) { return llamar('estadoJuego', { codigo }).then(r => { hoja('Tu reserva', resultado(r)); }); }
  /* ── página de hs de juego ── */
  function cabecera(box, c, p) {
    const volver = c.volver ? e('a', { class: 'weeb-back', href: c.volver }, '← Volver al sitio') : '';
    return [volver, volver ? e('div', { style: 'height:46px' }) : '', e('div', { class: 'head' }, p.logoUrl && urlOk(p.logoUrl) ? e('img', { src: p.logoUrl, alt: p.nombre || '' }) : '', p.nombre ? e('div', { style: 'font-size:.95rem;color:var(--jmute);font-weight:600' }, p.nombre) : '')];
  }
  function pagina(box) {
    box.classList.add('jg-root'); const m = /(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(box).color || ''); if (m && (+m[1] * .299 + +m[2] * .587 + +m[3] * .114) < 128) box.classList.add('jg-claro');
    box.textContent = 'Cargando horarios…';
    const pintar = () => Promise.all([llamar('juego'), cfg(), pub()]).then(([d, c, p]) => {
      document.title = 'hs de juego' + (p.nombre ? ' · ' + p.nombre : '');
      box.replaceChildren(...(box.hasAttribute('data-cabecera') ? cabecera(box, c, p) : []));
      const flyer = d.flyer && urlOk(d.flyer) ? d.flyer : '';
      box.append(e('div', { class: 'jg-hero' }, e('h1', null, 'hs de juego'), e('p', null, d.texto || 'Los chicos juegan ' + (d.duracion || '2 horas') + ' en el salón y vos reservás tu mesa online.'), e('span', { class: 'jg-price' }, e('b', null, money(d.precio)), 'por niño · ' + (d.duracion || '2 horas'))));
      if (!d.activo) { box.append(e('div', { class: 'jg-vacio' }, 'Por ahora no hay hs de juego online. Escribinos por WhatsApp y te contamos.')); return; }
      if (flyer) box.append(e('img', { class: 'jg-fly', src: flyer, alt: 'hs de juego', loading: 'lazy', style: 'margin-top:1rem' }));
      box.append(e('ol', { class: 'jg-how' }, e('li', null, e('i', null, '1'), 'Elegí el día y el horario'), e('li', null, e('i', null, '2'), 'Completá tus datos y cuántos adultos y niños van'), e('li', null, e('i', null, '3'), 'Transferí y subí el comprobante: tu mesa queda confirmada')));
      const ult = (() => { try { return JSON.parse(localStorage.getItem('juego-ultima') || 'null'); } catch (x) { return null; } })();
      box.append(e('div', { style: 'margin:.9rem 0 0' }, e('button', { class: 'jg-btn l', onclick: () => { const cod = (ult && ult.codigo) || prompt('Ingresá tu código de reserva'); if (cod) miReserva(cod).catch(x => alert(x.message)); } }, 'Ver mi reserva')));
      if (!d.slots.length) { box.append(e('div', { class: 'jg-vacio', style: 'margin-top:1.2rem' }, 'Todavía no hay horarios habilitados. Pasate en unos días o escribinos por WhatsApp.')); return; }
      const salones = []; d.slots.forEach(s => { if (!salones.some(x => x.id === s.salonId)) salones.push({ id: s.salonId, nombre: s.salon }); });
      if (salones.length > 1 && c.colores) box.append(e('div', { class: 'jg-leg' }, salones.map(z => e('span', { style: '--c:' + (colorDe(c, z.id) || 'var(--jb)') }, e('i'), z.nombre))));
      const por = {}, hoy = hoyAR(); let k = 0; d.slots.forEach(s => { (por[s.fecha] = por[s.fecha] || []).push(s); });
      Object.keys(por).sort().forEach(f => {
        box.append(e('div', { class: 'jg-dia' }, fl(f, hoy)));
        por[f].forEach(s => {
          const col = colorDe(c, s.salonId), poco = !s.completo && s.libres <= Math.max(1, Math.round(s.cupo * .25));
          box.append(e('div', { class: 'jg-card', style: '--i:' + (k++) + (col ? ';--c:' + col : '') }, e('div', { class: 'm' }, e('b', null, s.inicio + ' a ' + s.fin + ' hs'), e('small', null, s.salon + (s.nota ? ' · ' + s.nota : '')),
            e('div', { class: 'jg-meter' + (poco ? ' poco' : ''), role: 'img', 'aria-label': s.libres + ' de ' + s.cupo + ' mesas libres' }, e('i', { style: 'width:' + Math.max(4, Math.round(100 * s.libres / s.cupo)) + '%' })),
            e('small', null, s.completo ? 'Completo: no quedan mesas' : poco ? '¡Últimas mesas! Quedan ' + s.libres + ' de ' + s.cupo : 'Quedan ' + s.libres + ' de ' + s.cupo + ' mesas')),
            s.completo ? e('span', { class: 'jg-chip no' }, 'Completo') : e('button', { class: 'jg-btn', onclick: () => reservar(s, d.precio, col, pintar) }, 'Reservar mesa')));
        });
      });
    }).catch(() => { box.replaceChildren(e('div', { class: 'jg-vacio' }, 'No pudimos cargar los horarios ahora. Probá de nuevo en un momento o escribinos por WhatsApp.', e('div', { style: 'margin-top:.8rem' }, e('button', { class: 'jg-btn l', onclick: pintar }, 'Reintentar')))); });
    pintar();
    const q = new URLSearchParams(location.search).get('codigo'); if (q) miReserva(q).catch(() => {});
  }
  /* ── aviso emergente en el inicio ── */
  function aviso() {
    try { if (sessionStorage.getItem('juego-pop-x')) return; } catch (x) {}
    llamar('juego').then(d => {
      if (!d.activo || d.popup === false) return;
      const libres = d.slots.filter(s => !s.completo); if (!libres.length) return;
      const s = libres[0], pag = (S && S.getAttribute('data-pagina')) || 'hs-de-juego/';
      const pop = e('div', { class: 'jg-pop', role: 'status' }, e('div', { class: 'm' }, e('b', null, 'hs de juego disponibles'), e('small', null, fl(s.fecha, hoyAR()) + ' · ' + s.inicio + ' hs · ' + s.salon + (libres.length > 1 ? ' y más horarios' : ''))),
        e('a', { class: 'jg-btn', href: BASE + pag, style: 'padding:.7em 1em' }, 'Ver'), e('button', { class: 'c', 'aria-label': 'Cerrar aviso', onclick: () => { pop.remove(); try { sessionStorage.setItem('juego-pop-x', '1'); } catch (x) {} } }, '✕'));
      document.body.appendChild(pop);
    }).catch(() => {});
  }
  function iniciar() {
    const box = $('#horas'); if (box) pagina(box);
    if (S && S.hasAttribute('data-popup')) { const go = () => setTimeout(aviso, 3500); if (document.readyState === 'complete') go(); else addEventListener('load', go); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
