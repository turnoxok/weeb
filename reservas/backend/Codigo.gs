/**
 * WEEB RESERVAS — backend único (Google Apps Script).
 * El MISMO código va en la hoja de cada cliente (script "contenedor" de la hoja). Lo que cambia entre clientes
 * vive en la hoja (pestaña Config / Salones / Turnos), nunca en el código.
 *
 * Cómo se usa:  hoja nueva -> Extensiones > Apps Script -> pegar este archivo + appsscript.json -> menú "Weeb Reservas > Instalar".
 * Implementar > Nueva implementación > Aplicación web (ejecutar como YO, acceso: cualquier persona). La URL /exec es la "API" del cliente.
 *
 * API (todo JSON). Público:  GET ?action=config | disponibilidad&mes=YYYY-MM | estado&id=...   POST {action:'reservar',...}
 *      Panel:  POST {action:'login', email, clave} -> token;  POST {action:'admin.xxx', token, ...}   (ver ADMIN más abajo)
 * Los POST se mandan con Content-Type text/plain para evitar el preflight CORS.
 */

var TZ = 'America/Argentina/Buenos_Aires', OFFSET = '-03:00';   // Argentina no usa horario de verano
var RELOJ = { now: function () { return Date.now(); } };          // los tests lo reemplazan

var TABLAS = {
  Config:      ['clave', 'valor'],
  Salones:     ['id', 'nombre', 'capacidad', 'activo', 'orden'],
  Turnos:      ['id', 'salonId', 'dias', 'inicio', 'fin', 'etiqueta', 'precio', 'senaTipo', 'senaValor', 'desde', 'hasta', 'activo'],
  Bloqueos:    ['id', 'desde', 'hasta', 'salonId', 'turnoId', 'motivo', 'creado'],
  Reservas:    ['id', 'creada', 'actualizada', 'salonId', 'fecha', 'turnoId', 'inicio', 'fin', 'nombre', 'telefono', 'email', 'personas', 'nota',
                'total', 'sena', 'pagado', 'saldo', 'estado', 'origen', 'metodo', 'venceEn', 'extRef'],
  Pagos:       ['id', 'reservaId', 'fecha', 'monto', 'metodo', 'nota', 'creado', 'usuario'],
  Movimientos: ['id', 'fecha', 'tipo', 'categoria', 'monto', 'descripcion', 'creado', 'usuario'],
  Usuarios:    ['email', 'nombre', 'rol', 'activo', 'sal', 'claveHash'],
  Log:         ['fecha', 'usuario', 'accion', 'detalle']
};
var NUMS = { capacidad: 1, orden: 1, precio: 1, senaValor: 1, personas: 1, total: 1, sena: 1, pagado: 1, saldo: 1, monto: 1 };
var BOOLS = { activo: 1 };
var FECHAS = { fecha: 1, desde: 1, hasta: 1 };
var HORAS = { inicio: 1, fin: 1 };
var OCUPAN = { pendiente: 1, confirmada: 1, saldada: 1 };         // estados que ocupan el turno

var CFG_DEF = {
  nombre: 'Mi salón', logoUrl: '', colorPrincipal: '#8149bd', whatsapp: '', direccion: '', mapsUrl: '', moneda: 'ARS',
  mesesAnticipacion: 12, antelacionHoras: 24, maxPendientesPorContacto: 3,
  pagoTransferencia: true, pagoMercadoPago: false,
  transferTitular: '', transferCbu: '', transferAlias: '', transferBanco: '', transferNota: '',
  holdHorasTransferencia: 24, holdMinutosOnline: 20, autoConfirmarSinSena: true,
  emailsActivos: true, emailAdmin: '', textoConfirmacion: ''
};
var CFG_PUBLICA = ['nombre', 'logoUrl', 'colorPrincipal', 'whatsapp', 'direccion', 'mapsUrl', 'moneda', 'mesesAnticipacion', 'antelacionHoras',
                   'pagoTransferencia', 'pagoMercadoPago'];
var CFG_MEMO = null;

/* ───────────────────────── utilidades ───────────────────────── */
function err_(codigo, mensaje) { var e = new Error(mensaje || codigo); e.codigo = codigo; return e; }
function ahora_() { return RELOJ.now(); }
function fechaDe_(ms) { return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd'); }
function hoy_() { return fechaDe_(ahora_()); }
function txt_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
function fechaOk_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  var p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function horaOk_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }
function min_(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
function rango_(ini, fin) { var a = min_(ini), b = min_(fin); if (b <= a) b += 1440; return [a, b]; }
function solapan_(i1, f1, i2, f2) { var a = rango_(i1, f1), b = rango_(i2, f2); return a[0] < b[1] && b[0] < a[1]; }
function dow_(f) { var p = f.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function sumarMeses_(f, n) { var p = f.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1 + n, p[2])).toISOString().slice(0, 10); }
function inicioMs_(fecha, ini) { return Date.parse(fecha + 'T' + ini + ':00' + OFFSET); }
function nuevoId_(pref) { return pref + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function num_(v, nombre) { var n = Number(v); if (!isFinite(n)) throw err_('DATO_INVALIDO', 'Número inválido: ' + nombre); return n; }

/* ───────────────────────── hojas ───────────────────────── */
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function hoja_(n) {
  var s = ss_().getSheetByName(n);
  if (!s) throw err_('SIN_INSTALAR', 'Falta la pestaña ' + n + '. Usá el menú Weeb Reservas > Instalar.');
  return s;
}
function conv_(c, v) {
  if (v instanceof Date) {
    if (FECHAS[c]) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    if (HORAS[c]) return Utilities.formatDate(v, TZ, 'HH:mm');
    return v.toISOString();
  }
  if (NUMS[c]) return v === '' || v == null ? 0 : Number(v);
  if (BOOLS[c]) return v === true || /^(true|1|si|sí)$/i.test(String(v));
  return v == null ? '' : String(v);
}
function leer_(n) {
  var h = TABLAS[n], s = hoja_(n), last = s.getLastRow();
  if (last < 2) return [];
  var vals = s.getRange(2, 1, last - 1, h.length).getValues(), out = [];
  vals.forEach(function (r, i) {
    if (r.every(function (x) { return x === '' || x == null; })) return;
    var o = { _row: i + 2 };
    h.forEach(function (c, j) { o[c] = conv_(c, r[j]); });
    out.push(o);
  });
  return out;
}
function agregar_(n, o) { var h = TABLAS[n]; hoja_(n).appendRow(h.map(function (c) { return o[c] == null ? '' : o[c]; })); }
function actualizar_(n, row, o) {
  var h = TABLAS[n], s = hoja_(n), cur = s.getRange(row, 1, 1, h.length).getValues()[0];
  s.getRange(row, 1, 1, h.length).setValues([h.map(function (c, j) { return Object.prototype.hasOwnProperty.call(o, c) ? o[c] : cur[j]; })]);
}
function borrar_(n, row) { hoja_(n).deleteRow(row); }
function porId_(n, id) { var k = n === 'Usuarios' ? 'email' : 'id'; return leer_(n).filter(function (r) { return r[k] === id; })[0] || null; }
function limpio_(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; }); return c; }
function log_(usuario, accion, detalle) { try { agregar_('Log', { fecha: new Date(ahora_()).toISOString(), usuario: usuario || '', accion: accion, detalle: String(detalle || '').slice(0, 500) }); } catch (e) {} }

/* ───────────────────────── configuración ───────────────────────── */
function config_() {
  if (CFG_MEMO) return CFG_MEMO;
  var c = {}, k;
  for (k in CFG_DEF) c[k] = CFG_DEF[k];
  leer_('Config').forEach(function (r) {
    if (!(r.clave in CFG_DEF)) return;
    var d = CFG_DEF[r.clave], v = r.valor;
    if (typeof d === 'boolean') c[r.clave] = v === true || /^(true|1|si|sí)$/i.test(String(v));
    else if (typeof d === 'number') c[r.clave] = v === '' ? d : Number(v);
    else c[r.clave] = String(v);
  });
  return (CFG_MEMO = c);
}
function guardarConfig_(p, usuario) {
  var vals = p.valores || {}, filas = leer_('Config');
  Object.keys(vals).forEach(function (k) {
    if (!(k in CFG_DEF)) throw err_('DATO_INVALIDO', 'Opción desconocida: ' + k);
    var f = filas.filter(function (r) { return r.clave === k; })[0], v = typeof CFG_DEF[k] === 'string' ? txt_(vals[k], 500) : vals[k];
    if (f) actualizar_('Config', f._row, { valor: v }); else agregar_('Config', { clave: k, valor: v });
  });
  CFG_MEMO = null; invalidar_(); log_(usuario, 'config', Object.keys(vals).join(','));
  return configAdmin_();
}
function configAdmin_() { var c = config_(), o = {}; Object.keys(CFG_DEF).forEach(function (k) { o[k] = c[k]; }); return o; }
function configPublica_() {
  var c = config_(), o = {};
  CFG_PUBLICA.forEach(function (k) { o[k] = c[k]; });
  o.salones = leer_('Salones').filter(function (s) { return s.activo; }).sort(function (a, b) { return a.orden - b.orden; })
    .map(function (s) { return { id: s.id, nombre: s.nombre, capacidad: s.capacidad }; });
  return o;
}

/* ───────────────────────── caché del calendario ───────────────────────── */
function ver_() { return CacheService.getScriptCache().get('ver') || '0'; }
function invalidar_() { CacheService.getScriptCache().put('ver', ahora_() + Utilities.getUuid().slice(-6), 21600); }   // versión única: nunca se repite aunque haya dos cambios seguidos

/* ───────────────────────── reglas de disponibilidad ───────────────────────── */
function vigente_(r) {
  if (!OCUPAN[r.estado]) return false;
  if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) return false;
  return true;
}
function turnoAplica_(t, fecha) {
  if (!t.activo) return false;
  if (String(t.dias).split(',').map(function (x) { return x.trim(); }).indexOf(String(dow_(fecha))) < 0) return false;
  if (t.desde && fecha < t.desde) return false;
  if (t.hasta && fecha > t.hasta) return false;
  return true;
}
function bloqueoDe_(bloqs, salonId, fecha, turnoId) {
  return bloqs.filter(function (b) {
    return fecha >= b.desde && fecha <= (b.hasta || b.desde) && (!b.salonId || b.salonId === '*' || b.salonId === salonId) &&
           (!b.turnoId || b.turnoId === '*' || b.turnoId === turnoId);
  })[0] || null;
}
function ocupante_(reservas, salonId, fecha, ini, fin, ignorarId) {
  return reservas.filter(function (r) {
    return r.salonId === salonId && r.fecha === fecha && r.id !== ignorarId && vigente_(r) && solapan_(ini, fin, r.inicio, r.fin);
  })[0] || null;
}
function calcSena_(t, total) {
  var s = 0;
  if (t.senaTipo === 'pct') s = Math.round(total * Math.min(100, Math.max(0, t.senaValor)) / 100);
  else if (t.senaTipo === 'monto') s = t.senaValor;
  return Math.max(0, Math.min(total, s));
}

/** Calendario del mes. admin=true agrega quién reservó (solo panel). */
function agenda_(mes, admin) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw err_('DATO_INVALIDO', 'Mes inválido (YYYY-MM)');
  var cfg = config_(), hoy = hoy_(), limite = sumarMeses_(hoy, cfg.mesesAnticipacion), minMs = ahora_() + cfg.antelacionHoras * 3600000;
  var salones = leer_('Salones').filter(function (s) { return s.activo; }), turnos = leer_('Turnos');
  var reservas = leer_('Reservas').filter(function (r) { return r.fecha.indexOf(mes) === 0; }), bloqs = leer_('Bloqueos');
  var y = +mes.slice(0, 4), m = +mes.slice(5), n = new Date(Date.UTC(y, m, 0)).getUTCDate(), dias = {};
  for (var d = 1; d <= n; d++) {
    var f = mes + '-' + (d < 10 ? '0' : '') + d, lista = [];
    salones.forEach(function (s) {
      turnos.filter(function (t) { return t.salonId === s.id && turnoAplica_(t, f); }).forEach(function (t) {
        var o = ocupante_(reservas, s.id, f, t.inicio, t.fin), b = bloqueoDe_(bloqs, s.id, f, t.id), estado = 'libre';
        if (o) estado = 'ocupado'; else if (b) estado = admin ? 'bloqueado' : 'no_disponible';
        else if (f < hoy || (!admin && (inicioMs_(f, t.inicio) < minMs || f > limite))) estado = 'no_disponible';
        var it = { salonId: s.id, turnoId: t.id, etiqueta: t.etiqueta, inicio: t.inicio, fin: t.fin, precio: t.precio, sena: calcSena_(t, t.precio), estado: estado };
        if (admin) { if (o) { it.reservaId = o.id; it.nombre = o.nombre; it.reservaEstado = o.estado; } if (b) { it.bloqueoId = b.id; it.motivo = b.motivo; } }
        lista.push(it);
      });
    });
    if (lista.length) dias[f] = lista;
  }
  return { mes: mes, hoy: hoy, hasta: limite, dias: dias };
}
function disponibilidad_(p) {
  var key = 'disp:' + ver_() + ':' + p.mes, cache = CacheService.getScriptCache(), hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var r = agenda_(p.mes, false);
  cache.put(key, JSON.stringify(r), 60);
  return r;
}

/* ───────────────────────── reservas ───────────────────────── */
function conLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function reservaPublica_(r, extra) {
  var cfg = config_(), o = { id: r.id, estado: r.estado, fecha: r.fecha, inicio: r.inicio, fin: r.fin, salonId: r.salonId, nombre: r.nombre,
    total: r.total, sena: r.sena, pagado: r.pagado, saldo: r.saldo, venceEn: r.venceEn, metodo: r.metodo };
  if (r.estado === 'pendiente' && r.metodo === 'transferencia') {
    o.transferencia = { titular: cfg.transferTitular, cbu: cfg.transferCbu, alias: cfg.transferAlias, banco: cfg.transferBanco, nota: cfg.transferNota, importe: r.sena - r.pagado };
  }
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

/** Reserva desde la web (cliente final). */
function reservar_(p) {
  var cfg = config_();
  if (txt_(p.web) !== '') throw err_('RECHAZADO', 'Solicitud rechazada');           // honeypot anti-bots
  var nombre = txt_(p.nombre, 80), tel = txt_(p.telefono, 30), mail = txt_(p.email, 120).toLowerCase();
  if (nombre.length < 2) throw err_('DATO_INVALIDO', 'Falta el nombre');
  if (tel.replace(/\D/g, '').length < 6) throw err_('DATO_INVALIDO', 'Teléfono inválido');
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw err_('DATO_INVALIDO', 'Email inválido');
  if (!fechaOk_(p.fecha)) throw err_('DATO_INVALIDO', 'Fecha inválida');
  var personas = Math.max(0, Math.min(1000, Math.round(Number(p.personas) || 0)));
  return conLock_(function () {
    var t = porId_('Turnos', txt_(p.turnoId)), s = t && porId_('Salones', t.salonId);
    if (!t || !s || !s.activo || !turnoAplica_(t, p.fecha)) throw err_('TURNO_INVALIDO', 'Ese turno no está disponible ese día');
    if (p.salonId && p.salonId !== t.salonId) throw err_('TURNO_INVALIDO', 'El turno no pertenece a ese salón');
    if (p.fecha > sumarMeses_(hoy_(), cfg.mesesAnticipacion)) throw err_('FUERA_DE_RANGO', 'Todavía no se puede reservar tan adelante');
    if (inicioMs_(p.fecha, t.inicio) < ahora_() + cfg.antelacionHoras * 3600000) throw err_('FUERA_DE_RANGO', 'Ya no se puede reservar ese turno online. Escribinos por WhatsApp.');
    var reservas = leer_('Reservas');
    if (bloqueoDe_(leer_('Bloqueos'), t.salonId, p.fecha, t.id) || ocupante_(reservas, t.salonId, p.fecha, t.inicio, t.fin)) throw err_('OCUPADO', 'Ese turno ya no está disponible');
    var pend = reservas.filter(function (r) { return vigente_(r) && r.estado === 'pendiente' && ((mail && r.email === mail) || r.telefono === tel); }).length;
    if (pend >= cfg.maxPendientesPorContacto) throw err_('DEMASIADAS_PENDIENTES', 'Ya tenés reservas pendientes de pago. Completalas o escribinos.');
    var total = t.precio, sena = calcSena_(t, total), metodo = '', estado, vence = '';
    if (sena > 0) {
      metodo = p.metodo === 'mercadopago' ? 'mercadopago' : 'transferencia';
      if (metodo === 'mercadopago' && !cfg.pagoMercadoPago) throw err_('METODO_NO_DISPONIBLE', 'Ese medio de pago no está habilitado');
      if (metodo === 'transferencia' && !cfg.pagoTransferencia) throw err_('METODO_NO_DISPONIBLE', 'Ese medio de pago no está habilitado');
      estado = 'pendiente';
      vence = new Date(ahora_() + (metodo === 'mercadopago' ? cfg.holdMinutosOnline * 60000 : cfg.holdHorasTransferencia * 3600000)).toISOString();
    } else estado = cfg.autoConfirmarSinSena ? 'confirmada' : 'pendiente';
    var iso = new Date(ahora_()).toISOString();
    var r = { id: nuevoId_('R'), creada: iso, actualizada: iso, salonId: t.salonId, fecha: p.fecha, turnoId: t.id, inicio: t.inicio, fin: t.fin, nombre: nombre, telefono: tel, email: mail,
      personas: personas, nota: txt_(p.nota, 400), total: total, sena: sena, pagado: 0, saldo: total, estado: estado, origen: 'web', metodo: metodo, venceEn: vence, extRef: '' };
    agregar_('Reservas', r); invalidar_(); log_('web', 'reservar', r.id + ' ' + r.fecha + ' ' + r.inicio);
    notificar_(r, estado === 'confirmada' ? 'confirmada' : 'pendiente');
    return reservaPublica_(r);
  });
}
function estado_(p) {
  var id = txt_(p.id, 40), r = id && porId_('Reservas', id);
  if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) r.estado = 'vencida';
  return reservaPublica_(r);
}

/** Recalcula pagado/saldo/estado a partir de la pestaña Pagos. */
function recalcular_(id) {
  var r = porId_('Reservas', id); if (!r) return null;
  var pagado = leer_('Pagos').filter(function (x) { return x.reservaId === id; }).reduce(function (a, x) { return a + x.monto; }, 0);
  var cambios = { pagado: pagado, saldo: r.total - pagado, actualizada: new Date(ahora_()).toISOString() }, estado = r.estado;
  if (estado === 'pendiente' && pagado > 0 && pagado >= r.sena) { estado = 'confirmada'; cambios.venceEn = ''; }
  if ((estado === 'confirmada' || estado === 'pendiente') && r.total > 0 && pagado >= r.total) { estado = 'saldada'; cambios.venceEn = ''; }
  else if (estado === 'saldada' && pagado < r.total) estado = 'confirmada';
  cambios.estado = estado; actualizar_('Reservas', r._row, cambios);
  var n = porId_('Reservas', id);
  if (r.estado === 'pendiente' && estado !== 'pendiente') notificar_(n, 'confirmada');
  return n;
}

/** Vence las reservas pendientes (trigger cada 5 min). */
function vencer_() {
  conLock_(function () {
    var n = 0;
    leer_('Reservas').forEach(function (r) {
      if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) { actualizar_('Reservas', r._row, { estado: 'vencida', actualizada: new Date(ahora_()).toISOString() }); n++; }
    });
    if (n) { invalidar_(); log_('sistema', 'vencer', n + ' reservas'); }
  });
}

/* ───────────────────────── mails ───────────────────────── */
function notificar_(r, evento) {
  try {
    var cfg = config_(); if (!cfg.emailsActivos) return;
    if (MailApp.getRemainingDailyQuota() < 4) return;
    var asunto = (evento === 'confirmada' ? 'Reserva confirmada' : 'Reserva recibida') + ' · ' + cfg.nombre;
    var filas = '<p>Fecha: <b>' + r.fecha + '</b> · ' + r.inicio + ' a ' + r.fin + ' hs</p><p>Total: $' + r.total + (r.sena ? ' · Seña: $' + r.sena : '') + ' · Pagado: $' + r.pagado + '</p>';
    var cuerpo = '<div style="font-family:Arial,sans-serif;max-width:520px">' + (cfg.logoUrl ? '<img src="' + cfg.logoUrl + '" style="max-height:60px"><br>' : '') +
      '<h2>' + asunto + '</h2><p>Hola ' + r.nombre + '!</p>' + filas +
      (evento === 'pendiente' && r.metodo === 'transferencia' ? '<p>Para confirmar, transferí la seña a <b>' + cfg.transferAlias + '</b> (' + cfg.transferTitular + ') y mandanos el comprobante.</p>' : '') +
      (cfg.textoConfirmacion ? '<p>' + cfg.textoConfirmacion + '</p>' : '') + '<p>Código de reserva: ' + r.id + '</p><hr><small>Hecho con tuweeb</small></div>';
    if (r.email) MailApp.sendEmail({ to: r.email, subject: asunto, htmlBody: cuerpo, name: cfg.nombre });
    if (cfg.emailAdmin) MailApp.sendEmail({ to: cfg.emailAdmin, subject: '[Panel] ' + asunto + ' - ' + r.nombre, htmlBody: cuerpo, name: 'Weeb Reservas' });
  } catch (e) { log_('sistema', 'mail_error', e.message); }
}

/* ───────────────────────── autenticación del panel (mail + clave) ───────────────────────── */
function hex_(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function hashClave_(clave, sal) {
  var h = sal + clave;
  for (var i = 0; i < 600; i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + sal + clave, Utilities.Charset.UTF_8));
  return h;
}
function iguales_(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function secreto_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function firmar_(texto) { return hex_(Utilities.computeHmacSha256Signature(texto, secreto_())); }
/** Crea o cambia un usuario del panel. La clave se guarda solo como hash con sal. */
function definirUsuario_(email, clave, nombre, rol) {
  email = txt_(email, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err_('DATO_INVALIDO', 'Email inválido');
  if (String(clave || '').length < 8) throw err_('DATO_INVALIDO', 'La clave debe tener al menos 8 caracteres');
  var sal = Utilities.getUuid().replace(/-/g, '').slice(0, 16), d = { email: email, nombre: txt_(nombre, 60), rol: rol || 'admin', activo: true, sal: sal, claveHash: hashClave_(String(clave), sal) };
  var cur = porId_('Usuarios', email);
  if (cur) { if (!nombre) delete d.nombre; if (!rol) delete d.rol; actualizar_('Usuarios', cur._row, d); } else agregar_('Usuarios', d);
}
function login_(p) {
  var email = txt_(p.email, 120).toLowerCase(), clave = String(p.clave || ''), cache = CacheService.getScriptCache(), k = 'lf:' + email;
  if (Number(cache.get(k) || 0) >= 5) throw err_('DEMASIADOS_INTENTOS', 'Demasiados intentos. Esperá 15 minutos.');
  var u = email && porId_('Usuarios', email);
  if (!u || !u.activo || !u.claveHash || !iguales_(hashClave_(clave, u.sal), u.claveHash)) {
    cache.put(k, String(Number(cache.get(k) || 0) + 1), 900); log_(email, 'login_fallido', '');
    throw err_('CREDENCIALES', 'Mail o clave incorrectos');
  }
  cache.remove(k);
  var cuerpo = Utilities.base64EncodeWebSafe(JSON.stringify({ e: u.email, r: u.rol || 'admin', v: u.claveHash.slice(0, 8), x: ahora_() + 14 * 86400000 }));
  log_(u.email, 'login', '');
  return { token: cuerpo + '.' + firmar_(cuerpo), email: u.email, nombre: u.nombre, rol: u.rol || 'admin' };
}
function autenticar_(token) {
  if (!token || token.indexOf('.') < 0) throw err_('NO_AUTORIZADO', 'Iniciá sesión');
  var partes = token.split('.');
  if (!iguales_(partes[1] || '', firmar_(partes[0]))) throw err_('NO_AUTORIZADO', 'Sesión inválida');
  var d; try { d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString()); } catch (e) { throw err_('NO_AUTORIZADO', 'Sesión inválida'); }
  if (d.x < ahora_()) throw err_('NO_AUTORIZADO', 'La sesión venció. Volvé a entrar.');
  var u = porId_('Usuarios', d.e);
  if (!u || !u.activo || u.claveHash.slice(0, 8) !== d.v) throw err_('NO_AUTORIZADO', 'Sesión inválida');
  return { email: u.email, rol: u.rol || 'admin' };
}

/* ───────────────────────── panel (ADMIN) ───────────────────────── */
function validarTurno_(p) {
  if (!txt_(p.salonId) || !porId_('Salones', p.salonId)) throw err_('DATO_INVALIDO', 'Salón inexistente');
  var dias = String(p.dias == null ? '' : p.dias).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  if (!dias.length || dias.some(function (d) { return !/^[0-6]$/.test(d); })) throw err_('DATO_INVALIDO', 'Días inválidos (0=domingo … 6=sábado)');
  if (!horaOk_(p.inicio) || !horaOk_(p.fin) || p.inicio === p.fin) throw err_('DATO_INVALIDO', 'Horario inválido');
  if (p.desde && !fechaOk_(p.desde)) throw err_('DATO_INVALIDO', 'Fecha "desde" inválida');
  if (p.hasta && !fechaOk_(p.hasta)) throw err_('DATO_INVALIDO', 'Fecha "hasta" inválida');
  var tipo = ['pct', 'monto'].indexOf(p.senaTipo) >= 0 ? p.senaTipo : 'ninguna';
  return { salonId: p.salonId, dias: dias.join(','), inicio: p.inicio, fin: p.fin, etiqueta: txt_(p.etiqueta, 60), precio: Math.max(0, num_(p.precio || 0, 'precio')),
    senaTipo: tipo, senaValor: tipo === 'ninguna' ? 0 : Math.max(0, num_(p.senaValor || 0, 'seña')), desde: p.desde || '', hasta: p.hasta || '', activo: p.activo !== false };
}
function adminCrearReserva_(p, u) {
  if (!fechaOk_(p.fecha)) throw err_('DATO_INVALIDO', 'Fecha inválida');
  var nombre = txt_(p.nombre, 80); if (nombre.length < 2) throw err_('DATO_INVALIDO', 'Falta el nombre');
  return conLock_(function () {
    var t = porId_('Turnos', txt_(p.turnoId)); if (!t) throw err_('TURNO_INVALIDO', 'Turno inexistente');
    var reservas = leer_('Reservas');
    if (ocupante_(reservas, t.salonId, p.fecha, t.inicio, t.fin)) throw err_('OCUPADO', 'Ese turno ya tiene una reserva');
    if (!p.ignorarBloqueo && bloqueoDe_(leer_('Bloqueos'), t.salonId, p.fecha, t.id)) throw err_('BLOQUEADO', 'Ese turno está bloqueado');
    var total = p.total != null && p.total !== '' ? Math.max(0, num_(p.total, 'total')) : t.precio;
    var sena = p.sena != null && p.sena !== '' ? Math.max(0, Math.min(total, num_(p.sena, 'seña'))) : calcSena_(t, total);
    var iso = new Date(ahora_()).toISOString();
    var r = { id: nuevoId_('R'), creada: iso, actualizada: iso, salonId: t.salonId, fecha: p.fecha, turnoId: t.id, inicio: t.inicio, fin: t.fin, nombre: nombre, telefono: txt_(p.telefono, 30),
      email: txt_(p.email, 120).toLowerCase(), personas: Math.max(0, Math.round(Number(p.personas) || 0)), nota: txt_(p.nota, 400), total: total, sena: sena, pagado: 0, saldo: total,
      estado: p.estado === 'pendiente' ? 'pendiente' : 'confirmada', origen: 'manual', metodo: '', venceEn: '', extRef: '' };
    agregar_('Reservas', r);
    if (p.pago && Number(p.pago.monto) !== 0) adminPagoInterno_(r.id, p.pago, u);
    invalidar_(); log_(u.email, 'reserva_manual', r.id);
    return reservaCompleta_(r.id);
  });
}
function reservaCompleta_(id) {
  var r = porId_('Reservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  return { reserva: limpio_(r), pagos: leer_('Pagos').filter(function (x) { return x.reservaId === id; }).map(limpio_) };
}
function adminPagoInterno_(id, p, u) {
  if (!porId_('Reservas', id)) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  var f = p.fecha || hoy_(); if (!fechaOk_(f)) throw err_('DATO_INVALIDO', 'Fecha de pago inválida');
  var monto = num_(p.monto, 'monto'); if (monto === 0) throw err_('DATO_INVALIDO', 'El monto no puede ser 0');
  agregar_('Pagos', { id: nuevoId_('P'), reservaId: id, fecha: f, monto: monto, metodo: txt_(p.metodo || 'efectivo', 30), nota: txt_(p.nota, 200), creado: new Date(ahora_()).toISOString(), usuario: u.email });
  recalcular_(id);
}
function caja_(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw err_('DATO_INVALIDO', 'Mes inválido (YYYY-MM)');
  var pagos = leer_('Pagos').filter(function (x) { return x.fecha.indexOf(mes) === 0; }), movs = leer_('Movimientos').filter(function (x) { return x.fecha.indexOf(mes) === 0; });
  var porMetodo = {}, ingRes = 0, ingExtra = 0, egr = 0;
  pagos.forEach(function (x) { ingRes += x.monto; porMetodo[x.metodo] = (porMetodo[x.metodo] || 0) + x.monto; });
  movs.forEach(function (x) { if (x.tipo === 'ingreso') ingExtra += x.monto; else egr += x.monto; });
  var porCobrar = leer_('Reservas').filter(function (r) { return r.fecha.indexOf(mes) === 0 && (r.estado === 'confirmada' || r.estado === 'pendiente') && r.saldo > 0; })
    .reduce(function (a, r) { return a + r.saldo; }, 0);
  return { mes: mes, ingresosReservas: ingRes, ingresosExtra: ingExtra, egresos: egr, balance: ingRes + ingExtra - egr, porCobrar: porCobrar, porMetodo: porMetodo,
    pagos: pagos.map(limpio_), movimientos: movs.map(limpio_) };
}

var ADMIN = {
  'admin.ping': function (p, u) { return { email: u.email, rol: u.rol }; },
  'admin.cambiarClave': function (p, u) {
    var cur = porId_('Usuarios', u.email);
    if (!iguales_(hashClave_(String(p.actual || ''), cur.sal), cur.claveHash)) throw err_('CREDENCIALES', 'La clave actual no es correcta');
    definirUsuario_(u.email, p.nueva); log_(u.email, 'cambio_clave', ''); return login_({ email: u.email, clave: p.nueva });
  },
  'admin.agenda': function (p) { return agenda_(p.mes, true); },
  'admin.reservas': function (p) {
    var q = txt_(p.q).toLowerCase();
    return leer_('Reservas').filter(function (r) {
      return (!p.desde || r.fecha >= p.desde) && (!p.hasta || r.fecha <= p.hasta) && (!p.estado || r.estado === p.estado) && (!p.salonId || r.salonId === p.salonId) &&
        (!q || (r.nombre + ' ' + r.telefono + ' ' + r.email + ' ' + r.id).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.inicio < b.inicio ? -1 : 1; }).map(limpio_);
  },
  'admin.reserva': function (p) { return reservaCompleta_(txt_(p.id)); },
  'admin.crearReserva': adminCrearReserva_,
  'admin.actualizarReserva': function (p, u) {
    return conLock_(function () {
      var r = porId_('Reservas', txt_(p.id)); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
      var c = {}, ok = ['nombre', 'telefono', 'email', 'nota'];
      ok.forEach(function (k) { if (p[k] != null) c[k] = txt_(p[k], k === 'nota' ? 400 : 120); });
      if (p.personas != null) c.personas = Math.max(0, Math.round(num_(p.personas, 'personas')));
      if (p.total != null) c.total = Math.max(0, num_(p.total, 'total'));
      if (p.sena != null) c.sena = Math.max(0, num_(p.sena, 'seña'));
      if (p.turnoId || p.fecha) {                                         // mover de día / turno
        var f = p.fecha || r.fecha, t = porId_('Turnos', p.turnoId || r.turnoId);
        if (!fechaOk_(f) || !t) throw err_('DATO_INVALIDO', 'Fecha o turno inválido');
        if (ocupante_(leer_('Reservas'), t.salonId, f, t.inicio, t.fin, r.id)) throw err_('OCUPADO', 'Ese turno ya tiene una reserva');
        if (!p.ignorarBloqueo && bloqueoDe_(leer_('Bloqueos'), t.salonId, f, t.id)) throw err_('BLOQUEADO', 'Ese turno está bloqueado');
        c.fecha = f; c.turnoId = t.id; c.salonId = t.salonId; c.inicio = t.inicio; c.fin = t.fin;
      }
      if (p.estado) {
        if (['pendiente', 'confirmada', 'saldada', 'cancelada', 'vencida'].indexOf(p.estado) < 0) throw err_('DATO_INVALIDO', 'Estado inválido');
        if (OCUPAN[p.estado] && !OCUPAN[r.estado] || (p.estado === 'pendiente' && r.estado === 'pendiente')) {   // reactivar: el turno tiene que seguir libre
          var f2 = c.fecha || r.fecha, i2 = c.inicio || r.inicio, e2 = c.fin || r.fin, s2 = c.salonId || r.salonId;
          if (ocupante_(leer_('Reservas'), s2, f2, i2, e2, r.id)) throw err_('OCUPADO', 'Ese turno ya lo tomó otra reserva');
        }
        c.estado = p.estado; if (p.estado !== 'pendiente') c.venceEn = '';
        if (p.estado === 'pendiente' && r.estado !== 'pendiente') c.venceEn = new Date(ahora_() + config_().holdHorasTransferencia * 3600000).toISOString();
      }
      c.actualizada = new Date(ahora_()).toISOString(); actualizar_('Reservas', r._row, c);
      var estadoAntes = r.estado; recalcular_(r.id); invalidar_(); log_(u.email, 'reserva_edit', r.id + ' ' + JSON.stringify(Object.keys(c)));
      var n = porId_('Reservas', r.id); if (p.estado === 'confirmada' && estadoAntes !== 'confirmada') notificar_(n, 'confirmada');
      return reservaCompleta_(r.id);
    });
  },
  'admin.cancelar': function (p, u) { return ADMIN['admin.actualizarReserva']({ id: p.id, estado: 'cancelada' }, u); },
  'admin.pago': function (p, u) { return conLock_(function () { adminPagoInterno_(txt_(p.id), p, u); invalidar_(); log_(u.email, 'pago', p.id + ' ' + p.monto); return reservaCompleta_(txt_(p.id)); }); },
  'admin.pagoEliminar': function (p, u) {
    return conLock_(function () {
      var x = porId_('Pagos', txt_(p.pagoId)); if (!x) throw err_('NO_ENCONTRADO', 'Pago no encontrado');
      borrar_('Pagos', x._row); recalcular_(x.reservaId); invalidar_(); log_(u.email, 'pago_borrado', x.id); return reservaCompleta_(x.reservaId);
    });
  },
  'admin.bloqueos': function () { return leer_('Bloqueos').map(limpio_); },
  'admin.bloquear': function (p, u) {
    if (!fechaOk_(p.desde) || (p.hasta && !fechaOk_(p.hasta))) throw err_('DATO_INVALIDO', 'Fechas inválidas');
    return conLock_(function () {
      var b = { id: nuevoId_('B'), desde: p.desde, hasta: p.hasta || p.desde, salonId: txt_(p.salonId) || '*', turnoId: txt_(p.turnoId) || '*', motivo: txt_(p.motivo, 120), creado: new Date(ahora_()).toISOString() };
      agregar_('Bloqueos', b); invalidar_(); log_(u.email, 'bloquear', b.id + ' ' + b.desde + '..' + b.hasta); return limpio_(b);
    });
  },
  'admin.desbloquear': function (p, u) {
    return conLock_(function () { var b = porId_('Bloqueos', txt_(p.id)); if (!b) throw err_('NO_ENCONTRADO', 'Bloqueo no encontrado'); borrar_('Bloqueos', b._row); invalidar_(); log_(u.email, 'desbloquear', b.id); return { id: b.id }; });
  },
  'admin.salones': function () { return leer_('Salones').sort(function (a, b) { return a.orden - b.orden; }).map(limpio_); },
  'admin.guardarSalon': function (p, u) {
    var nombre = txt_(p.nombre, 60); if (!nombre) throw err_('DATO_INVALIDO', 'Falta el nombre');
    return conLock_(function () {
      var cur = p.id && porId_('Salones', p.id), d = { nombre: nombre, capacidad: Math.max(0, Math.round(Number(p.capacidad) || 0)), activo: p.activo !== false, orden: Number(p.orden) || 0 };
      if (cur) actualizar_('Salones', cur._row, d); else { d.id = nuevoId_('S'); agregar_('Salones', d); cur = d; }
      invalidar_(); log_(u.email, 'salon', cur.id || d.id); return limpio_(porId_('Salones', cur.id || d.id));
    });
  },
  'admin.turnos': function () { return leer_('Turnos').map(limpio_); },
  'admin.guardarTurno': function (p, u) {
    var d = validarTurno_(p);
    return conLock_(function () {
      var cur = p.id && porId_('Turnos', p.id);
      if (cur) actualizar_('Turnos', cur._row, d); else { d.id = nuevoId_('T'); agregar_('Turnos', d); cur = d; }
      invalidar_(); log_(u.email, 'turno', cur.id); return limpio_(porId_('Turnos', cur.id));
    });
  },
  'admin.borrarTurno': function (p, u) {   // no se borra si tiene reservas vigentes futuras: se desactiva
    return conLock_(function () {
      var t = porId_('Turnos', txt_(p.id)); if (!t) throw err_('NO_ENCONTRADO', 'Turno no encontrado');
      var usados = leer_('Reservas').filter(function (r) { return r.turnoId === t.id && vigente_(r) && r.fecha >= hoy_(); }).length;
      if (usados) { actualizar_('Turnos', t._row, { activo: false }); invalidar_(); return { id: t.id, desactivado: true, reservasFuturas: usados }; }
      borrar_('Turnos', t._row); invalidar_(); log_(u.email, 'turno_borrado', t.id); return { id: t.id, borrado: true };
    });
  },
  'admin.movimientos': function (p) { return leer_('Movimientos').filter(function (x) { return !p.mes || x.fecha.indexOf(p.mes) === 0; }).map(limpio_); },
  'admin.movimiento': function (p, u) {
    if (['ingreso', 'egreso'].indexOf(p.tipo) < 0) throw err_('DATO_INVALIDO', 'Tipo inválido');
    var f = p.fecha || hoy_(); if (!fechaOk_(f)) throw err_('DATO_INVALIDO', 'Fecha inválida');
    var m = Math.abs(num_(p.monto, 'monto')); if (!m) throw err_('DATO_INVALIDO', 'Monto inválido');
    return conLock_(function () {
      var x = { id: nuevoId_('M'), fecha: f, tipo: p.tipo, categoria: txt_(p.categoria, 60), monto: m, descripcion: txt_(p.descripcion, 200), creado: new Date(ahora_()).toISOString(), usuario: u.email };
      agregar_('Movimientos', x); log_(u.email, 'movimiento', x.id); return x;
    });
  },
  'admin.movimientoEliminar': function (p, u) {
    return conLock_(function () { var x = porId_('Movimientos', txt_(p.id)); if (!x) throw err_('NO_ENCONTRADO', 'Movimiento no encontrado'); borrar_('Movimientos', x._row); log_(u.email, 'movimiento_borrado', x.id); return { id: x.id }; });
  },
  'admin.caja': function (p) { return caja_(p.mes); },
  'admin.config': function () { return configAdmin_(); },
  'admin.guardarConfig': guardarConfig_
};

/* ───────────────────────── entrada web ───────────────────────── */
function despachar_(p, esPost) {
  CFG_MEMO = null;
  var a = txt_(p.action, 40);
  if (a === 'config') return configPublica_();
  if (a === 'disponibilidad') return disponibilidad_(p);
  if (a === 'estado') return estado_(p);
  if (a === 'login') { if (!esPost) throw err_('METODO', 'Usá POST'); return login_(p); }
  if (a === 'reservar') { if (!esPost) throw err_('METODO', 'Usá POST'); return reservar_(p); }
  if (a.indexOf('admin.') === 0) {
    if (!esPost) throw err_('METODO', 'Usá POST');
    if (!ADMIN[a]) throw err_('ACCION_DESCONOCIDA', 'Acción desconocida');
    var u = autenticar_(txt_(p.token, 1000));
    return ADMIN[a](p, u);
  }
  throw err_('ACCION_DESCONOCIDA', 'Acción desconocida');
}
function responder_(fn) {
  var out;
  try { out = { ok: true, data: fn() }; }
  catch (e) {
    if (e.codigo) out = { ok: false, error: e.codigo, mensaje: e.message };
    else { log_('sistema', 'error', e && e.stack || e); out = { ok: false, error: 'INTERNO', mensaje: 'Error inesperado. Probá de nuevo o escribinos por WhatsApp.' }; }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) { return responder_(function () { return despachar_((e && e.parameter) || {}, false); }); }
function doPost(e) {
  return responder_(function () {
    var p; try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { throw err_('DATO_INVALIDO', 'JSON inválido'); }
    return despachar_(p, true);
  });
}

/* ───────────────────────── instalación / mantenimiento ───────────────────────── */
function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Weeb Reservas').addItem('Instalar / reparar hojas', 'instalar').addItem('Crear o cambiar usuario del panel', 'menuUsuario_').addItem('Hacer backup ahora', 'backup_').addToUi(); } catch (e) {}
}
function menuUsuario_() {
  var ui = SpreadsheetApp.getUi(), a = ui.prompt('Usuario del panel', 'Mail del dueño:', ui.ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Usuario del panel', 'Clave (mínimo 8 caracteres). Se guarda cifrada, nadie puede leerla después:', ui.ButtonSet.OK_CANCEL); if (b.getSelectedButton() !== ui.Button.OK) return;
  try { definirUsuario_(a.getResponseText(), b.getResponseText(), '', 'admin'); ui.alert('Listo. El dueño ya puede entrar al panel con ese mail y esa clave.'); } catch (e) { ui.alert(e.message); }
}
function instalar() {
  var ss = ss_();
  Object.keys(TABLAS).forEach(function (n) {
    var h = TABLAS[n], s = ss.getSheetByName(n) || ss.insertSheet(n);
    s.getRange(1, 1, 1, h.length).setValues([h]); s.setFrozenRows(1);
    h.forEach(function (c, i) { if (!NUMS[c] && !BOOLS[c]) s.getRange(2, i + 1, Math.max(1, s.getMaxRows() - 1), 1).setNumberFormat('@'); });   // texto plano: Sheets no convierte fechas ni horas
  });
  if (!leer_('Salones').length) agregar_('Salones', { id: 'S1', nombre: 'Salón principal', capacidad: 0, activo: true, orden: 1 });
  if (!leer_('Config').length) Object.keys(CFG_DEF).forEach(function (k) { agregar_('Config', { clave: k, valor: CFG_DEF[k] }); });
  secreto_();
  ScriptApp.getProjectTriggers().forEach(function (t) { var f = t.getHandlerFunction(); if (f === 'vencer_' || f === 'backup_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('vencer_').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('backup_').timeBased().everyDays(1).atHour(3).create();
  return 'Listo: hojas, salón de ejemplo, opciones y tareas automáticas instaladas.';
}
function backup_() {
  var f = ss_(), carpetas = DriveApp.getFoldersByName('Weeb backups'), c = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder('Weeb backups');
  DriveApp.getFileById(f.getId()).makeCopy(f.getName() + ' · backup ' + hoy_(), c);
  var viejos = [], it = c.getFiles(); while (it.hasNext()) viejos.push(it.next());
  viejos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); }).slice(14).forEach(function (x) { x.setTrashed(true); });
}
