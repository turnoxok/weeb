/**
 * WEEB RESERVAS — DEMO "Mundo Mágico".
 * Archivo APARTE: se pega en el mismo proyecto de Apps Script, al lado de Codigo.gs (Archivos > + > Secuencia de comandos > nombre "Demo").
 * Carga un salón de fiestas infantiles de mentira, con 2 planes y reservas del 1 al 10 de noviembre
 * (señas, pagos parciales, pagos totales), próximas fechas, un bloqueo y un poco de caja, para mostrar el panel en acción.
 *
 * USAR SOLO EN UNA HOJA DE DEMO (hoja nueva). Para proteger a un cliente real: si la hoja ya tiene reservas de otro salón, se niega a correr.
 *
 * Cómo se usa:  1) Hoja nueva + Codigo.gs ya instalado (menú Weeb Reservas > Instalar).  2) Elegir la función "cargarDemo" y tocar Ejecutar.
 * Para volver a empezar de cero, correr cargarDemo otra vez (borra lo del demo y lo vuelve a cargar).
 * Entrada al panel:  demo@mundomagico.com.ar  /  MundoMagico2026
 */
var DEMO = {
  mes: '2026-11',                       // mes de las reservas (cambiar si hace falta)
  nombre: 'Mundo Mágico',
  email: 'demo@mundomagico.com.ar',
  clave: 'MundoMagico2026',
  sobreescribir: true                   // true = carga el demo aunque la hoja tenga datos de OTRO salón (los reemplaza, sin copia). false = se frena para proteger un cliente real
};

function demoLimpiar_() {
  ['Config', 'Salones', 'Turnos', 'Bloqueos', 'Reservas', 'Planes', 'Pagos', 'Movimientos', 'Servicio', 'ServicioPagos', 'Log'].forEach(function (n) {
    var s = hoja_(n), last = s.getLastRow();
    if (last > 1) s.deleteRows(2, last - 1);
  });
}

function cargarDemo() {
  if (!ss_().getSheetByName('Reservas')) instalar();                       // hoja recién creada: arma las pestañas
  var cfg0 = config_(), esDemo = cfg0.nombre === DEMO.nombre;
  var hayDatos = leer_('Reservas').length || leer_('Turnos').length || leer_('Planes').length || (cfg0.nombre !== CFG_DEF.nombre);
  if (hayDatos && !esDemo) {
    if (!DEMO.sobreescribir) throw new Error('Esta hoja ya tiene datos de "' + cfg0.nombre + '" (nombre, turnos, planes, reservas). Cargar el demo los REEMPLAZA y cambia lo que ve su página de reservas. Si es lo que querés, poné sobreescribir: true arriba de todo en el archivo Demo y volvé a correr.');
  }
  demoLimpiar_(); CFG_MEMO = null;

  var D = function (d) { return DEMO.mes + '-' + (d < 10 ? '0' : '') + d; };
  var ahoraIso = new Date(ahora_()).toISOString();

  /* — Configuración del salón — */
  var cfg = {
    nombre: DEMO.nombre, colorPrincipal: '#7b3fe4', whatsapp: '5493442550100',
    direccion: 'Sarmiento 745, Villa Elisa, Entre Ríos', mapsUrl: 'https://maps.google.com/?q=Villa+Elisa+Entre+Rios',
    mesesAnticipacion: 12, antelacionHoras: 24, pagoTransferencia: true, pagoMercadoPago: true,
    transferTitular: 'Mundo Mágico Eventos', transferCbu: '0000003100012345678901', transferAlias: 'mundomagico.fiestas', transferBanco: 'Banco de Entre Ríos',
    transferNota: 'Mandanos el comprobante por WhatsApp para confirmar tu fecha.',
    holdHorasTransferencia: 24, holdMinutosOnline: 20, autoConfirmarSinSena: true,
    emailsActivos: false, emailAdmin: '', textoConfirmacion: '¡Gracias por elegirnos! Te esperamos para una fiesta mágica.'
  };
  Object.keys(cfg).forEach(function (k) { agregar_('Config', { clave: k, valor: cfg[k] }); });
  CFG_MEMO = null;

  /* — Salón, turnos y planes — */
  agregar_('Salones', { id: 'S1', nombre: 'Salón Mundo Mágico', capacidad: 60, activo: true, orden: 1 });
  agregar_('Turnos', { id: 'T_TARDE', salonId: 'S1', dias: '0,1,2,3,4,5,6', inicio: '16:30', fin: '20:30', etiqueta: 'Tarde', precio: 180000, senaTipo: 'pct', senaValor: 30, desde: '', hasta: '', activo: true });
  agregar_('Turnos', { id: 'T_MANANA', salonId: 'S1', dias: '0,6', inicio: '10:00', fin: '14:00', etiqueta: 'Mañana (sáb y dom)', precio: 180000, senaTipo: 'pct', senaValor: 30, desde: '', hasta: '', activo: true });
  agregar_('Planes', { id: 'PL_A', nombre: 'Fiesta Mágica', descripcion: 'Hasta 20 chicos · 4 horas de salón con juegos · 2 animadores · mesa dulce y torta · cotillón · invitación online',
    precio: 180000, senaTipo: 'pct', senaValor: 30, orden: 1, activo: true });
  agregar_('Planes', { id: 'PL_B', nombre: 'Fiesta Súper Mágica', descripcion: 'Hasta 35 chicos · 4 horas de salón con juegos · 3 animadores y DJ · mesa dulce, torta y catering · cotillón y souvenirs · fotógrafo · invitación online',
    precio: 290000, senaTipo: 'monto', senaValor: 100000, orden: 2, activo: true });
  var PL = { A: { id: 'PL_A', nombre: 'Fiesta Mágica', precio: 180000, sena: 54000 }, B: { id: 'PL_B', nombre: 'Fiesta Súper Mágica', precio: 290000, sena: 100000 } };

  /* — Reservas. pagos: [fecha, monto, método, nota]. estado 'x' = lo fuerza (cancelada/vencida/pendiente). — */
  var T = { T: ['T_TARDE', '16:30', '20:30'], M: ['T_MANANA', '10:00', '14:00'] };
  var R = [
    // ---- del 1 al 10 de noviembre: un festejo por día como mínimo ----
    [1, 'M', 'Valentina Rojas', '3442 55-0121', 'valen.rojas.demo@gmail.com', 18, 'A', 'Cumple de Mía (5 años). Tema unicornios.', 'web',
      [['2026-10-20', 54000, 'transferencia', 'Seña'], [D(1), 126000, 'efectivo', 'Saldo el día de la fiesta']]],
    [1, 'T', 'Gabriela Benítez', '3442 55-0122', 'gabi.benitez.demo@gmail.com', 30, 'B', 'Cumple de Bautista (7). Torta de Mario Bros.', 'web',
      [['2026-10-12', 100000, 'mercadopago', 'Seña online'], [D(1), 190000, 'efectivo', 'Saldo']]],
    [2, 'T', 'Carolina Gómez', '3442 55-0123', 'caro.gomez.demo@gmail.com', 15, 'A', 'Cumple de Lola (4). Pagó todo por adelantado.', 'manual',
      [['2026-10-25', 180000, 'transferencia', 'Pago total anticipado']]],
    [3, 'T', 'Martín Acosta', '3442 55-0124', 'martin.acosta.demo@gmail.com', 28, 'B', 'Cumple de Thiago (8). Queda saldo por cobrar.', 'web',
      [['2026-10-28', 100000, 'transferencia', 'Seña'], [D(3), 120000, 'efectivo', 'Pago parcial el día de la fiesta']]],
    [4, 'T', 'Daniela Ferreyra', '3442 55-0125', 'dani.ferreyra.demo@gmail.com', 16, 'A', 'Cumple de Emma (6).', 'web',
      [['2026-10-30', 54000, 'mercadopago', 'Seña online'], [D(4), 126000, 'transferencia', 'Saldo']]],
    [5, 'T', 'Julieta Sosa', '3442 55-0126', 'juli.sosa.demo@gmail.com', 12, 'A', 'Cumple de Joaquín (3). Pagó todo en efectivo.', 'manual',
      [[D(5), 180000, 'efectivo', 'Pago total contado']]],
    [6, 'T', 'Natalia Villalba', '3442 55-0127', 'nati.villalba.demo@gmail.com', 32, 'B', 'Cumple de los mellizos Santino y Renzo (9).', 'web',
      [['2026-10-18', 100000, 'transferencia', 'Seña'], [D(6), 190000, 'transferencia', 'Saldo']]],
    [7, 'M', 'Romina Sánchez', '3442 55-0128', 'romi.sanchez.demo@gmail.com', 20, 'A', 'Cumple de Alma (5). Alérgicos al maní: avisar a cocina.', 'web',
      [['2026-10-22', 54000, 'transferencia', 'Seña'], [D(6), 126000, 'transferencia', 'Saldo']]],
    [7, 'T', 'Gustavo Díaz', '3442 55-0129', 'gus.diaz.demo@gmail.com', 34, 'B', 'Cumple de Facundo (10). Traen la torta.', 'web',
      [['2026-10-15', 100000, 'mercadopago', 'Seña online'], [D(7), 190000, 'efectivo', 'Saldo']]],
    [8, 'M', 'Sabrina Medina', '3442 55-0130', 'sabri.medina.demo@gmail.com', 14, 'A', 'Cumple de Olivia (4).', 'manual',
      [['2026-10-29', 54000, 'efectivo', 'Seña'], [D(8), 126000, 'efectivo', 'Saldo']]],
    [8, 'T', 'Pablo Cardozo', '3442 55-0131', 'pablo.cardozo.demo@gmail.com', 30, 'B', 'Cumple de Benjamín (6). Queda saldo por cobrar.', 'web',
      [['2026-10-26', 100000, 'transferencia', 'Seña'], [D(8), 100000, 'efectivo', 'Pago parcial']]],
    [9, 'T', 'Lucía Fernández', '3442 55-0132', 'lu.fernandez.demo@gmail.com', 18, 'A', 'Cumple de Mora (7). Pagó todo junto.', 'web',
      [[D(9), 180000, 'transferencia', 'Pago total']]],
    [10, 'T', 'Andrea Molina', '3442 55-0133', 'andre.molina.demo@gmail.com', 17, 'A', 'Cumple de Tomás (5). Es hoy: falta cobrar el saldo.', 'web',
      [['2026-11-02', 54000, 'mercadopago', 'Seña online']]],
    // ---- próximas fechas ----
    [11, 'T', 'Cecilia Arias', '3442 55-0134', 'ceci.arias.demo@gmail.com', 15, 'A', 'Cumple de Isabella (4).', 'web', [['2026-11-08', 54000, 'transferencia', 'Seña']]],
    [13, 'T', 'Marina Ledesma', '3442 55-0135', 'mari.ledesma.demo@gmail.com', 30, 'B', 'Cumple de Dante (8).', 'web', [['2026-11-09', 100000, 'mercadopago', 'Seña online']]],
    [14, 'M', 'Florencia Quiroga', '3442 55-0136', 'flor.quiroga.demo@gmail.com', 16, 'A', 'Cumple de Catalina (6). Espera confirmar la transferencia.', 'web', [], 'pendiente'],
    [14, 'T', 'Matías Ibarra', '3442 55-0137', 'mati.ibarra.demo@gmail.com', 33, 'B', 'Cumple de Lautaro (9). Ya pagó todo.', 'manual', [['2026-11-05', 290000, 'transferencia', 'Pago total anticipado']]],
    [15, 'T', 'Eliana Páez', '3442 55-0138', 'eli.paez.demo@gmail.com', 18, 'A', 'Cumple de Zoe (5).', 'web', [['2026-11-10', 54000, 'transferencia', 'Seña']]],
    [21, 'T', 'Brenda Luna', '3442 55-0139', 'bren.luna.demo@gmail.com', 25, 'B', 'Canceló por viaje.', 'web', [], 'cancelada'],
    [22, 'M', 'Sergio Maidana', '3442 55-0140', 'sergio.maidana.demo@gmail.com', 14, 'A', 'No mandó la seña a tiempo.', 'web', [], 'vencida']
  ];
  R.forEach(function (x) {
    var t = T[x[1]], p = PL[x[6]], id = nuevoId_('R'), forzado = x[10];
    var r = { id: id, creada: ahoraIso, actualizada: ahoraIso, salonId: 'S1', fecha: D(x[0]), turnoId: t[0], inicio: t[1], fin: t[2], nombre: x[2], telefono: x[3], email: x[4], personas: x[5],
      nota: x[7], total: p.precio, sena: p.sena, pagado: 0, saldo: p.precio, estado: 'pendiente', origen: x[8], metodo: x[8] === 'web' ? (x[9].length && x[9][0][2] === 'mercadopago' ? 'mercadopago' : 'transferencia') : 'efectivo',
      venceEn: forzado === 'pendiente' ? new Date(ahora_() + 24 * 3600000).toISOString() : '', extRef: '', planId: p.id, plan: p.nombre };
    r.fecha = D(x[0]);
    agregar_('Reservas', r);
    x[9].forEach(function (g) { agregar_('Pagos', { id: nuevoId_('P'), reservaId: id, fecha: g[0], monto: g[1], metodo: g[2], nota: g[3], creado: ahoraIso, usuario: DEMO.email }); });
    if (x[9].length) recalcular_(id);
    if (forzado === 'cancelada' || forzado === 'vencida') actualizar_('Reservas', porId_('Reservas', id)._row, { estado: forzado, venceEn: '' });
    // las reservas de manual sin seña pedida quedan confirmadas aunque solo tengan un pago parcial
    var cur = porId_('Reservas', id);
    if (!forzado && cur.estado === 'pendiente') actualizar_('Reservas', cur._row, { estado: 'confirmada', venceEn: '' });
  });

  /* — Un bloqueo y la caja del mes — */
  agregar_('Bloqueos', { id: nuevoId_('B'), desde: D(24), hasta: D(25), salonId: '*', turnoId: '*', motivo: 'Pintura y mantenimiento del salón', creado: ahoraIso });
  var M = [
    ['2026-11-01', 'egreso', 'Sueldos', 120000, 'Animadores del fin de semana'],
    ['2026-11-02', 'egreso', 'Mercadería', 85000, 'Mesa dulce y bebidas'],
    ['2026-11-03', 'egreso', 'Limpieza', 25000, 'Productos y personal'],
    ['2026-11-05', 'egreso', 'Luz y gas', 38000, 'Facturas del mes'],
    ['2026-11-06', 'egreso', 'Publicidad', 15000, 'Promoción en redes'],
    ['2026-11-07', 'ingreso', 'Venta de bebidas', 18500, 'Kiosco del salón'],
    ['2026-11-08', 'ingreso', 'Alquiler de metegol', 12000, 'Evento aparte']
  ];
  M.forEach(function (m) { agregar_('Movimientos', { id: nuevoId_('M'), fecha: m[0], tipo: m[1], categoria: m[2], monto: m[3], descripcion: m[4], creado: ahoraIso, usuario: DEMO.email }); });

  /* — Lo que el salón le paga a tuweeb por su sitio (pestaña "Servicio" del panel) — */
  var sv = { precioTotal: 720000, cuotas: 6, valorCuota: 120000, edicionesIncluidas: 3, edicionesUsadas: 1, renovacionUsd: 49, dominio: 'mundomagico.com.ar', dominioFecha: '2026-09-15' };
  Object.keys(sv).forEach(function (k) { agregar_('Servicio', { clave: k, valor: sv[k] }); });
  agregar_('Servicio', { clave: 'incluye', valor: SERVICIO_DEF.incluye });
  [['2026-09-15', 'Cuota 1'], ['2026-10-15', 'Cuota 2'], ['2026-11-05', 'Cuota 3']].forEach(function (c) { agregar_('ServicioPagos', { id: nuevoId_('SP'), fecha: c[0], monto: 120000, nota: c[1] }); });

  definirUsuario_(DEMO.email, DEMO.clave, 'Dueña del salón', 'admin');
  invalidar_();
  var msg = 'Demo cargado: ' + R.length + ' reservas, 2 planes. Entrá al panel con ' + DEMO.email + ' / ' + DEMO.clave;
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/**
 * VACIAR LA HOJA: borra TODO lo cargado (reservas, pagos, turnos, planes, bloqueos, caja, configuración, historial y usuarios del panel)
 * y la deja como recién instalada (un "Salón principal" vacío y las opciones por defecto). 
 * Pide confirmación escribiendo BORRAR. Después hay que crear de nuevo el usuario del panel: menú Weeb Reservas > Crear o cambiar usuario.
 */
function borrarTodo() {
  var ui = null; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) {
    var a = ui.prompt('Vaciar la hoja', 'Se borra TODO lo de esta hoja (reservas, pagos, turnos, planes, configuración y usuarios). \nPara seguir, escribí BORRAR:', ui.ButtonSet.OK_CANCEL);
    if (a.getSelectedButton() !== ui.Button.OK || a.getResponseText().trim() !== 'BORRAR') { ui.alert('No se borró nada.'); return 'cancelado'; }
  }
  Object.keys(TABLAS).forEach(function (n) {
    var s = ss_().getSheetByName(n); if (!s) return;
    var last = s.getLastRow(); if (last > 1) s.deleteRows(2, last - 1);
  });
  CFG_MEMO = null;
  var msg = instalar() + ' Quedó vacía. Creá el usuario del panel desde el menú Weeb Reservas.';
  invalidar_();
  if (ui) ui.alert(msg);
  return msg;
}
