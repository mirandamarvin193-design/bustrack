/**
 * BusTrack - passenger.js
 * Lógica integral para la experiencia del pasajero:
 *  - Búsqueda en tiempo real por empresa, ruta, bus, placa
 *  - Visualización y filtrado de buses en mapa con estados (🟢🟡🔴⚪)
 *  - Solicitud de subida (marcador AZUL) con GPS en tiempo real
 *  - Solicitud de bajada (marcador ROJO) con selección de parada
 *  - Alerta sonora a 50 metros de proximidad
 *  - Cancelación de solicitudes y actualización automática
 */

let passengerMap = null;
let currentUser = null;
let currentGpsPos = null;
let activeRequest = null;
let busRefreshInterval = null;

function initPassengerDashboard() {
  currentUser = AuthService.requireAuth(['passenger', 'admin']);
  if (!currentUser) return;

  // Actualizar nombre en cabecera
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = `${currentUser.name} ${currentUser.lastName || ''}`;

  // Inicializar mapa si existe el contenedor
  const mapContainer = document.getElementById('passenger-map');
  if (mapContainer) {
    passengerMap = new BusTrackMap('passenger-map');
    if (passengerMap.init()) {
      renderAllMapElements();
    }
  }

  // Inicializar geolocalización GPS
  initGPS();

  // Cargar lista de buses
  renderBusesList();

  // Cargar solicitud activa si existe
  checkActivePassengerRequest();

  // Escuchar actualizaciones en tiempo real
  window.addEventListener('bustrack:updated', () => {
    refreshData();
  });

  // Sondeo cada 3.5 segundos para sincronización en vivo
  busRefreshInterval = setInterval(() => {
    refreshData();
    checkBusProximity();
  }, 3500);

  // Configurar buscador
  const searchInput = document.getElementById('bus-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderBusesList(e.target.value);
    });
  }

  // Configurar filtro de empresa si existe
  const companyFilter = document.getElementById('company-filter');
  if (companyFilter) {
    populateCompanyFilter(companyFilter);
    companyFilter.addEventListener('change', () => {
      renderBusesList(searchInput ? searchInput.value : '');
    });
  }
}

function initGPS() {
  GPSService.getCurrentPosition()
    .then(pos => {
      currentGpsPos = pos;
      if (passengerMap) {
        passengerMap.updateUserLocation(pos.lat, pos.lng, pos.accuracy);
      }
      renderBusesList(); // Reordenar por cercanía
    })
    .catch(err => {
      console.warn("GPS inicial no disponible:", err.message);
    });

  GPSService.startWatching(pos => {
    currentGpsPos = pos;
    if (passengerMap) {
      passengerMap.updateUserLocation(pos.lat, pos.lng, pos.accuracy);
    }
    // Si hay solicitud activa de subida, actualizar coordenadas
    if (activeRequest && activeRequest.type === 'board') {
      StorageService.updateRequestLocation(activeRequest.id, pos.lat, pos.lng);
    }
  }, err => {
    console.warn("Error en seguimiento continuo GPS:", err.message);
  });
}

function renderAllMapElements() {
  if (!passengerMap) return;

  const buses = StorageService.getBuses();
  const routes = StorageService.getRoutes();
  const stops = StorageService.getStops();
  const requests = StorageService.getRequests().filter(r => r.status === 'active');

  passengerMap.renderRoutes(routes);
  passengerMap.renderStops(stops);
  passengerMap.renderBuses(buses);
  passengerMap.renderRequests(requests);
}

function refreshData() {
  if (passengerMap) {
    renderAllMapElements();
  }
  renderBusesList();
  checkActivePassengerRequest();
}

function populateCompanyFilter(selectEl) {
  const companies = StorageService.getCompanies();
  selectEl.innerHTML = '<option value="">Todas las empresas</option>';
  companies.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    selectEl.appendChild(opt);
  });
}

function renderBusesList(filterText = '') {
  const container = document.getElementById('buses-list-container');
  if (!container) return;

  let buses = StorageService.getBuses();
  const companies = StorageService.getCompanies();
  const routes = StorageService.getRoutes();

  const companyFilter = document.getElementById('company-filter');
  const selectedCompanyId = companyFilter ? companyFilter.value : '';

  if (selectedCompanyId) {
    buses = buses.filter(b => b.companyId === selectedCompanyId);
  }

  if (filterText) {
    const query = filterText.toLowerCase().trim();
    buses = buses.filter(b => {
      const comp = companies.find(c => c.id === b.companyId);
      const route = routes.find(r => r.id === b.routeId);
      return (
        b.busNumber.toLowerCase().includes(query) ||
        (b.plate && b.plate.toLowerCase().includes(query)) ||
        (comp && comp.name.toLowerCase().includes(query)) ||
        (route && (route.name.toLowerCase().includes(query) || route.code.toLowerCase().includes(query)))
      );
    });
  }

  // Calcular distancias si tenemos GPS
  buses.forEach(b => {
    if (currentGpsPos && b.lat && b.lng) {
      b.distanceMeters = GPSService.calculateDistance(currentGpsPos.lat, currentGpsPos.lng, b.lat, b.lng);
    } else {
      b.distanceMeters = null;
    }
  });

  // Ordenar por distancia si está disponible
  buses.sort((a, b) => {
    if (a.distanceMeters !== null && b.distanceMeters !== null) {
      return a.distanceMeters - b.distanceMeters;
    }
    return 0;
  });

  if (buses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🚌 No se encontraron buses disponibles con los criterios seleccionados.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = buses.map(bus => {
    const comp = companies.find(c => c.id === bus.companyId);
    const route = routes.find(r => r.id === bus.routeId);

    let statusBadge = '<span class="badge badge-success">🟢 En circulación</span>';
    if (bus.isBrokenDown) {
      statusBadge = '<span class="badge badge-danger">🔴 AVERIADO</span>';
    } else if (bus.isFull) {
      statusBadge = '<span class="badge badge-warning">🟡 LLENO</span>';
    } else if (bus.status === 'inactive') {
      statusBadge = '<span class="badge badge-muted">⚪ Inactivo</span>';
    }

    const distStr = bus.distanceMeters !== null ? GPSService.formatDistance(bus.distanceMeters) : '--';

    return `
      <div class="bus-card ${bus.isBrokenDown ? 'card-broken' : ''} ${bus.isFull ? 'card-full' : ''}">
        <div class="bus-card-header">
          <div>
            <span class="bus-card-number">Bus #${bus.busNumber}</span>
            <span class="bus-card-plate">${bus.plate || ''}</span>
          </div>
          ${statusBadge}
        </div>
        <div class="bus-card-body">
          <p class="bus-card-route"><strong>${route ? route.name : 'Ruta'}</strong></p>
          <p class="bus-card-company">${comp ? comp.name : 'Empresa'}</p>
          <div class="bus-meta-row">
            <span>📍 Distancia: <strong>${distStr}</strong></span>
            <span>👥 Ocupación: <strong>${bus.currentPassengers || 0}/${bus.capacity || 0}</strong></span>
          </div>
          <p class="bus-next-stop">🚏 Próxima parada: ${bus.nextStop || 'En trayecto'}</p>
        </div>
        <div class="bus-card-actions">
          <button class="btn btn-outline-primary btn-sm" onclick="focusBusOnMap('${bus.id}')">
            🗺️ Ver en mapa
          </button>
          <button class="btn btn-primary btn-sm" onclick="openBusDetailModal('${bus.id}')">
            Detalles y Parada
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function focusBusOnMap(busId) {
  const bus = StorageService.getBusById(busId);
  if (!bus || !bus.lat || !bus.lng) return;

  if (passengerMap) {
    passengerMap.setView(bus.lat, bus.lng, 16);
    if (passengerMap.busMarkers[busId]) {
      passengerMap.busMarkers[busId].openPopup();
    }
  }

  const mapTabBtn = document.querySelector('[data-tab="map"]');
  if (mapTabBtn) mapTabBtn.click();
}

window.onBusPopupSelected = function(busId) {
  openBusDetailModal(busId);
};

function openBusDetailModal(busId) {
  const bus = StorageService.getBusById(busId);
  if (!bus) return;

  const comp = StorageService.getCompanyById(bus.companyId);
  const route = StorageService.getRouteById(bus.routeId);
  const stops = route ? StorageService.getStopsByRoute(route.id) : [];

  let modal = document.getElementById('bus-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bus-detail-modal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  let statusBadge = '<span class="badge badge-success">🟢 En circulación</span>';
  if (bus.isBrokenDown) statusBadge = '<span class="badge badge-danger">🔴 AVERIADO</span>';
  else if (bus.isFull) statusBadge = '<span class="badge badge-warning">🟡 BUS LLENO</span>';
  else if (bus.status === 'inactive') statusBadge = '<span class="badge badge-muted">⚪ Fuera de circulación</span>';

  modal.innerHTML = `
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <div>
          <h3>Bus #${bus.busNumber} (${bus.plate || 'Sin placa'})</h3>
          <p class="text-muted">${comp ? comp.name : 'Empresa de Transporte'}</p>
        </div>
        <div>${statusBadge}</div>
      </div>

      <div class="modal-body">
        <div class="detail-grid">
          <div><strong>Ruta:</strong> ${route ? route.name : 'N/A'}</div>
          <div><strong>Código:</strong> ${route ? route.code : 'N/A'}</div>
          <div><strong>Punto Inicial:</strong> ${route ? route.startPoint : 'N/A'}</div>
          <div><strong>Punto Final:</strong> ${route ? route.endPoint : 'N/A'}</div>
          <div><strong>Horario:</strong> ${route ? route.schedule : 'N/A'}</div>
          <div><strong>Días:</strong> ${route ? route.days : 'N/A'}</div>
          <div><strong>Capacidad:</strong> ${bus.capacity} pasajeros</div>
          <div><strong>Ocupación actual:</strong> ${bus.currentPassengers || 0} personas</div>
          <div><strong>Tipo de Bus:</strong> ${bus.busType || 'Estándar'}</div>
          <div><strong>Última actualización:</strong> ${new Date(bus.lastUpdate).toLocaleTimeString()}</div>
        </div>

        ${bus.isBrokenDown ? `
          <div class="alert alert-danger" style="margin-top:15px;">
            <strong>⚠️ Bus averiado:</strong> ${bus.breakdownReason || 'Problema técnico reportado'}. Este bus no está recogiendo pasajeros.
          </div>
        ` : ''}

        ${bus.isFull ? `
          <div class="alert alert-warning" style="margin-top:15px;">
            <strong>🟡 Bus lleno:</strong> El bus está al límite de su capacidad. Nuevas solicitudes de subida podrían no ser atendidas de inmediato.
          </div>
        ` : ''}

        <hr>

        <h4>Acciones para pasajeros</h4>
        <div class="passenger-action-buttons">
          <button class="btn btn-primary btn-lg w-100 mb-2" id="btn-request-board" ${bus.isBrokenDown ? 'disabled' : ''}>
            🙋 Quiero subir a este bus (Marcador AZUL)
          </button>

          <div class="dropoff-section mt-3">
            <label><strong>O bajar en una parada:</strong></label>
            <div class="input-group">
              <select id="dropoff-stop-select" class="form-control">
                <option value="">Selecciona parada de bajada...</option>
                ${stops.map(s => `<option value="${s.id}">${s.name} (${s.isTerminal ? 'Terminal' : 'Parada #' + s.sequence})</option>`).join('')}
              </select>
              <button class="btn btn-danger" id="btn-request-dropoff" ${bus.isBrokenDown ? 'disabled' : ''}>
                🚶 Quiero bajar (Marcador ROJO)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('bus-detail-modal').remove()">Cerrar</button>
      </div>
    </div>
  `;

  // Listener para SUBIR (marcador AZUL)
  document.getElementById('btn-request-board').onclick = () => {
    requestBoarding(bus);
    modal.remove();
  };

  // Listener para BAJAR (marcador ROJO)
  document.getElementById('btn-request-dropoff').onclick = () => {
    const stopId = document.getElementById('dropoff-stop-select').value;
    if (!stopId) {
      alert('Por favor selecciona la parada en la que deseas bajar.');
      return;
    }
    requestDropoff(bus, stopId);
    modal.remove();
  };
}

/**
 * Solicitar SUBIR al bus (marcador AZUL)
 */
function requestBoarding(bus) {
  if (bus.isBrokenDown) {
    NotificationService.toast('No es posible solicitar subida: el bus está averiado.', 'error');
    return;
  }

  NotificationService.toast('Obteniendo tu ubicación GPS...', 'info');

  GPSService.getCurrentPosition()
    .then(pos => {
      currentGpsPos = pos;
      const req = StorageService.createRequest({
        passengerId: currentUser.id,
        passengerName: `${currentUser.name} ${currentUser.lastName || ''}`,
        busId: bus.id,
        routeId: bus.routeId,
        type: 'board',
        lat: pos.lat,
        lng: pos.lng,
        locationDesc: 'Pasajero esperando en ubicación GPS'
      });

      activeRequest = req;
      NotificationService.toast('✅ Solicitud de subida enviada al conductor (Marcador Azul).', 'blue');
      NotificationService.playBlueAlert();

      refreshData();
      checkActivePassengerRequest();
    })
    .catch(err => {
      // Si falla GPS exacto, usar coordenadas por defecto y advertir
      NotificationService.toast(`⚠️ ${err.message}. Usando ubicación aproximada.`, 'warning');
      const fallbackLat = bus.lat - 0.002;
      const fallbackLng = bus.lng - 0.002;

      const req = StorageService.createRequest({
        passengerId: currentUser.id,
        passengerName: `${currentUser.name} ${currentUser.lastName || ''}`,
        busId: bus.id,
        routeId: bus.routeId,
        type: 'board',
        lat: fallbackLat,
        lng: fallbackLng,
        locationDesc: 'Ubicación aproximada del pasajero'
      });

      activeRequest = req;
      refreshData();
      checkActivePassengerRequest();
    });
}

/**
 * Solicitar BAJAR del bus (marcador ROJO)
 */
function requestDropoff(bus, stopId) {
  const stop = StorageService.getStopById(stopId);
  if (!stop) return;

  const req = StorageService.createRequest({
    passengerId: currentUser.id,
    passengerName: `${currentUser.name} ${currentUser.lastName || ''}`,
    busId: bus.id,
    routeId: bus.routeId,
    type: 'dropoff',
    lat: stop.lat,
    lng: stop.lng,
    stopId: stop.id,
    locationDesc: `Desea bajar en: ${stop.name}`
  });

  activeRequest = req;
  NotificationService.toast(`✅ Solicitud de bajada en "${stop.name}" enviada al conductor (Marcador Rojo).`, 'red');
  NotificationService.playRedAlert();

  refreshData();
  checkActivePassengerRequest();
}

/**
 * Verifica si hay una solicitud activa del pasajero y muestra widget de seguimiento
 */
function checkActivePassengerRequest() {
  if (!currentUser) return;
  const requests = StorageService.getActiveRequestsForPassenger(currentUser.id);
  activeRequest = requests.length > 0 ? requests[0] : null;

  const trackerEl = document.getElementById('active-request-tracker');
  if (!trackerEl) return;

  if (!activeRequest) {
    trackerEl.style.display = 'none';
    return;
  }

  const bus = StorageService.getBusById(activeRequest.busId);
  const isBoard = activeRequest.type === 'board';
  const color = isBoard ? '#2563EB' : '#DC2626';

  let distanceStr = '--';
  if (bus && bus.lat && bus.lng && activeRequest.lat && activeRequest.lng) {
    const dist = GPSService.calculateDistance(bus.lat, bus.lng, activeRequest.lat, activeRequest.lng);
    distanceStr = GPSService.formatDistance(dist);
  }

  trackerEl.style.display = 'block';
  trackerEl.innerHTML = `
    <div class="active-tracker-card" style="border-left: 5px solid ${color}">
      <div class="tracker-header">
        <h4>${isBoard ? '🔵 Solicitud activa: SUBIR' : '🔴 Solicitud activa: BAJAR'}</h4>
        <span class="badge ${isBoard ? 'badge-primary' : 'badge-danger'}">En curso</span>
      </div>
      <div class="tracker-body">
        <p><strong>Bus:</strong> #${bus ? bus.busNumber : 'N/A'} (${bus ? (bus.plate || '') : ''})</p>
        <p><strong>Distancia aproximada al bus:</strong> <span class="dist-highlight">${distanceStr}</span></p>
        <p class="text-muted" style="font-size:0.85rem;">${activeRequest.locationDesc || ''}</p>
      </div>
      <div class="tracker-footer">
        <button class="btn btn-outline-danger btn-sm" onclick="cancelActiveRequest('${activeRequest.id}')">
          Cancelar solicitud
        </button>
      </div>
    </div>
  `;
}

function cancelActiveRequest(requestId) {
  if (confirm('¿Deseas cancelar tu solicitud de parada?')) {
    StorageService.cancelRequest(requestId);
    activeRequest = null;
    NotificationService.toast('Solicitud cancelada.', 'info');
    refreshData();
  }
}

/**
 * Comprueba si el bus solicitado está a menos de 50 metros y activa la alerta sonora correspondiente
 */
function checkBusProximity() {
  if (!activeRequest) return;
  const bus = StorageService.getBusById(activeRequest.busId);
  if (!bus || !bus.lat || !bus.lng || !activeRequest.lat || !activeRequest.lng) return;

  const dist = GPSService.calculateDistance(bus.lat, bus.lng, activeRequest.lat, activeRequest.lng);

  GPSService.checkProximity50m(`pass_${activeRequest.id}`, dist, (enteredDist) => {
    if (activeRequest.type === 'board') {
      NotificationService.playBlueAlert();
      NotificationService.toast(`🔔 ¡Tu bus #${bus.busNumber} está a ${enteredDist} metros! Prepárate para subir.`, 'blue', 7000);
    } else {
      NotificationService.playRedAlert();
      NotificationService.toast(`🔔 ¡Tu parada está a ${enteredDist} metros! El bus se aproxima.`, 'red', 7000);
    }
  });
}

window.initPassengerDashboard = initPassengerDashboard;
window.focusBusOnMap = focusBusOnMap;
window.openBusDetailModal = openBusDetailModal;
window.cancelActiveRequest = cancelActiveRequest;
