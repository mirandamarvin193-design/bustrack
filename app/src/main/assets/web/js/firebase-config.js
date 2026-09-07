/**
 * BusTrack - Configuración y Credenciales de Firebase Cloud Database
 */
const FirebaseConfig = {
  STORAGE_KEY: 'bustrack_firebase_config',

  // Configuración de tu proyecto bustrack-gps en Google Firebase
  getDefaultConfig() {
    return {
      apiKey: "AIzaSyB-BusTrackLiveCloudGpsKey2026",
      authDomain: "bustrack-gps.firebaseapp.com",
      databaseURL: "https://bustrack-gps-default-rtdb.firebaseio.com",
      projectId: "bustrack-gps",
      storageBucket: "bustrack-gps.appspot.com",
      messagingSenderId: "693447643870",
      appId: "1:693447643870:web:bustrackgps2026"
    };
  },

  // Obtener configuración activa (desde localStorage o por defecto)
  getConfig() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.databaseURL || parsed.projectId)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("No se pudo leer la configuración de Firebase:", e);
    }
    return this.getDefaultConfig();
  },

  // Guardar configuración personalizada del usuario
  saveConfig(newConfig) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
      window.dispatchEvent(new CustomEvent('bustrack:firebase-config-updated', { detail: newConfig }));
      return true;
    } catch (e) {
      console.error("Error al guardar configuración de Firebase:", e);
      return false;
    }
  },

  // Limpiar configuración guardada
  resetToDefault() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('bustrack:firebase-config-updated', { detail: this.getDefaultConfig() }));
  },

  // Verificar si está configurado
  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg && (cfg.databaseURL || cfg.projectId));
  }
};

window.FirebaseConfig = FirebaseConfig;
