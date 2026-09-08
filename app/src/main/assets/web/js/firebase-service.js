/**
 * BusTrack - Firebase Realtime Cloud Service
 * Sincroniza buses, ubicación GPS, solicitudes de pasajeros y usuarios en tiempo real.
 */
const FirebaseService = {
  db: null,
  app: null,
  isInitialized: false,
  isConnected: false,
  isSyncingFromCloud: false,
  storageService: null,
  listenersAttached: false,

  status: {
    connected: false,
    mode: 'offline', // 'sdk', 'rest', 'offline'
    lastSync: null,
    message: 'Iniciando conexión a Firebase...'
  },

  /**
   * Inicializa la conexión con Firebase Realtime Database
   */
  init(storageService) {
    this.storageService = storageService || window.StorageService;
    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;

    if (!config || (!config.databaseURL && !config.projectId)) {
      this.updateStatus(false, 'offline', 'Configuración de Firebase no disponible.');
      return;
    }

    try {
      if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        // Inicializar Firebase SDK
        if (!firebase.apps.length) {
          this.app = firebase.initializeApp(config);
        } else {
          this.app = firebase.app();
        }

        if (firebase.database) {
          this.db = firebase.database();
          this.isInitialized = true;
          this.setupRealtimeListeners();
          this.listenConnectionState();
          this.updateStatus(true, 'sdk', 'Conectado a Firebase Realtime Database (Google Cloud)');
          console.log("🔥 Firebase SDK inicializado con éxito:", config.databaseURL || config.projectId);
        } else {
          this.initRestFallback(config);
        }
      } else {
        this.initRestFallback(config);
      }
    } catch (err) {
      console.warn("Error al inicializar Firebase SDK, recurriendo a REST:", err);
      this.initRestFallback(config);
    }

    // Escuchar cuando el usuario cambie credenciales en el modal
    window.addEventListener('bustrack:firebase-config-updated', () => {
      this.reconnect();
    });

    // Crear o vincular el badge de estado en la cabecera si existe el DOM
    setTimeout(() => {
      this.renderStatusBadge();
    }, 500);
  },

  /**
   * Fallback de sincronización mediante REST API de Firebase Realtime Database
   */
  initRestFallback(config) {
    if (!config || !config.databaseURL) {
      this.updateStatus(false, 'offline', 'Sin conexión a Firebase (Modo local activo)');
      return;
    }

    this.isInitialized = true;
    this.updateStatus(true, 'rest', 'Conectado a Firebase (Vía REST API en tiempo real)');
    console.log("🔥 Firebase REST API configurado para:", config.databaseURL);

    // Polling ligero para mantener sincronizado si no hay SDK WebSocket
    this.pollRestData();
    setInterval(() => this.pollRestData(), 3000);
  },

  /**
   * Monitorea el estado de la conexión con Firebase
   */
  listenConnectionState() {
    if (!this.db) return;
    const connectedRef = this.db.ref('.info/connected');
    connectedRef.on('value', snap => {
      this.isConnected = snap.val() === true;
      if (this.isConnected) {
        this.updateStatus(true, 'sdk', 'En línea con Firebase Realtime Database');
      } else {
        this.updateStatus(false, 'offline', 'Conectando con la nube de Firebase...');
      }
    });
  },

  /**
   * Configura listeners en tiempo real para todas las entidades críticas
   */
  setupRealtimeListeners() {
    if (!this.db || this.listenersAttached) return;
    this.listenersAttached = true;

    const entities = ['buses', 'requests', 'users', 'routes', 'stops', 'companies', 'incidents'];

    entities.forEach(entity => {
      const ref = this.db.ref(`bustrack/${entity}`);
      ref.on('value', snapshot => {
        const val = snapshot.val();
        if (val) {
          let list = [];
          if (Array.isArray(val)) {
            list = val.filter(Boolean);
          } else if (typeof val === 'object') {
            list = Object.keys(val).map(key => {
              const item = val[key];
              if (item && typeof item === 'object') {
                if (!item.id) item.id = key;
              }
              return item;
            }).filter(Boolean);
          }

          if (this.storageService && typeof this.storageService.syncFromCloud === 'function') {
            this.isSyncingFromCloud = true;
            this.storageService.syncFromCloud(entity, list);
            this.isSyncingFromCloud = false;
            this.status.lastSync = new Date();
          }
        }
      }, err => {
        console.warn(`Error al escuchar ${entity} en Firebase:`, err);
      });
    });
  },

  /**
   * Envía la colección completa o actualizada a Firebase
   */
  pushEntity(entityName, data) {
    if (this.isSyncingFromCloud) return; // Evitar bucles de eco

    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;
    if (!config || !config.databaseURL) return;

    // Convertir arreglo a diccionario por ID para mejor concurrencia
    let payload = data;
    if (Array.isArray(data)) {
      payload = {};
      data.forEach(item => {
        if (item && item.id) {
          payload[item.id] = item;
        }
      });
    }

    if (this.db) {
      this.db.ref(`bustrack/${entityName}`).set(payload)
        .then(() => {
          this.status.lastSync = new Date();
        })
        .catch(err => {
          console.warn(`Error al guardar ${entityName} en Firebase SDK:`, err);
          this.sendRest(entityName, payload);
        });
    } else {
      this.sendRest(entityName, payload);
    }
  },

  /**
   * Actualiza un único registro (por ejemplo: la posición GPS en vivo del bus)
   */
  updateRecord(entityName, recordId, updates) {
    if (this.isSyncingFromCloud || !recordId) return;

    if (this.db) {
      this.db.ref(`bustrack/${entityName}/${recordId}`).update(updates)
        .then(() => {
          this.status.lastSync = new Date();
        })
        .catch(err => {
          console.warn(`Error al actualizar ${entityName}/${recordId} en Firebase SDK:`, err);
          this.patchRest(`${entityName}/${recordId}`, updates);
        });
    } else {
      this.patchRest(`${entityName}/${recordId}`, updates);
    }
  },

  /**
   * Guardar o crear un registro puntual
   */
  setRecord(entityName, recordId, fullRecord) {
    if (this.isSyncingFromCloud || !recordId) return;

    if (this.db) {
      this.db.ref(`bustrack/${entityName}/${recordId}`).set(fullRecord)
        .then(() => {
          this.status.lastSync = new Date();
        })
        .catch(err => {
          console.warn(`Error al insertar ${entityName}/${recordId} en Firebase:`, err);
          this.sendRest(`${entityName}/${recordId}`, fullRecord);
        });
    } else {
      this.sendRest(`${entityName}/${recordId}`, fullRecord);
    }
  },

  /**
   * Métodos auxiliares REST (HTTP PUT / PATCH)
   */
  sendRest(path, data) {
    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;
    if (!config || !config.databaseURL) return;

    const base = config.databaseURL.replace(/\/$/, '');
    const url = `${base}/bustrack/${path}.json`;

    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(r => {
      if (r.ok) this.status.lastSync = new Date();
    })
    .catch(err => {
      console.warn("Fallo de envío REST a Firebase:", err);
    });
  },

  patchRest(path, updates) {
    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;
    if (!config || !config.databaseURL) return;

    const base = config.databaseURL.replace(/\/$/, '');
    const url = `${base}/bustrack/${path}.json`;

    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    .then(r => {
      if (r.ok) this.status.lastSync = new Date();
    })
    .catch(err => {
      console.warn("Fallo de PATCH REST a Firebase:", err);
    });
  },

  /**
   * Lectura periódica por REST (si no hay SDK WebSocket)
   */
  pollRestData() {
    if (this.db && this.isConnected) return; // Si el SDK WebSocket está activo, no necesita polling REST

    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;
    if (!config || !config.databaseURL) return;

    const base = config.databaseURL.replace(/\/$/, '');
    const url = `${base}/bustrack.json`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data === null) {
          // La base de datos en Firebase está recién creada (null).
          // Inicializamos la estructura en la nube enviando los datos locales o un nodo de bienvenida
          if (this.storageService) {
            console.log("🔥 Base de datos en la nube vacía. Inicializando nodo bustrack en Firebase...");
            const users = this.storageService.getUsers ? this.storageService.getUsers() : [];
            const buses = this.storageService.getBuses ? this.storageService.getBuses() : [];
            const routes = this.storageService.getRoutes ? this.storageService.getRoutes() : [];
            
            const initialCloudPayload = {
              status: "active",
              appName: "BusTrack",
              initializedAt: new Date().toISOString(),
              users: {},
              buses: {},
              routes: {}
            };
            
            users.forEach(u => { if (u && u.id) initialCloudPayload.users[u.id] = u; });
            buses.forEach(b => { if (b && b.id) initialCloudPayload.buses[b.id] = b; });
            routes.forEach(rt => { if (rt && rt.id) initialCloudPayload.routes[rt.id] = rt; });
            
            fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(initialCloudPayload)
            }).then(() => {
              this.updateStatus(true, 'rest', 'Conectado a Firebase (Base de datos inicializada)');
            }).catch(e => console.warn("Error al inicializar Firebase:", e));
          }
        } else if (data && this.storageService && typeof this.storageService.syncFromCloud === 'function') {
          this.isSyncingFromCloud = true;
          Object.keys(data).forEach(entity => {
            const raw = data[entity];
            if (raw) {
              const list = Array.isArray(raw) ? raw.filter(Boolean) : Object.keys(raw).map(k => raw[k]);
              this.storageService.syncFromCloud(entity, list);
            }
          });
          this.isSyncingFromCloud = false;
          this.status.lastSync = new Date();
          this.updateStatus(true, 'rest', 'Sincronizado con Firebase Realtime Database');
        }
      })
      .catch(e => {
        // Silencioso para no saturar consola en caso de timeout
      });
  },

  /**
   * Actualiza el estado global de conexión y notifica
   */
  updateStatus(connected, mode, message) {
    this.status.connected = connected;
    this.status.mode = mode;
    this.status.message = message;

    window.dispatchEvent(new CustomEvent('bustrack:firebase-status', { detail: this.status }));
    this.updateStatusBadgeDOM();
  },

  /**
   * Reiniciar conexión tras cambio de configuración
   */
  reconnect() {
    this.listenersAttached = false;
    this.db = null;
    this.init(this.storageService);
  },

  /**
   * Inserta el botón / badge de estado de Firebase en la interfaz
   */
  renderStatusBadge() {
    // Buscar el header de la aplicación
    const header = document.querySelector('.app-header') || document.querySelector('header');
    if (!header || document.getElementById('firebase-cloud-badge')) return;

    const badgeContainer = document.createElement('div');
    badgeContainer.id = 'firebase-cloud-badge';
    badgeContainer.style.cursor = 'pointer';
    badgeContainer.style.display = 'inline-flex';
    badgeContainer.style.alignItems = 'center';
    badgeContainer.style.gap = '6px';
    badgeContainer.style.fontSize = '0.78rem';
    badgeContainer.style.fontWeight = '600';
    badgeContainer.style.padding = '4px 10px';
    badgeContainer.style.borderRadius = '20px';
    badgeContainer.style.transition = 'all 0.2s';
    badgeContainer.style.border = '1px solid #E2E8F0';
    badgeContainer.style.background = '#FFFFFF';
    badgeContainer.onclick = () => this.openSettingsModal();

    // Insertar en el header
    const actionsWrapper = header.querySelector('.d-flex.align-center') || header;
    if (actionsWrapper !== header) {
      actionsWrapper.insertBefore(badgeContainer, actionsWrapper.firstChild);
    } else {
      header.appendChild(badgeContainer);
    }

    this.updateStatusBadgeDOM();
  },

  /**
   * Actualiza los colores y texto del badge de Firebase
   */
  updateStatusBadgeDOM() {
    const el = document.getElementById('firebase-cloud-badge');
    if (!el) return;

    if (this.status.connected) {
      el.style.background = '#ECFDF5';
      el.style.borderColor = '#A7F3D0';
      el.style.color = '#065F46';
      el.innerHTML = `<span>🔥</span><span>Firebase: En Vivo</span>`;
      el.title = `${this.status.message} (Conectado a bustrack-gps)`;
    } else {
      el.style.background = '#EFF6FF';
      el.style.borderColor = '#BFDBFE';
      el.style.color = '#1D4ED8';
      el.innerHTML = `<span>🔥</span><span>Firebase: bustrack-gps</span>`;
      el.title = "Proyecto bustrack-gps configurado en la app";
    }
  },

  /**
   * Abre el modal de configuración de Firebase
   */
  openSettingsModal() {
    const existing = document.getElementById('firebase-modal-overlay');
    if (existing) existing.remove();

    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : {};

    const overlay = document.createElement('div');
    overlay.id = 'firebase-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(15, 23, 42, 0.7)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.boxSizing = 'border-box';

    overlay.innerHTML = `
      <div style="background: white; border-radius: 16px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">🔥</span>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Base de Datos Firebase (Nube)</h3>
          </div>
          <button id="fb-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748B;">&times;</button>
        </div>

        <div style="background: ${this.status.connected ? '#ECFDF5' : '#FEF3C7'}; border: 1px solid ${this.status.connected ? '#A7F3D0' : '#FDE68A'}; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 0.88rem; color: ${this.status.connected ? '#065F46' : '#92400E'};">
          <strong>Estado actual:</strong> ${this.status.message}
          ${this.status.lastSync ? `<div style="font-size: 0.75rem; margin-top: 4px; opacity: 0.85;">Última sincronización: ${new Date(this.status.lastSync).toLocaleTimeString()}</div>` : ''}
        </div>

        <p style="font-size: 0.88rem; color: #475569; margin-bottom: 16px; line-height: 1.4;">
          Conecta tu propia <strong>Firebase Realtime Database</strong> para que los buses, pasajeros y solicitudes se sincronicen en vivo entre cualquier celular en el mundo por internet.
        </p>

        <form id="fb-config-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 4px;">Database URL (URL de la base de datos)*</label>
            <input type="text" id="fb-database-url" value="${config.databaseURL || ''}" placeholder="https://tu-proyecto-default-rtdb.firebaseio.com" style="width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 0.88rem; box-sizing: border-box;" required>
            <small style="color: #64748B; font-size: 0.75rem;">Obtén esta URL en la pestaña Realtime Database de Firebase Console</small>
          </div>

          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 4px;">Project ID (ID de Proyecto)</label>
            <input type="text" id="fb-project-id" value="${config.projectId || ''}" placeholder="mi-proyecto-12345" style="width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 0.88rem; box-sizing: border-box;">
          </div>

          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 4px;">API Key (Clave Web)</label>
            <input type="text" id="fb-api-key" value="${config.apiKey || ''}" placeholder="AIzaSy..." style="width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 0.88rem; box-sizing: border-box;">
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; font-size: 0.8rem; color: #475569; margin-top: 4px;">
            <strong>¿Cómo crear tu base de datos Firebase gratis en 1 minuto?</strong>
            <ol style="margin: 6px 0 0 18px; padding: 0;">
              <li>Entra a <a href="https://console.firebase.google.com" target="_blank" style="color: #2563EB;">console.firebase.google.com</a> y crea un proyecto.</li>
              <li>Ve al menú izquierdo: <strong>Realtime Database</strong> &rarr; Crear base de datos.</li>
              <li>En la pestaña <strong>Reglas</strong>, pon <code>".read": true, ".write": true</code> para permitir sincronización inmediata.</li>
              <li>Copia la URL que aparece arriba y pégala aquí.</li>
            </ol>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button type="submit" style="flex: 1; background: #2563EB; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
              💾 Guardar y Conectar
            </button>
            <button type="button" id="fb-reset-btn" style="background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
              Restablecer
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('fb-close-btn').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    document.getElementById('fb-config-form').onsubmit = (e) => {
      e.preventDefault();
      const databaseURL = document.getElementById('fb-database-url').value.trim();
      const projectId = document.getElementById('fb-project-id').value.trim();
      const apiKey = document.getElementById('fb-api-key').value.trim();

      const newCfg = {
        databaseURL,
        projectId,
        apiKey,
        authDomain: projectId ? `${projectId}.firebaseapp.com` : '',
        storageBucket: projectId ? `${projectId}.appspot.com` : ''
      };

      window.FirebaseConfig.saveConfig(newCfg);
      alert('✅ ¡Configuración de Firebase guardada con éxito! Conectando a la nube...');
      overlay.remove();
      this.reconnect();
    };

    document.getElementById('fb-reset-btn').onclick = () => {
      if (confirm('¿Restablecer a la configuración predeterminada?')) {
        window.FirebaseConfig.resetToDefault();
        overlay.remove();
        this.reconnect();
      }
    };
  }
};

window.FirebaseService = FirebaseService;
