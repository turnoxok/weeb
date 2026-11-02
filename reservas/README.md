# Weeb Reservas

Sistema de reservas para salones de fiestas infantiles. **Un solo código para todos los clientes**: lo que cambia vive en la hoja de cada uno (pestañas `Config`, `Salones`, `Turnos`), nunca en el código.

## Estado
| Pieza | Estado |
|---|---|
| `backend/Codigo.gs` (Apps Script) | hecho, 47 pruebas automáticas |
| Calendario + formulario de reserva en la web | pendiente |
| Panel del dueño (PWA instalable) | pendiente |
| Pagos online (Mercado Pago por OAuth) | pendiente (hoy: transferencia con confirmación manual) |
| Panel tuweeb (cobros anuales, seguimiento comercial) | pendiente (se diseña después) |

## Instalar un cliente nuevo
1. Copiar la hoja plantilla (o crear una hoja nueva) en el Drive de tuweeb.
2. Extensiones > Apps Script: pegar `Codigo.gs` y `appsscript.json`.
3. Menú **Weeb Reservas > Instalar / reparar hojas** (crea pestañas, un salón de ejemplo, opciones y tareas automáticas: vencer reservas cada 5 min y backup diario).
4. Completar en la pestaña `Config`: `nombre`, `logoUrl`, `whatsapp`, `direccion`, `mapsUrl`, datos de transferencia, `adminEmails` y `googleClientId`.
5. Implementar > Aplicación web (ejecutar como yo, acceso: cualquier persona). La URL `/exec` es la API del cliente y va en la configuración de su web.

## Modelo de datos (pestañas)
- **Salones**: uno o varios por cliente. Cada salón tiene sus propios turnos y no se pisa con los otros.
- **Turnos**: plantilla semanal. `dias` = `0` domingo … `6` sábado (ej. `5,6,0`), `inicio`/`fin` (3 hs, 4 hs, lo que sea; puede cruzar medianoche), `precio`, seña (`senaTipo` = `pct` | `monto` | `ninguna`, `senaValor`; **$0 = sin seña**), `desde`/`hasta` opcionales para temporadas.
- **Bloqueos**: día, rango de días, o un turno puntual (o todos los salones).
- **Reservas**, **Pagos** (cada pago con fecha y método; un monto negativo es devolución), **Movimientos** (ingresos y egresos fuera de reservas), **Usuarios**, **Log**.

Estados de una reserva: `pendiente` (con vencimiento, ocupa el turno) → `confirmada` (cubrió la seña) → `saldada`; o `cancelada` / `vencida` (liberan el turno).

## API
Todo JSON. Los POST se mandan como `text/plain` (evita el preflight CORS). Respuesta: `{ok:true,data}` o `{ok:false,error,mensaje}`.

**Público**
- `GET ?action=config` — datos públicos del negocio y salones.
- `GET ?action=disponibilidad&mes=YYYY-MM` — calendario del mes (se pide mes a mes; el límite de anticipación se configura con `mesesAnticipacion`).
- `POST {action:'reservar', turnoId, fecha, nombre, telefono, email, personas, nota, metodo, web:''}` — `web` es un campo trampa para bots, debe ir vacío.
- `GET ?action=estado&id=R…` — estado de la reserva (para la página de "reserva recibida / pago aprobado / rechazado").

**Panel** — `POST {action:'admin.…', token:<Google ID token>}`: `ping`, `agenda`, `reservas`, `reserva`, `crearReserva` (alta manual, con pago inicial opcional), `actualizarReserva` (editar, mover de día o turno, cambiar estado), `cancelar`, `pago`, `pagoEliminar`, `bloqueos`, `bloquear`, `desbloquear`, `salones`, `guardarSalon`, `turnos`, `guardarTurno`, `borrarTurno`, `movimientos`, `movimiento`, `movimientoEliminar`, `caja` (mes), `config`, `guardarConfig`.

## Garantías que cubren las pruebas
No hay doble reserva (bloqueo de concurrencia + chequeo de superposición horaria, incluso si el dueño cambia luego los horarios del turno); las pendientes vencidas liberan el turno; el calendario público nunca muestra datos de clientes; el panel rechaza tokens ajenos, de otra app o de cuentas no autorizadas; cambios del panel se ven al instante pese al caché; un error interno devuelve un mensaje amable.

## Probar
```
node reservas/backend/test/test.js
```
El simulador (`test/mock.js`) reemplaza Sheets, Mail, Cache y Lock. Falta una prueba real contra Google Sheets antes de entregar el primer cliente.

## Decisiones tomadas
- Las hojas son de tuweeb (una por cliente), no del dueño.
- Sin comisión por pagos online por ahora; los mails salen desde la cuenta de la hoja.
- Varios salones soportados desde el modelo.
