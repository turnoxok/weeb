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
                'total', 'sena', 'pagado', 'saldo', 'estado', 'origen', 'metodo', 'venceEn', 'extRef', 'planId', 'plan',
                'compId', 'compUrl', 'compNombre', 'compTipo', 'compFecha', 'compOrigen', 'codigo'],
  Planes:      ['id', 'nombre', 'descripcion', 'precio', 'senaTipo', 'senaValor', 'orden', 'activo', 'salonId'],   // salonId vacío = el plan vale para todos los salones
  Contenido:   ['id', 'seccion', 'orden', 'titulo', 'texto', 'imagen', 'etiqueta', 'activo'],   // lo que muestra la página de planes: incluido, adicionales, detalle (fotos), pasos, faq
  Precios:     ['id', 'planId', 'turnoId', 'precio'],             // precio de cada plan en cada horario (si falta, vale el precio base del plan)
  Servicio:    ['clave', 'valor'],                                    // lo carga tuweeb (el cliente solo lo ve): precio del sitio, ediciones, dominio…
  ServicioPagos: ['id', 'fecha', 'monto', 'nota'],                    // cada pago del cliente a tuweeb (cuota o total)
  Pagos:       ['id', 'reservaId', 'fecha', 'monto', 'metodo', 'nota', 'creado', 'usuario'],
  Movimientos: ['id', 'fecha', 'tipo', 'categoria', 'monto', 'descripcion', 'creado', 'usuario', 'ref'],
  Juego:       ['id', 'fecha', 'salonId', 'turnoId', 'estado', 'cupo', 'precio', 'nota', 'flyer', 'creado'],   // lo que la dueña abre o cierra a mano para hora de juego (el resto lo decide el sistema)
  JuegoReservas: ['id', 'creada', 'actualizada', 'fecha', 'salonId', 'turnoId', 'inicio', 'fin', 'nombre', 'telefono', 'chicos', 'total', 'pagado', 'estado', 'origen', 'metodo', 'venceEn', 'nota', 'codigo',
                'compId', 'compUrl', 'compNombre', 'compTipo', 'compFecha', 'compOrigen', 'compBorrarEn'],
  Usuarios:    ['email', 'nombre', 'rol', 'activo', 'sal', 'claveHash'],
  Log:         ['fecha', 'usuario', 'accion', 'detalle']
};
var NUMS = { chicos: 1, cupo: 1, capacidad: 1, orden: 1, precio: 1, senaValor: 1, personas: 1, total: 1, sena: 1, pagado: 1, saldo: 1, monto: 1 };
var BOOLS = { activo: 1 };
var FECHAS = { fecha: 1, desde: 1, hasta: 1 };
var HORAS = { inicio: 1, fin: 1 };
var OCUPAN = { pendiente: 1, confirmada: 1, saldada: 1 };         // estados que ocupan el turno

var CFG_DEF = {
  nombre: 'Mi salón', logoUrl: '', colorPrincipal: '#8149bd', whatsapp: '', direccion: '', mapsUrl: '', moneda: 'ARS',
  mesesAnticipacion: 12, antelacionHoras: 24, maxPendientesPorContacto: 3,
  pagoTransferencia: true, pagoMercadoPago: false,
  transferTitular: '', transferCbu: '', transferAlias: '', transferBanco: '', transferNota: '',
  descPagoTotal: 0, holdHorasTransferencia: 24, holdMinutosOnline: 20, autoConfirmarSinSena: true,
  emailsActivos: true, emailAdmin: '', textoConfirmacion: '', urlReservas: '',
  /* hora de juego: apagada por defecto; se prende para los salones que la ofrecen */
  juegoActivo: false, juegoCupo: 20, juegoPrecio: 20000, juegoDiasAntes: 5, juegoAuto: true, juegoHoldHoras: 3, juegoMinutosAntes: 60,
  juegoDuracion: '2 horas', juegoPopup: true, juegoTexto: '', juegoFlyer: '',
  /* textos de la página de planes (se editan en el panel) */
  pgEtiqueta: 'Planes y combos', pgTitulo: 'Elegí cómo querés festejar en *tu salón*', pgBajada: 'Combos pensados para que no tengas que preocuparte por nada. Si querés armar algo a tu medida, escribinos y lo hacemos.',
  pgDestacado: 'El más elegido', pgBotonPlan: 'Reservar este combo',
  pgCanjeTitulo: '¿Cuántos invitados van a ser?', pgCanjeTexto: 'Elegí el combo según la cantidad de invitados. Si más adelante se suman, pasás al combo siguiente y pagás solo la diferencia: no perdés la fecha ni lo que ya señaste. Entrá a «Mi reserva» con tu código y tocá «Ampliar mi plan».',
  pgPromoPill: 'Promo por tiempo limitado', pgPromoTitulo: 'Congelá tu fecha', pgPromoTexto: 'Reservá con anticipación y congelá el precio de hoy con la seña. Con la promo pagás menos que en el horario más pedido.', pgPromoBoton: 'Congelá tu fecha',
  pgIncluyeTitulo: 'Todo lo que incluye tu festejo', pgIncluyeSub: 'Vos disfrutás: del resto nos ocupamos nosotros.', pgAdicionalesTitulo: 'Podés sumar',
  pgPasosTitulo: 'Reservar son tres pasos', pgPasosSub: 'Ves el calendario real, con los días que ya están ocupados. Sin esperar que alguien te conteste.', pgFaqTitulo: 'Preguntas que nos hacen todos',
  pgCtaTexto: '¿Ya sabés la fecha? Mirá qué días hay lugar y dejá tu reserva.', pgCtaBoton: 'Ver disponibilidad', pgCtaWhatsapp: 'Escribinos por WhatsApp', pgNota: 'Consultá por fechas y promociones.'
};
var CFG_PUBLICA = ['nombre', 'logoUrl', 'colorPrincipal', 'whatsapp', 'direccion', 'mapsUrl', 'moneda', 'mesesAnticipacion', 'antelacionHoras',
                   'pagoTransferencia', 'pagoMercadoPago', 'urlReservas', 'descPagoTotal',
                   'juegoActivo', 'juegoCupo', 'juegoPrecio', 'juegoDiasAntes', 'juegoAuto', 'juegoDuracion', 'juegoPopup', 'juegoTexto', 'juegoFlyer',
                   'pgEtiqueta', 'pgTitulo', 'pgBajada', 'pgDestacado', 'pgBotonPlan', 'pgCanjeTitulo', 'pgCanjeTexto', 'pgPromoPill', 'pgPromoTitulo', 'pgPromoTexto', 'pgPromoBoton', 'pgIncluyeTitulo', 'pgIncluyeSub',
                   'pgAdicionalesTitulo', 'pgPasosTitulo', 'pgPasosSub', 'pgFaqTitulo', 'pgCtaTexto', 'pgCtaBoton', 'pgCtaWhatsapp', 'pgNota'];
var SECCIONES = { incluido: 1, adicionales: 1, detalle: 1, pasos: 1, faq: 1, galeria: 1 };
var CFG_MEMO = null;

/* Lo que el cliente le paga a tuweeb por su sitio. Se carga en las pestañas Servicio y ServicioPagos de la hoja; en el panel el cliente solo lo ve. */
var SERVICIO_DEF = {
  precioTotal: 720000, cuotas: 6, valorCuota: 120000, edicionesIncluidas: 3, edicionesUsadas: 0, renovacionUsd: 49, dominio: '', dominioFecha: '',
  incluye: 'Dominio propio|Hosting|Certificado SSL (el candado de seguridad)|Soporte sin costo|3 ediciones simples por mes|Las ediciones complejas se cotizan aparte'
};

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
function sumarDias_(f, n) { var p = f.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
function leerOpc_(n) { try { return leer_(n); } catch (e) { if (e.codigo === 'SIN_INSTALAR') return []; throw e; } }
function inicioMs_(fecha, ini) { return Date.parse(fecha + 'T' + ini + ':00' + OFFSET); }
/** Código corto para el cliente: 6 letras MAYÚSCULAS y números sin confusiones (sin 0/O ni 1/I/L). */
var COD_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function nuevoCodigo_() {
  var usados = {}; leer_('Reservas').forEach(function (r) { if (r.codigo) usados[r.codigo] = 1; });
  for (var n = 0; n < 50; n++) { var c = ''; for (var i = 0; i < 6; i++) c += COD_ABC.charAt(Math.floor(Math.random() * COD_ABC.length)); if (!usados[c]) return c; }
  throw err_('ERROR', 'No se pudo generar el código');
}
function normCodigo_(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
function asegurarCodigo_(r) { if (r && !r.codigo) { r.codigo = nuevoCodigo_(); actualizar_('Reservas', r._row, { codigo: r.codigo }); } return r; }
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
/** La respuesta pública de configuración se guarda en caché: leer 6 pestañas de la hoja tarda ~2 s y la pide cada visita a la página de planes y a reservar.
 *  Se renueva sola al guardar algo desde el panel (cambia la versión) o a los 10 minutos si alguien edita la hoja a mano. */
function configPublica_() {
  var cache = CacheService.getScriptCache(), ck = 'cfgp:' + ver_(), hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var o = configPublicaArmar_();
  try { cache.put(ck, JSON.stringify(o), 600); } catch (e) {}
  return o;
}
function configPublicaArmar_() {
  var c = config_(), o = {};
  CFG_PUBLICA.forEach(function (k) { o[k] = c[k]; });
  o.salones = leer_('Salones').filter(function (s) { return s.activo; }).sort(function (a, b) { return a.orden - b.orden; })
    .map(function (s) { return { id: s.id, nombre: s.nombre, capacidad: s.capacidad }; });
  o.turnos = leer_('Turnos').filter(function (t) { return t.activo; }).map(function (t) { return { id: t.id, salonId: t.salonId, dias: String(t.dias), inicio: t.inicio, fin: t.fin, etiqueta: t.etiqueta, desde: t.desde, hasta: t.hasta }; });
  var pm = preciosMapa_();
  o.contenido = leer_('Contenido').filter(function (x) { return x.activo && SECCIONES[x.seccion]; }).sort(function (a, b) { return a.orden - b.orden; }).map(function (x) { return { seccion: x.seccion, titulo: x.titulo, texto: x.texto, imagen: x.imagen, etiqueta: x.etiqueta }; });
  o.planes = planesActivos_().map(function (p) { return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, salonId: p.salonId || '', precio: p.precio, sena: calcSena_(p, p.precio), senaTipo: p.senaTipo, senaValor: p.senaValor, precios: pm[p.id] || {} }; });
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
/** Planes (combos) que se pueden elegir al reservar. Si no hay ninguno activo, el precio sale del turno como siempre. */
function planesActivos_() { return leer_('Planes').filter(function (p) { return p.activo; }).sort(function (a, b) { return a.orden - b.orden; }); }
/** Precio de cada plan por horario: { planId: { turnoId: precio } }. */
function preciosMapa_() {
  var m = {}; leer_('Precios').forEach(function (x) { (m[x.planId] = m[x.planId] || {})[x.turnoId] = x.precio; }); return m;
}
/** Lo que vale un plan en un horario: el precio puntual si está cargado, si no el precio base del plan. */
function precioPlan_(plan, turnoId, mapa) {
  var m = (mapa || preciosMapa_())[plan.id]; return m && m[turnoId] != null && m[turnoId] !== '' ? m[turnoId] : plan.precio;
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
  var jres = leerOpc_('JuegoReservas').filter(function (r) { return r.fecha.indexOf(mes) === 0 && vigente_(r); });
  var y = +mes.slice(0, 4), m = +mes.slice(5), n = new Date(Date.UTC(y, m, 0)).getUTCDate(), dias = {};
  for (var d = 1; d <= n; d++) {
    var f = mes + '-' + (d < 10 ? '0' : '') + d, lista = [];
    salones.forEach(function (s) {
      turnos.filter(function (t) { return t.salonId === s.id && turnoAplica_(t, f); }).forEach(function (t) {
        var o = ocupante_(reservas, s.id, f, t.inicio, t.fin), b = bloqueoDe_(bloqs, s.id, f, t.id), estado = 'libre';
        if (o) estado = 'ocupado'; else if (b) estado = admin ? 'bloqueado' : 'no_disponible';
        else if (f < hoy || (!admin && (inicioMs_(f, t.inicio) < minMs || f > limite))) estado = 'no_disponible';
        var jn = jres.filter(function (x) { return x.salonId === s.id && x.turnoId === t.id && x.fecha === f; }).reduce(function (a, x) { return a + x.chicos; }, 0);
        if (jn && estado === 'libre' && !admin) estado = 'no_disponible';   // ya hay chicos anotados en hora de juego ese turno: online no se ofrece como cumple
        var it = { salonId: s.id, turnoId: t.id, etiqueta: t.etiqueta, inicio: t.inicio, fin: t.fin, precio: t.precio, sena: calcSena_(t, t.precio), estado: estado };
        if (admin) { if (jn) it.juegoChicos = jn; if (o) { it.reservaId = o.id; it.nombre = o.nombre; it.reservaEstado = o.estado; } if (b) { it.bloqueoId = b.id; it.motivo = b.motivo; } }
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
/** Comprobante de seña: el archivo vive en Drive (carpeta propia); la hoja guarda solo el enlace. */
var COMP_TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
var COMP_MAX = 6 * 1024 * 1024;
function compPublico_(r) { return r.compId ? { nombre: r.compNombre, tipo: r.compTipo, fecha: r.compFecha, origen: r.compOrigen } : null; }
function compAdmin_(r) { return r.compId ? { id: r.compId, url: r.compUrl, nombre: r.compNombre, tipo: r.compTipo, fecha: r.compFecha, origen: r.compOrigen } : null; }
function compCarpeta_() {
  var it = DriveApp.getFoldersByName('Comprobantes de seña');
  return it.hasNext() ? it.next() : DriveApp.createFolder('Comprobantes de seña');
}
function compBorrarArchivo_(id) { try { if (id) DriveApp.getFileById(id).setTrashed(true); } catch (e) { log_('sistema', 'comp_borrar_error', e.message); } }
/** Guarda (o reemplaza) el comprobante de una reserva. p: id, archivo {nombre, tipo, datos(base64)}. */
function guardarComprobante_(id, p, origen) {
  var r = porId_('Reservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  var tipo = txt_(p.tipo, 60).toLowerCase(), ext = COMP_TIPOS[tipo];
  if (!ext) throw err_('ARCHIVO_INVALIDO', 'Subí una foto (JPG, PNG) o un PDF');
  var b64 = String(p.datos || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!b64) throw err_('ARCHIVO_INVALIDO', 'El archivo llegó vacío');
  if (b64.length * 0.75 > COMP_MAX) throw err_('ARCHIVO_GRANDE', 'El archivo pesa demasiado (máximo 6 MB)');
  var bytes = Utilities.base64Decode(b64);
  if (!bytes.length) throw err_('ARCHIVO_INVALIDO', 'El archivo llegó vacío');
  var nombre = txt_(p.nombre, 80).replace(/[\\\/:*?"<>|]/g, '_') || ('comprobante.' + ext);
  var blob = Utilities.newBlob(bytes, tipo, 'Seña ' + r.id + ' · ' + r.nombre + '.' + ext);
  var f = compCarpeta_().createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { log_('sistema', 'comp_share_error', e.message); }
  compBorrarArchivo_(r.compId);
  actualizar_('Reservas', r._row, { compId: f.getId(), compUrl: f.getUrl(), compNombre: nombre, compTipo: ext, compFecha: new Date(ahora_()).toISOString(), compOrigen: origen, actualizada: new Date(ahora_()).toISOString() });
  invalidar_();
  return porId_('Reservas', id);
}
/** Fotos de la página de planes: se suben desde el panel, viven en Drive (carpeta propia, visibles con el link) y la hoja guarda solo la dirección. */
var FOTO_TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }, FOTO_MAX = 4 * 1024 * 1024, FOTO_CARPETA = 'Fotos de la página';
function fotoCarpeta_() { var it = DriveApp.getFoldersByName(FOTO_CARPETA); return it.hasNext() ? it.next() : DriveApp.createFolder(FOTO_CARPETA); }
function fotoIdDe_(url) { var m = /^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]{2,})/.exec(String(url || '')); return m ? m[1] : ''; }
/** Manda a la papelera una foto que subimos nosotros (solo si está en nuestra carpeta; nunca toca otros archivos de Drive). */
function fotoBorrar_(url) {
  var id = fotoIdDe_(url); if (!id) return;
  try { var f = DriveApp.getFileById(id), ps = f.getParents(), ok = false; while (ps.hasNext()) if (ps.next().getName() === FOTO_CARPETA) ok = true; if (ok) f.setTrashed(true); } catch (e) { log_('sistema', 'foto_borrar_error', e.message); }
}
function subirFoto_(p, u) {
  var tipo = txt_(p.tipo, 60).toLowerCase(), ext = FOTO_TIPOS[tipo];
  if (!ext) throw err_('ARCHIVO_INVALIDO', 'Subí una foto JPG, PNG o WebP');
  var b64 = String(p.datos || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!b64) throw err_('ARCHIVO_INVALIDO', 'La foto llegó vacía');
  if (b64.length * 0.75 > FOTO_MAX) throw err_('ARCHIVO_GRANDE', 'La foto pesa demasiado (máximo 4 MB)');
  var bytes = Utilities.base64Decode(b64); if (!bytes.length) throw err_('ARCHIVO_INVALIDO', 'La foto llegó vacía');
  var nombre = txt_(p.nombre, 80).replace(/[\\\/:*?"<>|]/g, '_').replace(/\.[A-Za-z0-9]+$/, '') || 'foto';
  var f = fotoCarpeta_().createFile(Utilities.newBlob(bytes, tipo, nombre + '.' + ext));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { log_('sistema', 'foto_share_error', e.message); }
  log_(u.email, 'foto_subida', f.getId());
  return { id: f.getId(), url: 'https://lh3.googleusercontent.com/d/' + f.getId() + '=w1600' };
}
function comprobante_(p) {
  var id = txt_(p.id, 40), r = id && porId_('Reservas', id);
  if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  if (r.estado === 'cancelada' || r.estado === 'vencida' || (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_())) throw err_('NO_DISPONIBLE', 'Esta reserva ya no admite comprobantes. Escribinos por WhatsApp.');
  return conLock_(function () {
    r = guardarComprobante_(id, p, 'cliente'); log_('web', 'comprobante', id);
    try { var cfg = config_(); if (cfg.emailsActivos && cfg.emailAdmin && MailApp.getRemainingDailyQuota() > 3) MailApp.sendEmail({ to: cfg.emailAdmin, subject: '[Panel] Comprobante de seña · ' + r.nombre, htmlBody: '<p>' + r.nombre + ' subió el comprobante de la reserva ' + r.id + ' (' + r.fecha + ').</p><p><a href="' + r.compUrl + '">Ver comprobante</a></p>', name: 'Weeb Reservas' }); } catch (e) { log_('sistema', 'mail_error', e.message); }
    return reservaPublica_(r);
  });
}

function reservaPublica_(r, extra) {
  var cfg = config_(), o = { id: r.id, estado: r.estado, fecha: r.fecha, inicio: r.inicio, fin: r.fin, salonId: r.salonId, nombre: r.nombre,
    total: r.total, sena: r.sena, pagado: r.pagado, saldo: r.saldo, venceEn: r.venceEn, metodo: r.metodo, plan: r.plan || '', comprobante: compPublico_(r),
    codigo: r.codigo || '', personas: r.personas || 0, nota: r.nota || '' };
  o.nombre = String(r.nombre || '').split(' ')[0];   // al consultar solo se muestra el primer nombre
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
    var planes = planesActivos_().filter(function (x) { return !x.salonId || x.salonId === t.salonId; }), plan = null;   // cada salón ofrece sus combos (o los que valen para todos)
    if (planes.length) {
      plan = planes.filter(function (x) { return x.id === txt_(p.planId); })[0];
      if (!plan) throw err_('PLAN_INVALIDO', 'Elegí un plan para tu fiesta');
    }
    var total = plan ? precioPlan_(plan, t.id) : t.precio, sena = calcSena_(plan || t, total), metodo = '', estado, vence = '', planNom = plan ? plan.nombre : '';
    if (plan && cfg.descPagoTotal > 0 && (p.pagoTotal === true || p.pagoTotal === 'true' || p.pagoTotal === 1 || p.pagoTotal === '1')) {   // pagando todo junto hay descuento: el total baja y la "seña" es el total
      total = Math.round(total * (100 - Math.min(100, cfg.descPagoTotal)) / 100); sena = total; planNom += ' · pago total ' + cfg.descPagoTotal + '% OFF';
    }
    if (sena > 0) {
      metodo = p.metodo === 'mercadopago' ? 'mercadopago' : 'transferencia';
      if (metodo === 'mercadopago' && !cfg.pagoMercadoPago) throw err_('METODO_NO_DISPONIBLE', 'Ese medio de pago no está habilitado');
      if (metodo === 'transferencia' && !cfg.pagoTransferencia) throw err_('METODO_NO_DISPONIBLE', 'Ese medio de pago no está habilitado');
      estado = 'pendiente';
      vence = new Date(ahora_() + (metodo === 'mercadopago' ? cfg.holdMinutosOnline * 60000 : cfg.holdHorasTransferencia * 3600000)).toISOString();
    } else estado = cfg.autoConfirmarSinSena ? 'confirmada' : 'pendiente';
    var iso = new Date(ahora_()).toISOString();
    var r = { id: nuevoId_('R'), codigo: nuevoCodigo_(), creada: iso, actualizada: iso, salonId: t.salonId, fecha: p.fecha, turnoId: t.id, inicio: t.inicio, fin: t.fin, nombre: nombre, telefono: tel, email: mail,
      personas: personas, nota: txt_(p.nota, 400), total: total, sena: sena, pagado: 0, saldo: total, estado: estado, origen: 'web', metodo: metodo, venceEn: vence, extRef: '', planId: plan ? plan.id : '', plan: planNom };
    agregar_('Reservas', r); invalidar_(); log_('web', 'reservar', r.id + ' ' + r.fecha + ' ' + r.inicio);
    notificar_(r, estado === 'confirmada' ? 'confirmada' : 'pendiente');
    return reservaPublica_(r);
  });
}
function estado_(p) {
  var id = txt_(p.id, 40), cod = normCodigo_(p.codigo), r = null, cache = CacheService.getScriptCache();
  if (id) { r = porId_('Reservas', id); if (r) asegurarCodigo_(r); }
  else if (cod) {
    if (Number(cache.get('cf') || 0) >= 40) throw err_('DEMASIADOS_INTENTOS', 'Hubo demasiados intentos. Probá de nuevo en unos minutos.');
    r = leer_('Reservas').filter(function (x) { return x.codigo === cod; })[0] || null;
    if (!r) cache.put('cf', String(Number(cache.get('cf') || 0) + 1), 900);
  }
  if (!r) throw err_('NO_ENCONTRADA', 'No encontramos esa reserva. Revisá el código.');
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
    leerOpc_('JuegoReservas').forEach(function (r) {
      if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) { actualizar_('JuegoReservas', r._row, { estado: 'vencida', actualizada: new Date(ahora_()).toISOString() }); n++; }
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
    var filas = '<p>Fecha: <b>' + r.fecha + '</b> · ' + r.inicio + ' a ' + r.fin + ' hs</p>' + (r.plan ? '<p>Plan: <b>' + r.plan + '</b></p>' : '') + '<p>Total: $' + r.total + (r.sena ? ' · Seña: $' + r.sena : '') + ' · Pagado: $' + r.pagado + '</p>';
    asegurarCodigo_(r);
    var link = cfg.urlReservas ? cfg.urlReservas + (cfg.urlReservas.indexOf('?') < 0 ? '?' : '&') + 'codigo=' + r.codigo : '';
    var cuerpo = '<div style="font-family:Arial,sans-serif;max-width:520px">' + (cfg.logoUrl ? '<img src="' + cfg.logoUrl + '" style="max-height:60px"><br>' : '') +
      '<h2>' + asunto + '</h2><p>Hola ' + r.nombre + '!</p>' + filas +
      (evento === 'pendiente' && r.metodo === 'transferencia' ? '<p>Para confirmar, transferí la seña a <b>' + cfg.transferAlias + '</b> (' + cfg.transferTitular + ') y mandanos el comprobante.</p>' : '') +
      (cfg.textoConfirmacion ? '<p>' + cfg.textoConfirmacion + '</p>' : '') + '<p style="font-size:18px">Tu código de reserva: <b style="letter-spacing:2px">' + r.codigo + '</b></p>' + (link ? '<p><a href="' + link + '" style="background:#e8693a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Ver el estado de mi reserva</a></p>' : '') + '<hr><small>Hecho con tuweeb</small></div>';
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
  if (u && u.activo && !u.claveHash) throw err_('CLAVE_PENDIENTE', 'Todavía no elegiste tu clave. Elegila ahora.');   // usuario creado sin clave: la elige él mismo la primera vez
  if (!u || !u.activo || !u.claveHash || !iguales_(hashClave_(clave, u.sal), u.claveHash)) {
    cache.put(k, String(Number(cache.get(k) || 0) + 1), 900); log_(email, 'login_fallido', '');
    throw err_('CREDENCIALES', 'Mail o clave incorrectos');
  }
  cache.remove(k);
  var cuerpo = Utilities.base64EncodeWebSafe(JSON.stringify({ e: u.email, r: u.rol || 'admin', v: u.claveHash.slice(0, 8), x: ahora_() + 14 * 86400000 }));
  log_(u.email, 'login', '');
  return { token: cuerpo + '.' + firmar_(cuerpo), email: u.email, nombre: u.nombre, rol: u.rol || 'admin' };
}
/** Primera clave: solo sirve mientras el usuario fue creado SIN clave. Después ya no se puede usar (cambiarla exige entrar). */
function primeraClave_(p) {
  var email = txt_(p.email, 120).toLowerCase(), clave = String(p.clave || ''), cache = CacheService.getScriptCache(), k = 'lf:' + email;
  if (Number(cache.get(k) || 0) >= 5) throw err_('DEMASIADOS_INTENTOS', 'Demasiados intentos. Esperá 15 minutos.');
  var u = email && porId_('Usuarios', email);
  if (!u || !u.activo || u.claveHash) { cache.put(k, String(Number(cache.get(k) || 0) + 1), 900); throw err_('CREDENCIALES', 'No se puede elegir la clave de este usuario'); }
  if (clave.length < 8) throw err_('DATO_INVALIDO', 'La clave debe tener al menos 8 caracteres');
  return conLock_(function () {
    var cur = porId_('Usuarios', email); if (!cur || cur.claveHash) throw err_('CREDENCIALES', 'No se puede elegir la clave de este usuario');
    var sal = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    actualizar_('Usuarios', cur._row, { sal: sal, claveHash: hashClave_(clave, sal) }); log_(email, 'primera_clave', '');
    return login_({ email: email, clave: clave });
  });
}
/** «Olvidé mi clave»: manda un código de 6 números por mail al usuario registrado. Siempre responde igual (no revela si el mail existe). */
function olvideClave_(p) {
  var email = txt_(p.email, 120).toLowerCase(), cache = CacheService.getScriptCache(), ok = { enviado: true, mensaje: 'Si ese mail tiene acceso al panel, te mandamos un código. Revisá tu bandeja (y el spam).' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err_('DATO_INVALIDO', 'Escribí tu mail');
  var kq = 'rq:' + email, pedidos = Number(cache.get(kq) || 0);
  if (pedidos >= 3) throw err_('DEMASIADOS_INTENTOS', 'Ya pediste varios códigos. Esperá una hora y probá de nuevo.');
  cache.put(kq, String(pedidos + 1), 3600);
  var u = porId_('Usuarios', email); if (!u || !u.activo) { log_(email, 'olvide_clave_desconocido', ''); return ok; }
  var codigo = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('rc:' + email, JSON.stringify({ h: firmar_(codigo + ':' + email), n: 0 }), 900);
  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('sin cuota de mails');
    MailApp.sendEmail({ to: u.email, subject: 'Tu código para cambiar la clave del panel', name: config_().nombre || 'Panel',
      htmlBody: '<p>Tu código para elegir una clave nueva es:</p><p style="font-size:28px;letter-spacing:6px"><b>' + codigo + '</b></p><p>Vale 15 minutos. Si no lo pediste vos, ignorá este mail: tu clave actual sigue funcionando.</p>' });
  } catch (e) { log_(email, 'mail_error', e.message); throw err_('MAIL_ERROR', 'No pudimos mandar el mail. Probá de nuevo en un rato o escribinos por WhatsApp.'); }
  log_(email, 'olvide_clave', ''); return ok;
}
/** Elige una clave nueva con el código que llegó por mail (vale 15 minutos y 5 intentos). */
function restablecerClave_(p) {
  var email = txt_(p.email, 120).toLowerCase(), codigo = String(p.codigo || '').replace(/\D/g, ''), clave = String(p.clave || ''), cache = CacheService.getScriptCache(), k = 'rc:' + email;
  var rec = null; try { rec = JSON.parse(cache.get(k) || 'null'); } catch (e) {}
  if (!rec) throw err_('CODIGO_INVALIDO', 'El código venció o no es correcto. Pedí uno nuevo.');
  if (rec.n >= 5) { cache.remove(k); throw err_('CODIGO_INVALIDO', 'Demasiados intentos. Pedí un código nuevo.'); }
  if (!iguales_(firmar_(codigo + ':' + email), rec.h)) { rec.n++; cache.put(k, JSON.stringify(rec), 900); log_(email, 'codigo_incorrecto', ''); throw err_('CODIGO_INVALIDO', 'El código no es correcto.'); }
  if (clave.length < 8) throw err_('DATO_INVALIDO', 'La clave debe tener al menos 8 caracteres');
  return conLock_(function () {
    var cur = porId_('Usuarios', email); if (!cur || !cur.activo) throw err_('CODIGO_INVALIDO', 'El código venció o no es correcto. Pedí uno nuevo.');
    var sal = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    actualizar_('Usuarios', cur._row, { sal: sal, claveHash: hashClave_(clave, sal) }); cache.remove(k); cache.remove('lf:' + email); log_(email, 'clave_restablecida', '');
    return login_({ email: email, clave: clave });
  });
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
function validarPlan_(p) {
  var nombre = txt_(p.nombre, 60); if (!nombre) throw err_('DATO_INVALIDO', 'Falta el nombre del plan');
  var tipo = ['pct', 'monto'].indexOf(p.senaTipo) >= 0 ? p.senaTipo : 'ninguna';
  return { nombre: nombre, descripcion: txt_(p.descripcion, 400), precio: Math.max(0, num_(p.precio || 0, 'precio')), senaTipo: tipo,
    senaValor: tipo === 'ninguna' ? 0 : Math.max(0, num_(p.senaValor || 0, 'seña')), orden: Math.round(Number(p.orden) || 0), activo: p.activo !== false, salonId: txt_(p.salonId, 40) };
}
/** Reemplaza los precios por horario de un plan. Solo valen horarios que existen y montos mayores a 0; el resto usa el precio base. */
function guardarPrecios_(planId, precios) {
  var validos = {}; leer_('Turnos').forEach(function (t) { validos[t.id] = 1; });
  leer_('Precios').filter(function (x) { return x.planId === planId; }).sort(function (a, b) { return b._row - a._row; }).forEach(function (x) { borrar_('Precios', x._row); });
  Object.keys(precios).forEach(function (tid) {
    var v = Math.round(Number(precios[tid])); if (!validos[tid] || !(v > 0)) return;
    agregar_('Precios', { id: nuevoId_('PR'), planId: planId, turnoId: tid, precio: v });
  });
}
/** Estado de lo que el cliente le paga a tuweeb por su sitio (solo lectura para el cliente). */
function servicio_() {
  var c = {}, k; for (k in SERVICIO_DEF) c[k] = SERVICIO_DEF[k];
  leer_('Servicio').forEach(function (r) {
    if (!(r.clave in SERVICIO_DEF)) return;
    var d = SERVICIO_DEF[r.clave]; c[r.clave] = typeof d === 'number' ? (r.valor === '' ? d : Number(r.valor)) : String(r.valor);
  });
  var pagos = leer_('ServicioPagos').sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; }).map(limpio_);
  var pagado = pagos.reduce(function (a, x) { return a + x.monto; }, 0), saldo = Math.max(0, c.precioTotal - pagado);
  var cuotasPagadas = c.valorCuota > 0 ? Math.min(c.cuotas, Math.floor(pagado / c.valorCuota + 1e-9)) : 0;
  var inicio = c.dominioFecha && fechaOk_(c.dominioFecha) ? c.dominioFecha : (pagos.length ? pagos[0].fecha : '');
  var vence = inicio ? sumarMeses_(inicio, 12) : '', dias = vence ? Math.round((Date.parse(vence + 'T12:00:00Z') - Date.parse(hoy_() + 'T12:00:00Z')) / 86400000) : null;
  return {
    precioTotal: c.precioTotal, cuotas: c.cuotas, valorCuota: c.valorCuota, pagado: pagado, saldo: saldo, cuotasPagadas: cuotasPagadas,
    proximaCuota: saldo > 0 ? { numero: cuotasPagadas + 1, monto: Math.min(c.valorCuota, saldo) } : null,
    estado: saldo <= 0 ? 'pagado' : pagado > 0 ? 'en cuotas' : 'pendiente', pagos: pagos,
    incluye: String(c.incluye).split('|').map(function (x) { return x.trim(); }).filter(Boolean),
    dominio: c.dominio, dominioInicio: inicio, vencimiento: vence, diasParaVencer: dias,
    renovacionUsd: c.renovacionUsd, edicionesIncluidas: c.edicionesIncluidas, edicionesUsadas: c.edicionesUsadas, edicionesRestantes: Math.max(0, c.edicionesIncluidas - c.edicionesUsadas)
  };
}
function adminCrearReserva_(p, u) {
  if (!fechaOk_(p.fecha)) throw err_('DATO_INVALIDO', 'Fecha inválida');
  var nombre = txt_(p.nombre, 80); if (nombre.length < 2) throw err_('DATO_INVALIDO', 'Falta el nombre');
  return conLock_(function () {
    var t = porId_('Turnos', txt_(p.turnoId)); if (!t) throw err_('TURNO_INVALIDO', 'Turno inexistente');
    var reservas = leer_('Reservas');
    if (ocupante_(reservas, t.salonId, p.fecha, t.inicio, t.fin)) throw err_('OCUPADO', 'Ese turno ya tiene una reserva');
    if (!p.ignorarBloqueo && bloqueoDe_(leer_('Bloqueos'), t.salonId, p.fecha, t.id)) throw err_('BLOQUEADO', 'Ese turno está bloqueado');
    var plan = p.planId ? porId_('Planes', txt_(p.planId)) : null;
    if (p.planId && !plan) throw err_('PLAN_INVALIDO', 'Plan inexistente');
    var total = p.total != null && p.total !== '' ? Math.max(0, num_(p.total, 'total')) : (plan ? precioPlan_(plan, t.id) : t.precio);
    var sena = p.sena != null && p.sena !== '' ? Math.max(0, Math.min(total, num_(p.sena, 'seña'))) : calcSena_(plan || t, total);
    var iso = new Date(ahora_()).toISOString();
    var r = { id: nuevoId_('R'), codigo: nuevoCodigo_(), creada: iso, actualizada: iso, salonId: t.salonId, fecha: p.fecha, turnoId: t.id, inicio: t.inicio, fin: t.fin, nombre: nombre, telefono: txt_(p.telefono, 30),
      email: txt_(p.email, 120).toLowerCase(), personas: Math.max(0, Math.round(Number(p.personas) || 0)), nota: txt_(p.nota, 400), total: total, sena: sena, pagado: 0, saldo: total,
      estado: p.estado === 'pendiente' ? 'pendiente' : 'confirmada', origen: 'manual', metodo: '', venceEn: '', extRef: '', planId: plan ? plan.id : '', plan: plan ? plan.nombre : '' };
    agregar_('Reservas', r);
    if (p.pago && Number(p.pago.monto) !== 0) adminPagoInterno_(r.id, p.pago, u);
    invalidar_(); log_(u.email, 'reserva_manual', r.id);
    return reservaCompleta_(r.id);
  });
}
function reservaCompleta_(id) {
  var r = porId_('Reservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada'); asegurarCodigo_(r);
  return { reserva: limpio_(r), comprobante: compAdmin_(r), pagos: leer_('Pagos').filter(function (x) { return x.reservaId === id; }).map(limpio_) };
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
  'admin.cambiarEmail': function (p, u) {
    var nuevo = txt_(p.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(nuevo)) throw err_('DATO_INVALIDO', 'Revisá el mail nuevo');
    var cur = porId_('Usuarios', u.email);
    if (!iguales_(hashClave_(String(p.clave || ''), cur.sal), cur.claveHash)) throw err_('CREDENCIALES', 'La clave no es correcta');
    if (nuevo === u.email) throw err_('DATO_INVALIDO', 'Ese ya es tu mail');
    return conLock_(function () {
      if (porId_('Usuarios', nuevo)) throw err_('DATO_INVALIDO', 'Ese mail ya tiene acceso al panel');
      var c = porId_('Usuarios', u.email); actualizar_('Usuarios', c._row, { email: nuevo });
      var f = leer_('Config').filter(function (r) { return r.clave === 'emailAdmin' && String(r.valor).toLowerCase() === u.email; })[0]; if (f) actualizar_('Config', f._row, { valor: nuevo });
      invalidar_(); log_(nuevo, 'cambio_email', u.email); return login_({ email: nuevo, clave: String(p.clave) });
    });
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
  'admin.comprobante': function (p, u) { return conLock_(function () { var id = txt_(p.id, 40); guardarComprobante_(id, p, 'dueño'); log_(u.email, 'comprobante', id); return reservaCompleta_(id); }); },
  'admin.comprobanteEliminar': function (p, u) { return conLock_(function () {
    var id = txt_(p.id, 40), r = porId_('Reservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
    compBorrarArchivo_(r.compId); actualizar_('Reservas', r._row, { compId: '', compUrl: '', compNombre: '', compTipo: '', compFecha: '', compOrigen: '' }); invalidar_(); log_(u.email, 'comprobante_borrado', id); return reservaCompleta_(id); }); },
  'admin.crearReserva': adminCrearReserva_,
  'admin.actualizarReserva': function (p, u) {
    return conLock_(function () {
      var r = porId_('Reservas', txt_(p.id)); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
      var c = {}, ok = ['nombre', 'telefono', 'email', 'nota'];
      ok.forEach(function (k) { if (p[k] != null) c[k] = txt_(p[k], k === 'nota' ? 400 : 120); });
      if (p.personas != null) c.personas = Math.max(0, Math.round(num_(p.personas, 'personas')));
      if (p.planId && p.planId !== r.planId) {                              // ampliar / cambiar de plan: el total y la seña pasan a los del plan nuevo; lo ya pagado se mantiene
        var pl = porId_('Planes', txt_(p.planId, 40)); if (!pl) throw err_('PLAN_INVALIDO', 'Ese plan no existe');
        c.planId = pl.id; c.plan = pl.nombre; var pp = precioPlan_(pl, r.turnoId); if (p.total == null) c.total = pp; if (p.sena == null) c.sena = calcSena_(pl, pp);
      }
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
  'admin.planes': function () { var pm = preciosMapa_(); return leer_('Planes').sort(function (a, b) { return a.orden - b.orden; }).map(function (x) { var o = limpio_(x); o.precios = pm[x.id] || {}; return o; }); },
  'admin.guardarPlan': function (p, u) {
    var d = validarPlan_(p);
    return conLock_(function () {
      var cur = p.id && porId_('Planes', p.id);
      if (cur) actualizar_('Planes', cur._row, d); else { d.id = nuevoId_('PL'); agregar_('Planes', d); cur = d; }
      if (p.precios && typeof p.precios === 'object') guardarPrecios_(cur.id, p.precios);
      invalidar_(); log_(u.email, 'plan', cur.id); var o = limpio_(porId_('Planes', cur.id)); o.precios = preciosMapa_()[cur.id] || {}; return o;
    });
  },
  'admin.borrarPlan': function (p, u) {   // las reservas ya hechas guardan el nombre y el precio del plan, así que se puede borrar sin perder nada
    return conLock_(function () {
      var x = porId_('Planes', txt_(p.id)); if (!x) throw err_('NO_ENCONTRADO', 'Plan no encontrado');
      guardarPrecios_(x.id, {}); borrar_('Planes', x._row); invalidar_(); log_(u.email, 'plan_borrado', x.id); return { id: x.id, borrado: true };
    });
  },
  'admin.subirFoto': subirFoto_,
  'admin.contenido': function () { return leer_('Contenido').sort(function (a, b) { return a.orden - b.orden; }).map(limpio_); },
  'admin.guardarContenido': function (p, u) {
    var sec = txt_(p.seccion, 20); if (!SECCIONES[sec]) throw err_('DATO_INVALIDO', 'Sección desconocida');
    var titulo = txt_(p.titulo, 160); if (!titulo) throw err_('DATO_INVALIDO', 'Falta el título');
    var d = { seccion: sec, titulo: titulo, texto: txt_(p.texto, 600), imagen: txt_(p.imagen, 300), etiqueta: txt_(p.etiqueta, 60), orden: Math.round(Number(p.orden) || 0), activo: p.activo !== false };
    if (d.imagen && !/^(https:\/\/|assets\/|\.\/assets\/)/i.test(d.imagen)) throw err_('DATO_INVALIDO', 'La imagen tiene que ser un link https o una foto del sitio (assets/...)');
    return conLock_(function () {
      var cur = p.id && porId_('Contenido', p.id);
      if (!cur && !p.orden) d.orden = leer_('Contenido').filter(function (x) { return x.seccion === sec; }).length + 1;
      if (cur) { if (cur.imagen && cur.imagen !== d.imagen) fotoBorrar_(cur.imagen); actualizar_('Contenido', cur._row, d); } else { d.id = nuevoId_('CT'); agregar_('Contenido', d); cur = d; }
      invalidar_(); log_(u.email, 'contenido', cur.id); return limpio_(porId_('Contenido', cur.id));
    });
  },
  'admin.borrarContenido': function (p, u) {
    return conLock_(function () {
      var x = porId_('Contenido', txt_(p.id)); if (!x) throw err_('NO_ENCONTRADO', 'No encontrado');
      fotoBorrar_(x.imagen); borrar_('Contenido', x._row); invalidar_(); log_(u.email, 'contenido_borrado', x.id); return { id: x.id, borrado: true };
    });
  },
  'admin.servicio': function () { return servicio_(); },
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
  if (a === 'juego') return juegoPublico_(p);
  if (a === 'estadoJuego') return estadoJuego_(p);
  if (a === 'reservarJuego') { if (!esPost) throw err_('METODO', 'Usá POST'); return reservarJuego_(p); }
  if (a === 'comprobanteJuego') { if (!esPost) throw err_('METODO', 'Usá POST'); return comprobanteJuego_(p); }
  if (a === 'comprobante') { if (!esPost) throw err_('METODO', 'Usá POST'); return comprobante_(p); }
  if (a === 'olvideClave') { if (!esPost) throw err_('METODO', 'Usá POST'); return olvideClave_(p); }
  if (a === 'restablecerClave') { if (!esPost) throw err_('METODO', 'Usá POST'); return restablecerClave_(p); }
  if (a === 'primeraClave') { if (!esPost) throw err_('METODO', 'Usá POST'); return primeraClave_(p); }
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

/* ───────────────────────── HORA DE JUEGO ─────────────────────────
   Chicos que van a jugar sin fiesta, con cupo. Usa los mismos salones y horarios (turnos) que los cumples:
   - cerca de la fecha (juegoDiasAntes) los turnos que no tienen cumple se ofrecen solos como hora de juego;
   - la dueña puede abrir o cerrar cualquier turno a mano (pestaña Juego del panel) y eso siempre manda;
   - un turno con cumple reservado nunca se ofrece como juego, y uno con chicos anotados deja de ofrecerse online como cumple. */
var JUEGO_CARPETA = 'Comprobantes hora de juego', JUEGO_DIAS_COMP = 7, JUEGO_MAX_DIAS = 62;
function juegoSlots_(desde, hasta, admin) {
  var cfg = config_(), hoy = hoy_(), n = 0;
  if (!fechaOk_(desde) || !fechaOk_(hasta) || hasta < desde) throw err_('DATO_INVALIDO', 'Fechas inválidas');
  var salones = leer_('Salones').filter(function (s) { return s.activo; }), turnos = leer_('Turnos'), bloqs = leer_('Bloqueos');
  var cumples = leer_('Reservas').filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; });
  var ov = leerOpc_('Juego').filter(function (x) { return x.fecha >= desde && x.fecha <= hasta; });
  var jr = leerOpc_('JuegoReservas').filter(function (r) { return r.fecha >= desde && r.fecha <= hasta && vigente_(r); });
  var limiteAuto = sumarDias_(hoy, Math.max(0, cfg.juegoDiasAntes)), minMs = ahora_() + (admin ? 0 : cfg.juegoMinutosAntes * 60000), out = [];
  for (var f = desde; f <= hasta && n < JUEGO_MAX_DIAS; f = sumarDias_(f, 1), n++) {
    salones.forEach(function (s) {
      turnos.filter(function (t) { return t.salonId === s.id && turnoAplica_(t, f); }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; }).forEach(function (t) {
        var o = ocupante_(cumples, s.id, f, t.inicio, t.fin), b = bloqueoDe_(bloqs, s.id, f, t.id), x = ov.filter(function (q) { return q.fecha === f && q.salonId === s.id && q.turnoId === t.id; })[0] || null;
        var estado, origen = '';
        if (o) estado = 'cumple';
        else if (x && x.estado === 'cerrado') estado = 'cerrado';
        else if (x && x.estado === 'abierto') { estado = 'abierto'; origen = 'manual'; }
        else if (b) estado = 'bloqueado';
        else if (cfg.juegoAuto && f >= hoy && f <= limiteAuto) { estado = 'abierto'; origen = 'auto'; }
        else estado = 'fuera';
        if (estado === 'abierto' && (admin ? f < hoy : inicioMs_(f, t.inicio) < minMs)) estado = 'fuera';
        var cupo = x && x.cupo > 0 ? x.cupo : cfg.juegoCupo, precio = x && x.precio > 0 ? x.precio : cfg.juegoPrecio;
        var vend = jr.filter(function (r) { return r.salonId === s.id && r.turnoId === t.id && r.fecha === f; }).reduce(function (a, r) { return a + r.chicos; }, 0);
        var it = { fecha: f, salonId: s.id, salon: s.nombre, turnoId: t.id, etiqueta: t.etiqueta, inicio: t.inicio, fin: t.fin, estado: estado, origen: origen, cupo: cupo, precio: precio,
          anotados: vend, libres: Math.max(0, cupo - vend), completo: estado === 'abierto' && vend >= cupo, nota: x ? x.nota : '', flyer: x ? x.flyer : '' };
        if (admin) { it.overrideId = x ? x.id : ''; it.cumple = o ? o.nombre : ''; }
        out.push(it);
      });
    });
  }
  return out;
}
/** Lo que ve el público: solo turnos abiertos, de hoy a un mes (los que la dueña abre a mano pueden estar más lejos). */
function juegoPublico_(p) {
  var cfg = config_(); if (!cfg.juegoActivo) return { activo: false, slots: [] };
  var key = 'juego:' + ver_(), cache = CacheService.getScriptCache(), hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var hoy = hoy_(), r = { activo: true, popup: cfg.juegoPopup, precio: cfg.juegoPrecio, duracion: cfg.juegoDuracion, texto: cfg.juegoTexto, flyer: cfg.juegoFlyer,
    slots: juegoSlots_(hoy, sumarDias_(hoy, 30), false).filter(function (x) { return x.estado === 'abierto'; }).map(function (x) { delete x.estado; delete x.origen; return x; }) };
  cache.put(key, JSON.stringify(r), 30);
  return r;
}
function juegoPublica_(r) {
  var cfg = config_(), s = porId_('Salones', r.salonId), o = { id: r.id, codigo: r.codigo, estado: r.estado, fecha: r.fecha, inicio: r.inicio, fin: r.fin, salon: s ? s.nombre : '',
    nombre: String(r.nombre || '').split(' ')[0], chicos: r.chicos, total: r.total, pagado: r.pagado, venceEn: r.venceEn,
    comprobante: r.compFecha ? { nombre: r.compNombre, fecha: r.compFecha, borrado: !r.compId } : null };
  if (r.estado === 'pendiente') o.transferencia = { titular: cfg.transferTitular, cbu: cfg.transferCbu, alias: cfg.transferAlias, banco: cfg.transferBanco, nota: cfg.transferNota, importe: r.total - r.pagado };
  return o;
}
function reservarJuego_(p) {
  var cfg = config_(); if (!cfg.juegoActivo) throw err_('NO_DISPONIBLE', 'La hora de juego no está habilitada');
  if (txt_(p.web) !== '') throw err_('RECHAZADO', 'Solicitud rechazada');
  var nombre = txt_(p.nombre, 80), tel = txt_(p.telefono, 30), chicos = Math.round(Number(p.chicos));
  if (nombre.length < 2) throw err_('DATO_INVALIDO', 'Falta el nombre del adulto');
  if (tel.replace(/\D/g, '').length < 6) throw err_('DATO_INVALIDO', 'Teléfono inválido');
  if (!(chicos >= 1 && chicos <= 100)) throw err_('DATO_INVALIDO', 'Poné cuántos chicos van');
  if (!fechaOk_(p.fecha)) throw err_('DATO_INVALIDO', 'Fecha inválida');
  return conLock_(function () {
    var sl = juegoSlots_(p.fecha, p.fecha, false).filter(function (x) { return x.salonId === txt_(p.salonId) && x.turnoId === txt_(p.turnoId) && x.estado === 'abierto'; })[0];
    if (!sl) throw err_('NO_DISPONIBLE', 'Ese horario ya no está disponible para hora de juego');
    if (sl.libres <= 0) throw err_('COMPLETO', 'Ese horario está completo');
    if (chicos > sl.libres) throw err_('CUPO', sl.libres === 1 ? 'Queda lugar para 1 chico' : 'Quedan lugares para ' + sl.libres + ' chicos');
    var pend = leerOpc_('JuegoReservas').filter(function (r) { return vigente_(r) && r.estado === 'pendiente' && r.telefono === tel; }).length;
    if (pend >= cfg.maxPendientesPorContacto) throw err_('DEMASIADAS_PENDIENTES', 'Ya tenés reservas pendientes de pago. Completalas o escribinos.');
    var total = chicos * sl.precio, iso = new Date(ahora_()).toISOString(), conPago = total > 0 && cfg.pagoTransferencia;
    var r = { id: nuevoId_('J'), codigo: nuevoCodigo_(), creada: iso, actualizada: iso, fecha: p.fecha, salonId: sl.salonId, turnoId: sl.turnoId, inicio: sl.inicio, fin: sl.fin, nombre: nombre, telefono: tel,
      chicos: chicos, total: total, pagado: 0, estado: conPago ? 'pendiente' : 'confirmada', origen: 'web', metodo: conPago ? 'transferencia' : '', nota: txt_(p.nota, 300),
      venceEn: conPago ? new Date(ahora_() + cfg.juegoHoldHoras * 3600000).toISOString() : '' };
    agregar_('JuegoReservas', r); invalidar_(); log_('web', 'reservarJuego', r.id + ' ' + r.fecha + ' ' + r.inicio + ' x' + chicos);
    juegoAviso_('Nueva hora de juego · ' + nombre, nombre + ' anotó ' + chicos + (chicos === 1 ? ' chico' : ' chicos') + ' el ' + r.fecha + ' a las ' + r.inicio + ' (' + sl.salon + '). Total ' + total + '. Tel: ' + tel + '.');
    return juegoPublica_(r);
  });
}
function juegoAviso_(asunto, texto) {
  try { var cfg = config_(); if (cfg.emailsActivos && cfg.emailAdmin && MailApp.getRemainingDailyQuota() > 3) MailApp.sendEmail({ to: cfg.emailAdmin, subject: '[Panel] ' + asunto, htmlBody: '<p>' + String(texto).replace(/</g, '&lt;') + '</p>' }); } catch (e) { log_('sistema', 'mail_error', e.message); }
}
function estadoJuego_(p) {
  var id = txt_(p.id, 40), cod = normCodigo_(p.codigo), r = null, cache = CacheService.getScriptCache();
  if (id) r = porId_('JuegoReservas', id);
  else if (cod) {
    if (Number(cache.get('cf') || 0) >= 40) throw err_('DEMASIADOS_INTENTOS', 'Hubo demasiados intentos. Probá de nuevo en unos minutos.');
    r = leerOpc_('JuegoReservas').filter(function (x) { return x.codigo === cod; })[0] || null;
    if (!r) cache.put('cf', String(Number(cache.get('cf') || 0) + 1), 900);
  }
  if (!r) throw err_('NO_ENCONTRADA', 'No encontramos esa reserva. Revisá el código.');
  if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) r.estado = 'vencida';
  return juegoPublica_(r);
}
/** Archivo (foto o PDF) en base64 → bytes validados. */
function archivoComp_(p) {
  var tipo = txt_(p.tipo, 60).toLowerCase(), ext = COMP_TIPOS[tipo];
  if (!ext) throw err_('ARCHIVO_INVALIDO', 'Subí una foto (JPG, PNG) o un PDF');
  var b64 = String(p.datos || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!b64) throw err_('ARCHIVO_INVALIDO', 'El archivo llegó vacío');
  if (b64.length * 0.75 > COMP_MAX) throw err_('ARCHIVO_GRANDE', 'El archivo pesa demasiado (máximo 6 MB)');
  var bytes = Utilities.base64Decode(b64); if (!bytes.length) throw err_('ARCHIVO_INVALIDO', 'El archivo llegó vacío');
  return { tipo: tipo, ext: ext, bytes: bytes, nombre: txt_(p.nombre, 80).replace(/[\\\/:*?"<>|]/g, '_') || ('comprobante.' + ext) };
}
function juegoCarpeta_() { var it = DriveApp.getFoldersByName(JUEGO_CARPETA); return it.hasNext() ? it.next() : DriveApp.createFolder(JUEGO_CARPETA); }
/** Guarda el comprobante de una reserva de juego. La imagen se borra sola a los 7 días; el dato (monto, quién, cuándo) queda en la reserva y en la caja. */
function guardarCompJuego_(id, p, origen) {
  var r = porId_('JuegoReservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  var a = archivoComp_(p), f = juegoCarpeta_().createFile(Utilities.newBlob(a.bytes, a.tipo, 'Juego ' + r.id + ' · ' + r.nombre + '.' + a.ext));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { log_('sistema', 'comp_share_error', e.message); }
  compBorrarArchivo_(r.compId);
  actualizar_('JuegoReservas', r._row, { compId: f.getId(), compUrl: f.getUrl(), compNombre: a.nombre, compTipo: a.ext, compFecha: new Date(ahora_()).toISOString(), compOrigen: origen,
    compBorrarEn: new Date(ahora_() + JUEGO_DIAS_COMP * 864e5).toISOString(), actualizada: new Date(ahora_()).toISOString() });
  invalidar_(); return porId_('JuegoReservas', id);
}
function comprobanteJuego_(p) {
  var id = txt_(p.id, 40), r = id && porId_('JuegoReservas', id);
  if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  if (r.estado === 'cancelada' || r.estado === 'vencida' || (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_())) throw err_('NO_DISPONIBLE', 'Esta reserva ya no admite comprobantes. Escribinos por WhatsApp.');
  return conLock_(function () {
    r = guardarCompJuego_(id, p, 'cliente'); log_('web', 'comprobanteJuego', id);
    juegoAviso_('Comprobante de hora de juego · ' + r.nombre, r.nombre + ' subió el comprobante de la reserva ' + r.id + ' (' + r.fecha + ' ' + r.inicio + ', ' + r.chicos + ' chicos, total ' + r.total + '). Confirmá el pago desde el panel.');
    return juegoPublica_(r);
  });
}
/** Trigger diario: borra las imágenes con más de 7 días. La reserva y la caja conservan el dato. */
function limpiarComprobantes_() {
  conLock_(function () {
    var n = 0;
    leerOpc_('JuegoReservas').forEach(function (r) {
      if (r.compId && r.compBorrarEn && Date.parse(r.compBorrarEn) <= ahora_()) {
        compBorrarArchivo_(r.compId);
        actualizar_('JuegoReservas', r._row, { compId: '', compUrl: '', compTipo: '', compNombre: 'Imagen borrada a los 7 días', compBorrarEn: '' }); n++;
      }
    });
    if (n) { invalidar_(); log_('sistema', 'comprobantes_borrados', String(n)); }
  });
  return 'ok';
}
/** Un cobro de hora de juego queda en la caja (Movimientos): una sola fila por reserva, se actualiza si cambia el monto. */
function juegoCaja_(r, usuario) {
  var d = r.nombre + ' · ' + r.chicos + (r.chicos === 1 ? ' chico' : ' chicos') + ' · hora de juego ' + r.fecha + ' ' + r.inicio, f = leerOpc_('Movimientos').filter(function (x) { return x.ref === r.id; })[0];
  if (r.pagado <= 0) { if (f) borrar_('Movimientos', f._row); return; }
  if (f) actualizar_('Movimientos', f._row, { monto: r.pagado, descripcion: d });
  else agregar_('Movimientos', { id: nuevoId_('M'), fecha: hoy_(), tipo: 'ingreso', categoria: 'Hora de juego', monto: r.pagado, descripcion: d, creado: new Date(ahora_()).toISOString(), usuario: usuario || '', ref: r.id });
}
function juegoCompleto_(id) {
  var r = porId_('JuegoReservas', id); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
  var s = porId_('Salones', r.salonId), c = r.compFecha ? { id: r.compId, url: r.compUrl, nombre: r.compNombre, tipo: r.compTipo, fecha: r.compFecha, origen: r.compOrigen, borraEn: r.compBorrarEn, borrado: !r.compId } : null;
  return { reserva: limpio_(r), salon: s ? s.nombre : '', comprobante: c };
}
Object.assign(ADMIN, {
  'admin.juego': function (p) {
    var hoy = hoy_(), d = fechaOk_(p.desde) ? p.desde : hoy, h = fechaOk_(p.hasta) ? p.hasta : sumarDias_(d, 13);
    var reservas = leerOpc_('JuegoReservas').filter(function (r) { return r.fecha >= d && r.fecha <= h; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.inicio < b.inicio ? -1 : 1; }).map(limpio_);
    reservas.forEach(function (r) { var s = porId_('Salones', r.salonId); r.salon = s ? s.nombre : ''; if (r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) <= ahora_()) r.estado = 'vencida'; delete r.compUrl; delete r.compId; });
    return { desde: d, hasta: h, hoy: hoy, slots: juegoSlots_(d, h, true), reservas: reservas };
  },
  /** estado: abierto | cerrado | auto (vuelve a lo automático). */
  'admin.juegoSlot': function (p, u) {
    var f = txt_(p.fecha, 10), est = txt_(p.estado, 10); if (!fechaOk_(f)) throw err_('DATO_INVALIDO', 'Fecha inválida');
    if (['abierto', 'cerrado', 'auto'].indexOf(est) < 0) throw err_('DATO_INVALIDO', 'Estado inválido');
    return conLock_(function () {
      var t = porId_('Turnos', txt_(p.turnoId)), s = t && porId_('Salones', t.salonId);
      if (!t || !s || !turnoAplica_(t, f)) throw err_('TURNO_INVALIDO', 'Ese turno no existe ese día');
      if (est === 'abierto' && ocupante_(leer_('Reservas').filter(function (r) { return r.fecha === f; }), s.id, f, t.inicio, t.fin)) throw err_('OCUPADO', 'Ese turno tiene un cumple reservado');
      var x = leer_('Juego').filter(function (q) { return q.fecha === f && q.salonId === s.id && q.turnoId === t.id; })[0] || null;
      if (est === 'auto') { if (x) borrar_('Juego', x._row); }
      else {
        var o = { fecha: f, salonId: s.id, turnoId: t.id, estado: est, cupo: Math.max(0, Math.round(Number(p.cupo) || 0)), precio: Math.max(0, Math.round(Number(p.precio) || 0)), nota: txt_(p.nota, 200), flyer: txt_(p.flyer, 400) };
        if (x) actualizar_('Juego', x._row, o); else { o.id = nuevoId_('JG'); o.creado = new Date(ahora_()).toISOString(); agregar_('Juego', o); }
      }
      invalidar_(); log_(u.email, 'juegoSlot', f + ' ' + t.id + ' ' + est);
      return { ok: true };
    });
  },
  'admin.juegoReserva': function (p) { return juegoCompleto_(txt_(p.id)); },
  /** Alta a mano (por WhatsApp, en el local): puede traer pago y comprobante. */
  'admin.juegoCrear': function (p, u) {
    var nombre = txt_(p.nombre, 80), tel = txt_(p.telefono, 30), chicos = Math.round(Number(p.chicos)), f = txt_(p.fecha, 10);
    if (nombre.length < 2) throw err_('DATO_INVALIDO', 'Falta el nombre'); if (!(chicos >= 1 && chicos <= 100)) throw err_('DATO_INVALIDO', 'Poné cuántos chicos van'); if (!fechaOk_(f)) throw err_('DATO_INVALIDO', 'Fecha inválida');
    return conLock_(function () {
      var t = porId_('Turnos', txt_(p.turnoId)), s = t && porId_('Salones', t.salonId); if (!t || !s || !turnoAplica_(t, f)) throw err_('TURNO_INVALIDO', 'Ese turno no existe ese día');
      var sl = juegoSlots_(f, f, true).filter(function (x) { return x.turnoId === t.id; })[0];
      if (sl && sl.estado === 'cumple') throw err_('OCUPADO', 'Ese turno tiene un cumple reservado');
      if (sl && !p.forzar && chicos > sl.libres) throw err_('CUPO', 'Solo quedan ' + sl.libres + ' lugares en ese horario');
      var precio = sl ? sl.precio : config_().juegoPrecio, total = p.total != null && p.total !== '' ? Math.max(0, num_(p.total, 'total')) : chicos * precio, pagado = Math.max(0, Number(p.pagado) || 0), iso = new Date(ahora_()).toISOString();
      var origen = ['panel', 'whatsapp', 'local'].indexOf(p.origen) >= 0 ? p.origen : 'panel';
      var r = { id: nuevoId_('J'), codigo: nuevoCodigo_(), creada: iso, actualizada: iso, fecha: f, salonId: s.id, turnoId: t.id, inicio: t.inicio, fin: t.fin, nombre: nombre, telefono: tel, chicos: chicos, total: total, pagado: pagado,
        estado: pagado > 0 || total === 0 ? 'confirmada' : 'pendiente', origen: origen, metodo: txt_(p.metodo || (pagado > 0 ? 'transferencia' : ''), 30), nota: txt_(p.nota, 300),
        venceEn: pagado > 0 || total === 0 ? '' : new Date(ahora_() + config_().juegoHoldHoras * 3600000).toISOString() };
      agregar_('JuegoReservas', r);
      if (p.datos) guardarCompJuego_(r.id, { nombre: p.compNombre, tipo: p.tipo, datos: p.datos }, 'dueño');
      r = porId_('JuegoReservas', r.id); juegoCaja_(r, u.email); invalidar_(); log_(u.email, 'juegoCrear', r.id);
      return juegoCompleto_(r.id);
    });
  },
  /** Confirma el pago (monto = lo que entró; si no lo mandás, el total). Queda registrado en la caja. */
  'admin.juegoPago': function (p, u) { return conLock_(function () {
    var r = porId_('JuegoReservas', txt_(p.id, 40)); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
    if (r.estado === 'cancelada') throw err_('ESTADO', 'La reserva está cancelada');
    var monto = p.monto != null && p.monto !== '' ? num_(p.monto, 'monto') : r.total; if (monto < 0) throw err_('DATO_INVALIDO', 'Monto inválido');
    actualizar_('JuegoReservas', r._row, { pagado: monto, estado: monto > 0 || r.total === 0 ? 'confirmada' : r.estado, venceEn: monto > 0 || r.total === 0 ? '' : r.venceEn, metodo: txt_(p.metodo || r.metodo || 'transferencia', 30), actualizada: new Date(ahora_()).toISOString() });
    r = porId_('JuegoReservas', r.id); juegoCaja_(r, u.email); invalidar_(); log_(u.email, 'juegoPago', r.id + ' ' + monto); return juegoCompleto_(r.id); }); },
  'admin.juegoCancelar': function (p, u) { return conLock_(function () {
    var r = porId_('JuegoReservas', txt_(p.id, 40)); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
    actualizar_('JuegoReservas', r._row, { estado: 'cancelada', venceEn: '', actualizada: new Date(ahora_()).toISOString() }); invalidar_(); log_(u.email, 'juegoCancelar', r.id); return juegoCompleto_(r.id); }); },
  'admin.juegoComprobante': function (p, u) { return conLock_(function () { var id = txt_(p.id, 40); guardarCompJuego_(id, p, 'dueño'); log_(u.email, 'juegoComprobante', id); return juegoCompleto_(id); }); },
  'admin.juegoComprobanteEliminar': function (p, u) { return conLock_(function () {
    var r = porId_('JuegoReservas', txt_(p.id, 40)); if (!r) throw err_('NO_ENCONTRADA', 'Reserva no encontrada');
    compBorrarArchivo_(r.compId); actualizar_('JuegoReservas', r._row, { compId: '', compUrl: '', compTipo: '', compNombre: 'Imagen borrada', compBorrarEn: '' }); invalidar_(); return juegoCompleto_(r.id); }); }
});

/* ───────────────────────── instalación / mantenimiento ───────────────────────── */
var PLANES_EJEMPLO = [
  { nombre: 'Combo Despegue', descripcion: 'Hasta 15 invitados · 3 horas de salón con juegos · 2 animadores · mesa dulce básica · cotillón', precio: 180000, orden: 1 },
  { nombre: 'Combo Órbita', descripcion: 'Hasta 25 invitados · 4 horas de salón con juegos · 3 animadores y baile con DJ · mesa dulce y torta · cotillón y souvenirs · invitación online', precio: 260000, orden: 2 },
  { nombre: 'Combo Galaxia', descripcion: 'Hasta 40 invitados · 5 horas de salón con juegos · 4 animadores, DJ y show de magia · mesa dulce, torta y catering · cotillón, souvenirs y fotógrafo · invitación online', precio: 380000, orden: 3 }
];
/* Carga 3 planes de ejemplo SOLO si todavía no hay ninguno. Después se editan o borran desde el panel (Turnos → Planes). */
function cargarPlanesEjemplo_() {
  var n = 0;
  conLock_(function () {
    if (leer_('Planes').length) return;
    PLANES_EJEMPLO.forEach(function (p) { agregar_('Planes', { id: nuevoId_('PL'), nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, senaTipo: 'pct', senaValor: 30, orden: p.orden, activo: true }); n++; });
    invalidar_();
  });
  try { SpreadsheetApp.getUi().alert(n ? 'Listo: se cargaron ' + n + ' planes de ejemplo (seña 30%). Entrá al panel, Turnos → Planes, y cambiá nombres, precios y lo que incluye.' : 'Ya hay planes cargados, no se tocó nada.'); } catch (e) {}
  return n;
}
function onOpen() {
  try { var m = SpreadsheetApp.getUi().createMenu('Weeb Reservas').addItem('Instalar / reparar hojas', 'instalar').addItem('Crear o cambiar usuario del panel', 'menuUsuario_').addItem('Cargar planes de ejemplo (Despegue, Órbita, Galaxia)', 'cargarPlanesEjemplo_').addItem('Hacer backup ahora', 'backup_'); if (typeof cargarQuokka_ === 'function') m.addItem('Cargar datos de Quokka', 'cargarQuokka_'); m.addToUi(); } catch (e) {}
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
  if (!leer_('Servicio').length) Object.keys(SERVICIO_DEF).forEach(function (k) { agregar_('Servicio', { clave: k, valor: SERVICIO_DEF[k] }); });
  if (!leer_('Config').length) Object.keys(CFG_DEF).forEach(function (k) { agregar_('Config', { clave: k, valor: CFG_DEF[k] }); });
  secreto_();
  ScriptApp.getProjectTriggers().forEach(function (t) { var f = t.getHandlerFunction(); if (f === 'vencer_' || f === 'backup_' || f === 'limpiarComprobantes_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('vencer_').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('backup_').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('limpiarComprobantes_').timeBased().everyDays(1).atHour(4).create();
  return 'Listo: hojas, salón de ejemplo, opciones y tareas automáticas instaladas.';
}
function backup_() {
  var f = ss_(), carpetas = DriveApp.getFoldersByName('Weeb backups'), c = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder('Weeb backups');
  DriveApp.getFileById(f.getId()).makeCopy(f.getName() + ' · backup ' + hoy_(), c);
  var viejos = [], it = c.getFiles(); while (it.hasNext()) viejos.push(it.next());
  viejos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); }).slice(14).forEach(function (x) { x.setTrashed(true); });
}
