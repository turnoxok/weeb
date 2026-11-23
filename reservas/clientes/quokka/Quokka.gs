
/* ───────────────────────── QUOKKA PELOTERO: datos iniciales ─────────────────────────
   Menú "Weeb Reservas > Cargar datos de Quokka". Se puede correr más de una vez: no duplica nada y no pisa lo que la dueña ya cambió
   (solo completa lo que falta). Los precios de los cumpleaños se cargan después desde el panel (Turnos). */
var QUOKKA = {
  config: {
    nombre: 'Quokka Pelotero', colorPrincipal: '#4d75ba', whatsapp: '5492994667251', direccion: 'Aguado 2280, Neuquén',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Aguado%202280%2C%20Neuqu%C3%A9n',
    mesesAnticipacion: 12, antelacionHoras: 24, holdHorasTransferencia: 24, autoConfirmarSinSena: false,
    juegoActivo: true, juegoCupo: 20, juegoPrecio: 20000, juegoDiasAntes: 5, juegoAuto: true, juegoDuracion: '2 horas', juegoPopup: true,
    juegoTexto: 'Los chicos juegan 2 horas en el pelotero, sin fiesta. Anotá a tus chicos y elegí el horario.',
    textoConfirmacion: '¡Gracias por elegir Quokka! Cualquier duda escribinos por WhatsApp.'
  },
  salones: [
    { id: 'S1', nombre: 'Quokka Original (0 a 9 años)', orden: 1 },
    { id: 'S2', nombre: 'Quokka Selva (0 a 5 años)', orden: 2 }
  ],
  /* lunes a viernes: 2 horarios · sábados y domingos: 3 horarios (por salón) */
  horarios: [
    { dias: '1,2,3,4,5', inicio: '14:30', fin: '17:00', etiqueta: 'Tarde' },
    { dias: '1,2,3,4,5', inicio: '18:00', fin: '20:30', etiqueta: 'Noche' },
    { dias: '6,0', inicio: '11:00', fin: '13:30', etiqueta: 'Mañana' },
    { dias: '6,0', inicio: '14:30', fin: '17:00', etiqueta: 'Tarde' },
    { dias: '6,0', inicio: '18:00', fin: '20:30', etiqueta: 'Noche' }
  ],
  servicio: {   // lo que Quokka le paga a tuweeb (solo lectura para ellos en el panel)
    precioTotal: 890000, cuotas: 1, valorCuota: 890000,
    incluye: 'Web 3D con tu logo y tus mascotas|Reservas de cumpleaños y hora de juego|Panel desde el celular con los dos salones|Dominio .com gratis el primer año|Hosting y soporte|Tercer salón (Quokka Park): adicional de $380.000'
  }
};
function cargarQuokka_() {
  instalar();
  var n = { config: 0, salones: 0, turnos: 0 };
  conLock_(function () {
    var filas = leer_('Config'), q = QUOKKA;
    Object.keys(q.config).forEach(function (k) {
      var f = filas.filter(function (r) { return r.clave === k; })[0], d = CFG_DEF[k], porDefecto = d === undefined || String(f ? f.valor : d) === String(d);
      if (!f) { agregar_('Config', { clave: k, valor: q.config[k] }); n.config++; }
      else if (porDefecto || f.valor === '' || f.valor == null) { actualizar_('Config', f._row, { valor: q.config[k] }); n.config++; }   // solo si todavía tiene el valor de fábrica
    });
    q.salones.forEach(function (s) {
      var f = porId_('Salones', s.id);
      if (!f) { agregar_('Salones', { id: s.id, nombre: s.nombre, capacidad: 0, activo: true, orden: s.orden }); n.salones++; }
      else if (f.nombre === 'Salón principal') { actualizar_('Salones', f._row, { nombre: s.nombre, orden: s.orden }); n.salones++; }
    });
    var ts = leer_('Turnos');
    q.salones.forEach(function (s) {
      q.horarios.forEach(function (h) {
        if (ts.some(function (t) { return t.salonId === s.id && t.dias === h.dias && t.inicio === h.inicio && t.fin === h.fin; })) return;
        agregar_('Turnos', { id: nuevoId_('T'), salonId: s.id, dias: h.dias, inicio: h.inicio, fin: h.fin, etiqueta: h.etiqueta, precio: 0, senaTipo: 'pct', senaValor: 30, desde: '', hasta: '', activo: true }); n.turnos++;
      });
    });
    var sv = leer_('Servicio'); Object.keys(q.servicio).forEach(function (k) { var f = sv.filter(function (r) { return r.clave === k; })[0]; if (f) actualizar_('Servicio', f._row, { valor: q.servicio[k] }); else agregar_('Servicio', { clave: k, valor: q.servicio[k] }); });
    CFG_MEMO = null; invalidar_();
  });
  var msg = 'Listo. Se cargaron ' + n.config + ' opciones, ' + n.salones + ' salones y ' + n.turnos + ' horarios. Falta: crear el usuario del panel (menú) y cargar los precios de los cumples desde el panel (Turnos).';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}
