/**
 * BusTrack - map.js
 * Integración de Leaflet.js con OpenStreetMap y capas preparadas para otros proveedores.
 * Manejo de marcadores de buses (🟢🟡🔴⚪), solicitudes (AZUL/ROJO), paradas y rutas.
 */

// Si se requiere cambiar a un proveedor comercial (ej. Mapbox, Google Maps, Thunderforest):
// Configure aquí su MAP_API_KEY. Con OpenStreetMap estándar no se requiere clave.
const MAP_CONFIG = {
  MAP_API_KEY: '', // Coloque su API KEY aquí si usa Mapbox/Google Maps
  TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | BusTrack',
  DEFAULT_CENTER: [8.4350, -82.4350], // David, Chiriquí
  DEFAULT_ZOOM: 14
};

class BusTrackMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = { ...MAP_CONFIG, ...options };
    this.map = null;
    this.busMarkers = {};      // busId -> L.marker
    this.requestMarkers = {};  // requestId -> L.marker
    this.stopMarkers = [];     // Array de L.marker
    this.routeLayers = [];     // Array de L.polyline
    this.userLocationMarker = null;
    this.userAccuracyCircle = null;
  }

  init() {
    const el = document.getElementById(this.containerId);
    if (!el) {
      console.warn(`Map container #${this.containerId} not found`);
      return false;
    }

    if (typeof L === 'undefined') {
      console.error('Leaflet library is not loaded');
      el.innerHTML = '<div class="alert alert-danger" style="margin:20px;">Error al cargar la librería de mapas (Leaflet). Verifica tu conexión a internet.</div>';
      return false;
    }

    this.map = L.map(this.containerId, {
      center: this.options.DEFAULT_CENTER,
      zoom: this.options.DEFAULT_ZOOM,
      zoomControl: true
    });

    L.tileLayer(this.options.TILE_URL, {
      maxZoom: 19,
      attribution: this.options.ATTRIBUTION
    }).addTo(this.map);

    return true;
  }

  setView(lat, lng, zoom = 15) {
    if (this.map) {
      this.map.setView([lat, lng], zoom);
    }
  }

  /**
   * Actualiza el marcador de la posición GPS del usuario
   */
  updateUserLocation(lat, lng, accuracy = null) {
    if (!this.map) return;

    const userHtml = `
      <div class="user-gps-marker">
        <div class="gps-pulse"></div>
        <div class="gps-dot"></div>
      </div>
    `;
    const userIcon = L.divIcon({
      html: userHtml,
      className: 'user-marker-container',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng([lat, lng]);
    } else {
      this.userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
      this.userLocationMarker.bindPopup('<b>Tu ubicación actual (GPS)</b>');
    }

    if (accuracy && accuracy > 0 && accuracy < 500) {
      if (this.userAccuracyCircle) {
        this.userAccuracyCircle.setLatLng([lat, lng]);
        this.userAccuracyCircle.setRadius(accuracy);
      } else {
        this.userAccuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          color: '#2563EB',
          fillColor: '#3B82F6',
          fillOpacity: 0.12,
          weight: 1
        }).addTo(this.map);
      }
    }
  }

  /**
   * Genera el icono HTML para un bus según su estado:
   * 🟢 Circulando (#10B981)
   * 🟡 Lleno (#F59E0B)
   * 🔴 Averiado (#EF4444)
   * ⚪ Inactivo (#9CA3AF)
   */
  createBusIcon(bus) {
    let color = '#10B981'; // verde
    let statusBadge = '🟢';
    let label = 'Circulando';

    if (bus.isBrokenDown || bus.status === 'breakdown') {
      color = '#EF4444'; // rojo
      statusBadge = '🔴';
      label = 'Averiado';
    } else if (bus.isFull || bus.status === 'full') {
      color = '#F59E0B'; // amarillo
      statusBadge = '🟡';
      label = 'Lleno';
    } else if (bus.status === 'inactive') {
      color = '#6B7280'; // gris
      statusBadge = '⚪';
      label = 'Inactivo';
    }

    const html = `
      <div class="bus-map-pin" style="--pin-color: ${color}">
        <div class="pin-badge">${statusBadge}</div>
        <div class="pin-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
            <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
          </svg>
        </div>
        <div class="pin-label">Bus ${bus.busNumber}</div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'bus-marker-wrapper',
      iconSize: [44, 48],
      iconAnchor: [22, 48],
      popupAnchor: [0, -45]
    });
  }

  /**
   * Actualiza o renderiza los marcadores de buses
   */
  renderBuses(buses, onSelectBusCallback = null) {
    if (!this.map) return;

    const currentBusIds = new Set(buses.map(b => b.id));

    // Eliminar marcadores que ya no están
    Object.keys(this.busMarkers).forEach(busId => {
      if (!currentBusIds.has(busId)) {
        this.busMarkers[busId].remove();
        delete this.busMarkers[busId];
      }
    });

    // Añadir o actualizar cada bus
    buses.forEach(bus => {
      if (!bus.lat || !bus.lng) return;

      const icon = this.createBusIcon(bus);
      const company = StorageService.getCompanyById(bus.companyId);
      const route = StorageService.getRouteById(bus.routeId);

      let statusText = '🟢 En circulación';
      let statusClass = 'badge-success';
      if (bus.isBrokenDown) {
        statusText = '🔴 AVERIADO';
        statusClass = 'badge-danger';
      } else if (bus.isFull) {
        statusText = '🟡 BUS LLENO';
        statusClass = 'badge-warning';
      } else if (bus.status === 'inactive') {
        statusText = '⚪ Fuera de servicio';
        statusClass = 'badge-muted';
      }

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header">
            <h4>Bus #${bus.busNumber}</h4>
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div class="popup-body">
            <p><strong>Empresa:</strong> ${company ? company.name : 'N/A'}</p>
            <p><strong>Ruta:</strong> ${route ? route.name : 'N/A'}</p>
            <p><strong>Placa:</strong> ${bus.plate || 'N/A'}</p>
            <p><strong>Capacidad:</strong> ${bus.currentPassengers || 0} / ${bus.capacity || 0} pasajeros</p>
            <p><strong>Próxima parada:</strong> ${bus.nextStop || 'En trayecto'}</p>
            ${bus.isBrokenDown && bus.breakdownReason ? `<p class="alert-breakdown">⚠️ ${bus.breakdownReason}</p>` : ''}
          </div>
          <div class="popup-footer">
            <button class="btn btn-sm btn-primary w-100" onclick="window.onBusPopupSelected('${bus.id}')">
              Ver detalles y solicitar parada
            </button>
          </div>
        </div>
      `;

      if (this.busMarkers[bus.id]) {
        this.busMarkers[bus.id].setLatLng([bus.lat, bus.lng]);
        this.busMarkers[bus.id].setIcon(icon);
        this.busMarkers[bus.id].setPopupContent(popupContent);
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon: icon }).addTo(this.map);
        marker.bindPopup(popupContent);
        this.busMarkers[bus.id] = marker;
      }
    });
  }

  /**
   * Dibuja solicitudes de pasajeros:
   * AZUL = Pasajero quiere SUBIR
   * ROJO = Pasajero quiere BAJAR
   */
  renderRequests(requests) {
    if (!this.map) return;

    const currentReqIds = new Set(requests.map(r => r.id));

    // Eliminar marcadores obsoletos
    Object.keys(this.requestMarkers).forEach(reqId => {
      if (!currentReqIds.has(reqId)) {
        this.requestMarkers[reqId].remove();
        delete this.requestMarkers[reqId];
      }
    });

    requests.forEach(req => {
      if (!req.lat || !req.lng) return;

      const isBoard = req.type === 'board';
      const color = isBoard ? '#2563EB' : '#DC2626'; // Azul = Subir, Rojo = Bajar
      const label = isBoard ? 'SUBIR' : 'BAJAR';
      const iconSymbol = isBoard ? '🙋' : '🚶';

      const html = `
        <div class="req-map-marker req-${req.type}">
          <div class="req-pulse" style="--req-color: ${color}"></div>
          <div class="req-pin" style="background-color: ${color}">
            <span>${iconSymbol}</span>
          </div>
          <div class="req-tooltip">${label}: ${req.passengerName || 'Pasajero'}</div>
        </div>
      `;

      const reqIcon = L.divIcon({
        html: html,
        className: 'req-marker-container',
        iconSize: [36, 40],
        iconAnchor: [18, 40],
        popupAnchor: [0, -38]
      });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${color};">
            <h4>${isBoard ? '🔵 Pasajero espera SUBIR' : '🔴 Pasajero desea BAJAR'}</h4>
          </div>
          <div class="popup-body">
            <p><strong>Pasajero:</strong> ${req.passengerName || 'Pasajero'}</p>
            <p><strong>Punto:</strong> ${req.locationDesc || 'Ubicación GPS en ruta'}</p>
            <p><strong>Hora:</strong> ${new Date(req.createdAt).toLocaleTimeString()}</p>
          </div>
        </div>
      `;

      if (this.requestMarkers[req.id]) {
        this.requestMarkers[req.id].setLatLng([req.lat, req.lng]);
        this.requestMarkers[req.id].setIcon(reqIcon);
        this.requestMarkers[req.id].setPopupContent(popupContent);
      } else {
        const marker = L.marker([req.lat, req.lng], { icon: reqIcon }).addTo(this.map);
        marker.bindPopup(popupContent);
        this.requestMarkers[req.id] = marker;
      }
    });
  }

  /**
   * Dibuja paradas en el mapa
   */
  renderStops(stops, onStopClick = null) {
    if (!this.map) return;

    this.stopMarkers.forEach(m => m.remove());
    this.stopMarkers = [];

    stops.forEach(stop => {
      const stopIcon = L.divIcon({
        html: `<div class="stop-marker ${stop.isTerminal ? 'stop-terminal' : ''}">🚏</div>`,
        className: 'stop-icon-wrapper',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(this.map);
      marker.bindPopup(`
        <div class="stop-popup">
          <strong>${stop.name}</strong>
          ${stop.isTerminal ? '<span class="badge badge-info">Terminal</span>' : ''}
          <p class="text-muted" style="margin:4px 0 0;font-size:0.8rem;">Parada #${stop.sequence}</p>
        </div>
      `);

      if (onStopClick) {
        marker.on('click', () => onStopClick(stop));
      }

      this.stopMarkers.push(marker);
    });
  }

  /**
   * Dibuja las líneas de ruta
   */
  renderRoutes(routes) {
    if (!this.map) return;

    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];

    routes.forEach(route => {
      if (!route.path || route.path.length < 2) return;

      const polyline = L.polyline(route.path, {
        color: route.color || '#2563EB',
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(this.map);

      polyline.bindPopup(`<b>${route.name}</b> (${route.code})<br>Duración aprox: ${route.estimatedDuration}`);
      this.routeLayers.push(polyline);
    });
  }

  fitBounds(latLngs) {
    if (this.map && latLngs && latLngs.length > 0) {
      this.map.fitBounds(latLngs, { padding: [40, 40] });
    }
  }
}

window.BusTrackMap = BusTrackMap;
