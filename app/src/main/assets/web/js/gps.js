/**
 * BusTrack - gps.js
 * Geolocalización del dispositivo, cálculo de distancias reales con fórmula Haversine
 * y sistema de proximidad a 50 metros con prevención de repetición.
 */

const GPSService = {
  watchId: null,
  lastPosition: null,
  listeners: [],
  proximityState: {}, // targetKey: { inside: boolean, lastAlertTime: number }

  /**
   * Fórmula de Haversine para calcular distancia en metros entre dos coordenadas geográficas reales.
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3; // Radio de la tierra en metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distancia en metros
  },

  /**
   * Formatea metros en formato legible (ej. "45 m", "1.2 km")
   */
  formatDistance(meters) {
    if (!isFinite(meters) || meters === null || meters === undefined) return "--";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  },

  /**
   * Verifica soporte y solicita ubicación actual una vez
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Tu navegador o dispositivo no soporta geolocalización GPS."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lastPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading || 0,
            speed: pos.coords.speed || 0,
            timestamp: pos.timestamp
          };
          resolve(this.lastPosition);
        },
        (err) => {
          let msg = "Necesitamos acceso a tu ubicación para utilizar esta función.";
          if (err.code === 1) { // PERMISSION_DENIED
            msg = "Permiso de ubicación denegado. Por favor actívalo en los ajustes del navegador.";
          } else if (err.code === 2) { // POSITION_UNAVAILABLE
            msg = "Señal GPS no disponible. Verifica que tu GPS esté encendido.";
          } else if (err.code === 3) { // TIMEOUT
            msg = "Tiempo de espera agotado al obtener coordenadas GPS.";
          }
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  },

  /**
   * Monitorea cambios de ubicación periódicamente
   */
  startWatching(callback, errorCallback) {
    if (!navigator.geolocation) {
      if (errorCallback) errorCallback(new Error("Geolocalización no soportada."));
      return null;
    }

    if (this.watchId !== null) {
      this.stopWatching();
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.lastPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading || 0,
          speed: pos.coords.speed || 0,
          timestamp: pos.timestamp
        };
        if (callback) callback(this.lastPosition);
      },
      (err) => {
        if (errorCallback) errorCallback(err);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    return this.watchId;
  },

  stopWatching() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  /**
   * Evalúa proximidad a 50m con anti-bucle / histeresis.
   * Dispara el callback 'onEnterZone' únicamente cuando entra al radio de 50 metros.
   * Si ya estaba adentro, NO vuelve a disparar.
   * Para volver a disparar, debe alejarse más allá de 70m (histeresis).
   * @param {string} targetKey Clave única del objetivo (ej: "req_REQ001" o "stop_STP002")
   * @param {number} distanceMeters Distancia calculada en metros
   * @param {function} onEnterZone Callback a ejecutar al entrar al radio de 50m
   */
  checkProximity50m(targetKey, distanceMeters, onEnterZone) {
    const PROXIMITY_LIMIT = 50; // metros
    const HYSTERESIS_EXIT = 70; // distancia para rearmar la alarma

    if (!this.proximityState[targetKey]) {
      this.proximityState[targetKey] = { inside: false, lastAlertTime: 0 };
    }

    const state = this.proximityState[targetKey];

    if (distanceMeters <= PROXIMITY_LIMIT) {
      if (!state.inside) {
        // Acaba de ingresar a la zona de 50 metros
        state.inside = true;
        state.lastAlertTime = Date.now();
        if (typeof onEnterZone === 'function') {
          onEnterZone(distanceMeters);
        }
      }
    } else if (distanceMeters > HYSTERESIS_EXIT) {
      // Se ha alejado lo suficiente para rearmar la alerta
      state.inside = false;
    }
  }
};

window.GPSService = GPSService;
