# Weeb Reservas

Sistema de reservas para salones de fiestas infantiles. **Un solo código para todos los clientes**: lo que cambia vive en la hoja de cada uno (pestañas `Config`, `Salones`, `Turnos`), nunca en el código.

## Estado
| Pieza | Estado |
|---|---|
| `backend/Codigo.gs` (Apps Script) | hecho, 53 pruebas automáticas, probado con la hoja real (config) |
| `plantillas/reservar` — calendario y reserva del cliente final | hecho, probado en navegador |
| `plantillas/panel` — panel del dueño (PWA instalable) | hecho, probado en navegador |
| Botón "Reservar" dentro de la web 3D | pendiente (por ahora la página `reservar/` se enlaza desde el sitio) |
| Pagos online (Mercado Pago por OAuth) | pendiente (hoy: transferencia con confirmación manual) |
| Panel tuweeb (cobros anuales, seguimiento comercial) | pendiente |

## Instalar un cliente nuevo
1. Hoja de Google nueva en el Drive de tuweeb. Extensiones > Apps Script: pegar `backend/Codigo.gs` y (en Configuración del proyecto, "Mostrar appsscript.json") `backend/appsscript.json`.
2. Recargar la hoja. Menú **Weeb Reservas > Instalar / reparar hojas** (crea pestañas, un salón de ejemplo, opciones y tareas automáticas: vencer reservas cada 5 min y backup diario).
3. Menú **Weeb Reservas > Crear o cambiar usuario del panel**: mail y clave del dueño (la clave se guarda cifrada).
4. Implementar > Aplicación web (ejecutar como yo, acceso: cualquier persona). Copiar la URL `/exec`.
5. Generar las carpetas del cliente:
   `python3 reservas/herramientas/armar_cliente.py --api <URL /exec> --nombre "Cliente" --color "#8149bd" [--logo logo.png] --salida proyectos/cliente`
   Quedan `panel/` (el dueño entra a `suweb.com/panel`) y `reservar/` (`suweb.com/reservar`).
6. El dueño entra al panel y completa **Ajustes** (logo, WhatsApp, dirección, datos de transferencia), **Turnos** (días, horarios, precio, seña).

**Actualizar el código de un cliente ya instalado:** pegar el `Codigo.gs` nuevo, correr "Instalar / reparar hojas" y en Implementar > Administrar implementaciones > editar > Versión nueva.

## Panel del dueño
Agenda mensual (libre / reservado / pendiente / bloqueado), detalle de cada reserva (pagos, saldo, WhatsApp, editar, mover de día, cancelar), alta de reservas a mano con pago inicial, lista con filtros y búsqueda, caja mensual (cobros + ingresos y egresos extra, exportable a CSV), turnos y salones, bloqueos, ajustes y cambio de clave. Se instala como app (Android / escritorio con el botón; iPhone con "Agregar a inicio"). Entra con mail y clave (sesión de 14 días; 5 intentos fallidos bloquean 15 minutos).

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

**Panel** — `POST {action:'login', email, clave}` devuelve un token firmado; luego `POST {action:'admin.…', token}`: `ping`, `agenda`, `reservas`, `reserva`, `crearReserva` (alta manual, con pago inicial opcional), `actualizarReserva` (editar, mover de día o turno, cambiar estado), `cancelar`, `pago`, `pagoEliminar`, `bloqueos`, `bloquear`, `desbloquear`, `salones`, `guardarSalon`, `turnos`, `guardarTurno`, `borrarTurno`, `movimientos`, `movimiento`, `movimientoEliminar`, `caja` (mes), `config`, `guardarConfig`, `cambiarClave`.

## Garantías que cubren las pruebas
No hay doble reserva (bloqueo de concurrencia + chequeo de superposición horaria, incluso si el dueño cambia luego los horarios del turno); las pendientes vencidas liberan el turno; el calendario público nunca muestra datos de clientes; el panel rechaza tokens falsificados, vencidos o de usuarios desactivados, y cambiar la clave cierra las sesiones viejas; cambios del panel se ven al instante pese al caché; un error interno devuelve un mensaje amable.

## Probar
```
node reservas/backend/test/test.js          # lógica del backend (53 pruebas)
node reservas/backend/test/e2e/panel.test.js    # panel en un navegador real
node reservas/backend/test/e2e/reservar.test.js # página de reservas en un navegador real
```
El simulador (`test/mock.js`) reemplaza Sheets, Mail, Cache y Lock; los tests de navegador usan el backend verdadero encima. Falta una prueba completa contra Google real antes de entregar el primer cliente (el hash de la clave, los mails y los permisos solo se pueden verificar ahí).

## Decisiones tomadas
- Las hojas son de tuweeb (una por cliente), no del dueño.
- Sin comisión por pagos online por ahora; los mails salen desde la cuenta de la hoja.
- Login con mail y clave propios (sin Google Cloud): un trámite menos por cliente.
- Varios salones soportados desde el modelo.
