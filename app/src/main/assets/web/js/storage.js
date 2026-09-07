/**
 * BusTrack - storage.js
 * Capa de abstracción de almacenamiento de datos.
 * Diseñada para permitir migración transparente a Firebase, PostgreSQL, MySQL u otra base de datos.
 */

const STORAGE_KEYS = {
  USERS: 'bustrack_users',
  COMPANIES: 'bustrack_companies',
  BUSES: 'bustrack_buses',
  ROUTES: 'bustrack_routes',
  STOPS: 'bustrack_stops',
  SCHEDULES: 'bustrack_schedules',
  REQUESTS: 'bustrack_requests',
  INCIDENTS: 'bustrack_incidents',
  CURRENT_USER: 'bustrack_current_user',
  INITIALIZED: 'bustrack_initialized_v2_real'
};

// Datos iniciales limpios para entorno real (sin prototipos ni datos ficticios)
const DEFAULT_SEED_DATA = {
  users: [],
  companies: [],
  routes: [],
  stops: [],
  buses: [],
  schedules: [],
  requests: [],
  incidents: []
};

const StorageService = {
  /**
   * Inicializa la base de datos local con datos semilla si no existen
   * y conecta con Firebase Realtime Database
   */
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      this.resetToDefaults();
    }
    if (window.FirebaseService) {
      window.FirebaseService.init(this);
    }
  },

  /**
   * Recibe datos actualizados desde Firebase Cloud en tiempo real
   */
  syncFromCloud(entityName, cloudData) {
    if (!entityName || !Array.isArray(cloudData)) return;

    let storageKey = null;
    switch (entityName) {
      case 'buses': storageKey = STORAGE_KEYS.BUSES; break;
      case 'requests': storageKey = STORAGE_KEYS.REQUESTS; break;
      case 'users': storageKey = STORAGE_KEYS.USERS; break;
      case 'routes': storageKey = STORAGE_KEYS.ROUTES; break;
      case 'stops': storageKey = STORAGE_KEYS.STOPS; break;
      case 'companies': storageKey = STORAGE_KEYS.COMPANIES; break;
      case 'incidents': storageKey = STORAGE_KEYS.INCIDENTS; break;
      case 'schedules': storageKey = STORAGE_KEYS.SCHEDULES; break;
    }

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(cloudData));
        this.notifyChange(entityName);
      } catch (e) {
        console.error(`Error syncing ${entityName} from cloud:`, e);
      }
    }
  },

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_SEED_DATA.users));
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(DEFAULT_SEED_DATA.companies));
    localStorage.setItem(STORAGE_KEYS.BUSES, JSON.stringify(DEFAULT_SEED_DATA.buses));
    localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(DEFAULT_SEED_DATA.routes));
    localStorage.setItem(STORAGE_KEYS.STOPS, JSON.stringify(DEFAULT_SEED_DATA.stops));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(DEFAULT_SEED_DATA.schedules));
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(DEFAULT_SEED_DATA.requests));
    localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(DEFAULT_SEED_DATA.incidents));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    this.notifyChange('all');
  },

  notifyChange(entity) {
    const event = new CustomEvent('bustrack:updated', { detail: { entity, timestamp: Date.now() } });
    window.dispatchEvent(event);
  },

  // Helper genérico para obtener colección
  _get(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key}:`, e);
      return fallback;
    }
  },

  // Helper genérico para guardar colección
  _set(key, val, entityName) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      this.notifyChange(entityName);

      // Sincronizar automáticamente en la nube con Firebase
      if (entityName && entityName !== 'session' && window.FirebaseService) {
        window.FirebaseService.pushEntity(entityName, val);
      }
    } catch (e) {
      console.error(`Error writing ${key}:`, e);
    }
  },

  // ================= USERS =================
  getUsers() { return this._get(STORAGE_KEYS.USERS, DEFAULT_SEED_DATA.users); },
  getUserById(id) { return this.getUsers().find(u => u.id === id) || null; },
  getUserByEmail(email) { return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null; },
  saveUser(user) {
    const users = this.getUsers();
    if (!user.id) user.id = 'USR_' + Date.now();
    users.push(user);
    this._set(STORAGE_KEYS.USERS, users, 'users');
    return user;
  },
  updateUser(id, updates) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      this._set(STORAGE_KEYS.USERS, users, 'users');
      return users[idx];
    }
    return null;
  },

  // ================= CURRENT SESSION =================
  getCurrentUser() {
    return this._get(STORAGE_KEYS.CURRENT_USER, null);
  },
  setCurrentUser(user) {
    this._set(STORAGE_KEYS.CURRENT_USER, user, 'session');
  },
  clearCurrentUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    this.notifyChange('session');
  },

  // ================= COMPANIES =================
  getCompanies() { return this._get(STORAGE_KEYS.COMPANIES, DEFAULT_SEED_DATA.companies); },
  getCompanyById(id) { return this.getCompanies().find(c => c.id === id) || null; },
  saveCompany(company) {
    const companies = this.getCompanies();
    if (!company.id) company.id = 'EMP_' + Date.now();
    companies.push(company);
    this._set(STORAGE_KEYS.COMPANIES, companies, 'companies');
    return company;
  },
  updateCompany(id, updates) {
    const list = this.getCompanies();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(STORAGE_KEYS.COMPANIES, list, 'companies');
      return list[idx];
    }
    return null;
  },
  deleteCompany(id) {
    let list = this.getCompanies();
    list = list.filter(c => c.id !== id);
    this._set(STORAGE_KEYS.COMPANIES, list, 'companies');
  },

  // ================= ROUTES =================
  getRoutes() { return this._get(STORAGE_KEYS.ROUTES, DEFAULT_SEED_DATA.routes); },
  getRouteById(id) { return this.getRoutes().find(r => r.id === id) || null; },
  getRoutesByCompany(companyId) { return this.getRoutes().filter(r => r.companyId === companyId); },
  saveRoute(route) {
    const routes = this.getRoutes();
    if (!route.id) route.id = 'RUT_' + Date.now();
    routes.push(route);
    this._set(STORAGE_KEYS.ROUTES, routes, 'routes');
    return route;
  },
  updateRoute(id, updates) {
    const list = this.getRoutes();
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(STORAGE_KEYS.ROUTES, list, 'routes');
      return list[idx];
    }
    return null;
  },
  deleteRoute(id) {
    let list = this.getRoutes();
    list = list.filter(r => r.id !== id);
    this._set(STORAGE_KEYS.ROUTES, list, 'routes');
  },

  // ================= STOPS =================
  getStops() { return this._get(STORAGE_KEYS.STOPS, DEFAULT_SEED_DATA.stops); },
  getStopsByRoute(routeId) { return this.getStops().filter(s => s.routeId === routeId).sort((a, b) => a.sequence - b.sequence); },
  getStopById(id) { return this.getStops().find(s => s.id === id) || null; },
  saveStop(stop) {
    const list = this.getStops();
    if (!stop.id) stop.id = 'STP_' + Date.now();
    list.push(stop);
    this._set(STORAGE_KEYS.STOPS, list, 'stops');
    return stop;
  },
  updateStop(id, updates) {
    const list = this.getStops();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(STORAGE_KEYS.STOPS, list, 'stops');
      return list[idx];
    }
    return null;
  },
  deleteStop(id) {
    let list = this.getStops();
    list = list.filter(s => s.id !== id);
    this._set(STORAGE_KEYS.STOPS, list, 'stops');
  },

  // ================= BUSES =================
  getBuses() { return this._get(STORAGE_KEYS.BUSES, DEFAULT_SEED_DATA.buses); },
  getBusById(id) { return this.getBuses().find(b => b.id === id) || null; },
  getBusesByCompany(companyId) { return this.getBuses().filter(b => b.companyId === companyId); },
  getBusesByRoute(routeId) { return this.getBuses().filter(b => b.routeId === routeId); },
  saveBus(bus) {
    const list = this.getBuses();
    if (!bus.id) bus.id = 'BUS_' + Date.now();
    list.push(bus);
    this._set(STORAGE_KEYS.BUSES, list, 'buses');
    return bus;
  },
  updateBus(id, updates) {
    const list = this.getBuses();
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, lastUpdate: new Date().toISOString() };
      this._set(STORAGE_KEYS.BUSES, list, 'buses');
      return list[idx];
    }
    return null;
  },
  deleteBus(id) {
    let list = this.getBuses();
    list = list.filter(b => b.id !== id);
    this._set(STORAGE_KEYS.BUSES, list, 'buses');
  },

  // Cambiar estado a LLENO / NO LLENO
  setBusFullStatus(busId, isFull) {
    const bus = this.getBusById(busId);
    if (!bus) return null;
    const newStatus = isFull ? 'full' : (bus.isBrokenDown ? 'breakdown' : 'circulating');
    return this.updateBus(busId, { isFull, status: newStatus });
  },

  // Cambiar estado a AVERIADO / RESUELTO
  setBusBreakdownStatus(busId, isBrokenDown, reason = '') {
    const bus = this.getBusById(busId);
    if (!bus) return null;
    const updates = {
      isBrokenDown,
      status: isBrokenDown ? 'breakdown' : (bus.isFull ? 'full' : 'circulating'),
      breakdownReason: isBrokenDown ? reason : null,
      breakdownTime: isBrokenDown ? new Date().toISOString() : null
    };
    if (isBrokenDown) {
      this.reportIncident({
        busId,
        busNumber: bus.busNumber,
        companyId: bus.companyId,
        driverId: bus.driverId,
        type: 'breakdown',
        description: reason || 'Avería mecánica reportada por conductor',
        lat: bus.lat,
        lng: bus.lng
      });
    }
    return this.updateBus(busId, updates);
  },

  // Actualizar ubicación de bus
  updateBusLocation(busId, lat, lng, heading = 0) {
    const updated = this.updateBus(busId, { lat, lng, heading });
    if (window.FirebaseService) {
      window.FirebaseService.updateRecord('buses', busId, { lat, lng, heading, lastUpdate: new Date().toISOString() });
    }
    return updated;
  },

  // ================= SCHEDULES =================
  getSchedules() { return this._get(STORAGE_KEYS.SCHEDULES, DEFAULT_SEED_DATA.schedules); },
  getSchedulesByCompany(companyId) { return this.getSchedules().filter(s => s.companyId === companyId); },
  getScheduleByDriver(driverId) { return this.getSchedules().find(s => s.driverId === driverId) || null; },
  saveSchedule(sched) {
    const list = this.getSchedules();
    if (!sched.id) sched.id = 'SCH_' + Date.now();
    list.push(sched);
    this._set(STORAGE_KEYS.SCHEDULES, list, 'schedules');
    return sched;
  },
  updateSchedule(id, updates) {
    const list = this.getSchedules();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(STORAGE_KEYS.SCHEDULES, list, 'schedules');
      return list[idx];
    }
    return null;
  },

  // ================= PASSENGER REQUESTS =================
  getRequests() { return this._get(STORAGE_KEYS.REQUESTS, DEFAULT_SEED_DATA.requests); },
  getActiveRequestsForBus(busId) {
    return this.getRequests().filter(r => r.busId === busId && r.status === 'active');
  },
  getActiveRequestsForPassenger(passengerId) {
    return this.getRequests().filter(r => r.passengerId === passengerId && r.status === 'active');
  },
  createRequest({ passengerId, passengerName, busId, routeId, type, lat, lng, stopId, locationDesc }) {
    const list = this.getRequests();
    // Validar si el pasajero ya tiene solicitud activa para este bus
    const existing = list.find(r => r.passengerId === passengerId && r.busId === busId && r.status === 'active' && r.type === type);
    if (existing) {
      return existing;
    }
    const newReq = {
      id: 'REQ_' + Date.now(),
      passengerId,
      passengerName: passengerName || 'Pasajero',
      busId,
      routeId,
      type, // 'board' (azul) o 'dropoff' (rojo)
      lat,
      lng,
      stopId: stopId || null,
      locationDesc: locationDesc || (type === 'board' ? 'Esperando para subir' : 'Desea bajar'),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    list.push(newReq);
    this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
    if (window.FirebaseService) {
      window.FirebaseService.setRecord('requests', newReq.id, newReq);
    }
    return newReq;
  },
  updateRequestLocation(requestId, lat, lng) {
    const list = this.getRequests();
    const req = list.find(r => r.id === requestId);
    if (req && req.status === 'active') {
      req.lat = lat;
      req.lng = lng;
      req.updatedAt = new Date().toISOString();
      this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
      if (window.FirebaseService) {
        window.FirebaseService.updateRecord('requests', requestId, { lat, lng, updatedAt: req.updatedAt });
      }
    }
  },
  completeRequest(requestId) {
    const list = this.getRequests();
    const req = list.find(r => r.id === requestId);
    if (req) {
      req.status = 'completed';
      req.completedAt = new Date().toISOString();
      this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
      if (window.FirebaseService) {
        window.FirebaseService.updateRecord('requests', requestId, { status: 'completed', completedAt: req.completedAt });
      }
    }
  },
  cancelRequest(requestId) {
    const list = this.getRequests();
    const req = list.find(r => r.id === requestId);
    if (req) {
      req.status = 'cancelled';
      req.cancelledAt = new Date().toISOString();
      this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
      if (window.FirebaseService) {
        window.FirebaseService.updateRecord('requests', requestId, { status: 'cancelled', cancelledAt: req.cancelledAt });
      }
    }
  },

  // ================= INCIDENTS =================
  getIncidents() { return this._get(STORAGE_KEYS.INCIDENTS, DEFAULT_SEED_DATA.incidents); },
  getActiveIncidentsByCompany(companyId) {
    return this.getIncidents().filter(i => i.companyId === companyId && i.status === 'active');
  },
  reportIncident(incident) {
    const list = this.getIncidents();
    const newInc = {
      id: 'INC_' + Date.now(),
      status: 'active',
      reportedAt: new Date().toISOString(),
      resolvedAt: null,
      ...incident
    };
    list.push(newInc);
    this._set(STORAGE_KEYS.INCIDENTS, list, 'incidents');
    return newInc;
  },
  resolveIncident(id) {
    const list = this.getIncidents();
    const inc = list.find(i => i.id === id);
    if (inc) {
      inc.status = 'resolved';
      inc.resolvedAt = new Date().toISOString();
      this._set(STORAGE_KEYS.INCIDENTS, list, 'incidents');
    }
  }
};

// Inicializar almacenamiento
StorageService.init();

// Exportar globalmente
window.StorageService = StorageService;
