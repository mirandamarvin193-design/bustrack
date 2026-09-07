/**
 * BusTrack - driver.js
 * Lógica integral para la experiencia del conductor:
 *  - Restricción estricta de empresa: solo ve su bus, sus pasajeros y buses de su empresa
 *  - Control de estados: "BUS LLENO" / "BUS AVERIADO" con restauración
 *  - Alertas sonoras automáticas a 50 metros para:
 *      * Pasajero que quiere subir (AZUL)
 *      * Pasajero que quiere bajar (ROJO)
 *      * Parada programada (PARADA)
 *  - Sincronización continua de ubicación GPS en tiempo real
 */

let driverMap = null;
let currentDriver = null;
let driverBus = null;
let driverCompany = null;
let driverRoute = null;
let driverRefreshInterval = null;
let simulationMode = false;
let currentWaypointIndex = 0;

function initDriverDashboard() {
  currentDriver = AuthService.requireAuth(['driver', 'admin']);
  if (!currentDriver) return;

  // Cargar datos de bus y empresa del conductor
  loadDriverContext();

  // Actualizar interfaz con datos del conductor
  updateDriverHeader();

  // Inicializar mapa
  const mapEl = document.getElementById('driver-map');
  if (mapEl) {
    driverMap = new BusTrackMap('driver-map');
    if (driverMap.init()) {
      renderDriverMap();
    }
  }

  // Inicializar GPS real del conductor
  initDriverGPS();

  // Actualizar contadores y tarjetas de estado
  updateDriverDashboardPanels();

  // Escuchar eventos de actualización
  window.addEventListener('bustrack:updated', () => {
    refreshDriverData();
  });

  // Sondeo de sincronización y chequeo de proximidad cada 3 segundos
  driverRefreshInterval = setInterval(() => {
    refreshDriverData();
    checkDriverProximityAlerts();
  }, 3000);

  // Solicitar audio y GPS
  NotificationService.requestPermissionsDialog();
}

function loadDriverContext() {
  const buses = StorageService.getBuses();
  // Buscar bus asignado al conductor
  driverBus = buses.find(b => b.driverId === currentDriver.id) || buses.find(b => b.companyId === currentDriver.companyId) || buses[0];

  if (driverBus) {
    driverCompany = StorageService.getCompanyById(driverBus.companyId);
    driverRoute = StorageService.getRouteById(driverBus.routeId);
  }
}

function updateDriverHeader() {
  const nameEl = document.getElementById('driver-name');
  if (nameEl) nameEl.textContent = `${currentDriver.name} ${currentDriver.lastName || ''}`;

  const busInfoEl = document.getElementById('driver-bus-info');
  if (busInfoEl && driverBus) {
    busInfoEl.textContent = `Bus #${driverBus.busNumber} | ${driverCompany ? driverCompany.name : ''} | Ruta: ${driverRoute ? driverRoute.name : 'N/A'}`;
  }

  updateActionButtonsUI();
}

function updateActionButtonsUI() {
  if (!driverBus) return;

  // Botón LLENO
  const fullBtn = document.getElementById('btn-toggle-full');
  if (fullBtn) {
    if (driverBus.isFull) {
      fullBtn.className = 'btn btn-warning btn-lg active-state';
      fullBtn.innerHTML = '🟡 YA NO ESTÁ LLENO';
    } else {
      fullBtn.className = 'btn btn-outline-warning btn-lg';
      fullBtn.innerHTML = '🟡 BUS LLENO';
    }
  }

  // Botón AVERIADO
  const breakdownBtn = document.getElementById('btn-toggle-breakdown');
  if (breakdownBtn) {
    if (driverBus.isBrokenDown) {
      breakdownBtn.className = 'btn btn-danger btn-lg active-state';
      breakdownBtn.innerHTML = '🔴 AVERÍA SOLUCIONADA';
    } else {
      breakdownBtn.className = 'btn btn-outline-danger btn-lg';
      breakdownBtn.innerHTML = '🔧 BUS AVERIADO';
    }
  }
}

function initDriverGPS() {
  // Obtener posición inicial
  GPSService.getCurrentPosition()
    .then(pos => {
      updateDriverPosition(pos.lat, pos.lng, pos.heading || 0);
    })
    .catch(err => {
      console.warn("GPS de conductor:", err.message);
      // Usar coordenadas de inicio de ruta como posición inicial si no hay GPS disponible
      if (driverBus && driverBus.lat && driverBus.lng) {
        updateDriverPosition(driverBus.lat, driverBus.lng, 0);
      }
    });

  // Monitoreo continuo GPS
  GPSService.startWatching(pos => {
    if (!simulationMode) {
      updateDriverPosition(pos.lat, pos.lng, pos.heading || 0);
    }
  });
}

function updateDriverPosition(lat, lng, heading = 0) {
  if (!driverBus) return;
  driverBus.lat = lat;
  driverBus.lng = lng;
  driverBus.heading = heading;
  StorageService.updateBusLocation(driverBus.id, lat, lng, heading);

  if (driverMap) {
    driverMap.updateUserLocation(lat, lng);
    // Centrar mapa suavemente si es la primera vez
    if (!driverMap._hasInitiallyCentered) {
      driverMap.setView(lat, lng, 15);
      driverMap._hasInitiallyCentered = true;
    }
  }
}

function renderDriverMap() {
  if (!driverMap || !driverBus) return;

  // 1. RESTRICCIÓN DE EMPRESA (Requisito 13):
  // El conductor SOLO ve su propio bus y buses de SU MISMA EMPRESA.
  const allBuses = StorageService.getBuses();
  const companyBuses = allBuses.filter(b => b.companyId === driverBus.companyId);

  // 2. Pasajeros relacionados con SU ruta o bus
  const activeRequests = StorageService.getRequests().filter(r =>
    r.status === 'active' && (r.busId === driverBus.id || r.routeId === driverBus.routeId)
  );

  // 3. Ruta y paradas de este conductor
  const routes = driverRoute ? [driverRoute] : [];
  const stops = driverRoute ? StorageService.getStopsByRoute(driverRoute.id) : [];

  driverMap.renderRoutes(routes);
  driverMap.renderStops(stops);
  driverMap.renderBuses(companyBuses);
  driverMap.renderRequests(activeRequests);

  // Centrar en ubicación del bus
  if (driverBus.lat && driverBus.lng && !driverMap._hasInitiallyCentered) {
    driverMap.setView(driverBus.lat, driverBus.lng, 15);
  }
}

function refreshDriverData() {
  loadDriverContext();
  updateActionButtonsUI();
  updateDriverDashboardPanels();
  renderDriverMap();
}

function updateDriverDashboardPanels() {
  if (!driverBus) return;

  const requests = StorageService.getRequests().filter(r =>
    r.status === 'active' && (r.busId === driverBus.id || r.routeId === driverBus.routeId)
  );

  const boardingReqs = requests.filter(r => r.type === 'board');
  const dropoffReqs = requests.filter(r => r.type === 'dropoff');

  const boardCountEl = document.getElementById('count-board-reqs');
  if (boardCountEl) boardCountEl.textContent = boardingReqs.length;

  const dropCountEl = document.getElementById('count-drop-reqs');
  if (dropCountEl) dropCountEl.textContent = dropoffReqs.length;

  // Lista de solicitudes en el panel
  const listEl = document.getElementById('driver-requests-list');
  if (listEl) {
    if (requests.length === 0) {
      listEl.innerHTML = '<p class="text-muted text-center" style="padding:15px;">No hay solicitudes de pasajeros en este momento.</p>';
    } else {
      listEl.innerHTML = requests.map(req => {
        const isBoard = req.type === 'board';
        let distStr = '--';
        if (driverBus.lat && driverBus.lng && req.lat && req.lng) {
          const m = GPSService.calculateDistance(driverBus.lat, driverBus.lng, req.lat, req.lng);
          distStr = GPSService.formatDistance(m);
        }

        return `
          <div class="driver-req-card ${isBoard ? 'border-board' : 'border-drop'}">
            <div class="d-flex justify-between align-center">
              <div>
                <strong>${isBoard ? '🔵 SUBIR' : '🔴 BAJAR'}</strong>: ${req.passengerName}
                <div class="text-muted" style="font-size:0.8rem;">📍 Distancia: <strong>${distStr}</strong> | ${req.locationDesc || ''}</div>
              </div>
              <button class="btn btn-sm btn-success" onclick="completePassengerRequest('${req.id}')">
                Atendido ✓
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Estado del bus en resumen
  const statusSummaryEl = document.getElementById('driver-status-summary');
  if (statusSummaryEl) {
    if (driverBus.isBrokenDown) {
      statusSummaryEl.innerHTML = '<span class="badge badge-danger">🔴 AVERIADO</span>';
    } else if (driverBus.isFull) {
      statusSummaryEl.innerHTML = '<span class="badge badge-warning">🟡 LLENO</span>';
    } else {
      statusSummaryEl.innerHTML = '<span class="badge badge-success">🟢 EN CIRCULACIÓN</span>';
    }
  }
}

/**
 * Completar solicitud cuando el pasajero subió o bajó
 */
function completePassengerRequest(requestId) {
  StorageService.completeRequest(requestId);
  NotificationService.toast('Solicitud marcada como completada.', 'success');
  refreshDriverData();
}

/**
 * Alternar estado de BUS LLENO
 */
function toggleBusFull() {
  if (!driverBus) return;
  const newStatus = !driverBus.isFull;
  StorageService.setBusFullStatus(driverBus.id, newStatus);
  driverBus.isFull = newStatus;

  if (newStatus) {
    NotificationService.toast('Bus marcado como LLENO. Los pasajeros serán notificados.', 'warning');
  } else {
    NotificationService.toast('El bus ya no está lleno. Listo para admitir pasajeros.', 'success');
  }

  updateActionButtonsUI();
  refreshDriverData();
}

/**
 * Alternar estado de BUS AVERIADO
 */
function toggleBusBreakdown() {
  if (!driverBus) return;

  if (!driverBus.isBrokenDown) {
    const reason = prompt('Describe brevemente la avería (ej. Falla mecánica, neumático ponchado):', 'Avería mecánica en motor');
    if (reason === null) return; // Cancelado por conductor

    StorageService.setBusBreakdownStatus(driverBus.id, true, reason);
    driverBus.isBrokenDown = true;
    NotificationService.toast('🚨 Bus marcado como AVERIADO. Se ha notificado a tu empresa y a los pasajeros.', 'error', 6000);
  } else {
    if (confirm('¿Confirmas que la avería ha sido solucionada y el bus reanuda su servicio?')) {
      StorageService.setBusBreakdownStatus(driverBus.id, false);
      driverBus.isBrokenDown = false;
      NotificationService.toast('Avería solucionada. Bus de regreso en circulación.', 'success');
    }
  }

  updateActionButtonsUI();
  refreshDriverData();
}

/**
 * Chequeo de proximidad a 50m para alertas de sonido al conductor
 */
function checkDriverProximityAlerts() {
  if (!driverBus || !driverBus.lat || !driverBus.lng) return;

  // 1. Verificar proximidad a solicitudes de pasajeros (AZUL / ROJO)
  const requests = StorageService.getActiveRequestsForBus(driverBus.id);

  requests.forEach(req => {
    if (!req.lat || !req.lng) return;
    const dist = GPSService.calculateDistance(driverBus.lat, driverBus.lng, req.lat, req.lng);

    GPSService.checkProximity50m(`driver_req_${req.id}`, dist, (enteredDist) => {
      if (req.type === 'board') {
        NotificationService.playBlueAlert();
        NotificationService.toast(`🔵 ¡Pasajero esperando para SUBIR a ${enteredDist}m! (${req.passengerName})`, 'blue', 6000);
      } else {
        NotificationService.playRedAlert();
        NotificationService.toast(`🔴 ¡Pasajero para BAJAR a ${enteredDist}m! (${req.passengerName})`, 'red', 6000);
      }
    });
  });

  // 2. Verificar proximidad a paradas programadas (PARADA)
  if (driverRoute) {
    const stops = StorageService.getStopsByRoute(driverRoute.id);
    stops.forEach(stop => {
      const dist = GPSService.calculateDistance(driverBus.lat, driverBus.lng, stop.lat, stop.lng);

      GPSService.checkProximity50m(`driver_stop_${stop.id}`, dist, (enteredDist) => {
        NotificationService.playStopAlert();
        NotificationService.toast(`🚏 Próxima parada programada: "${stop.name}" a ${enteredDist}m`, 'stop', 5000);
      });
    });
  }
}

/**
 * Simulador de avance de ruta (útil para pruebas en escritorio/emulador)
 */
function advanceRouteSimulation() {
  simulationMode = true;
  if (!driverRoute || !driverRoute.path || driverRoute.path.length === 0) return;

  currentWaypointIndex = (currentWaypointIndex + 1) % driverRoute.path.length;
  const pt = driverRoute.path[currentWaypointIndex];

  updateDriverPosition(pt[0], pt[1], 45);
  NotificationService.toast(`Avanzando en ruta (Punto ${currentWaypointIndex + 1}/${driverRoute.path.length})`, 'info', 2000);
  refreshDriverData();
}

window.initDriverDashboard = initDriverDashboard;
window.toggleBusFull = toggleBusFull;
window.toggleBusBreakdown = toggleBusBreakdown;
window.completePassengerRequest = completePassengerRequest;
window.advanceRouteSimulation = advanceRouteSimulation;
