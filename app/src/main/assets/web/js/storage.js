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
  INITIALIZED: 'bustrack_initialized_v1'
};

// Datos semilla de demostración (en caso de que fetch a JSON no esté disponible en protocolo file://)
const DEFAULT_SEED_DATA = {
  users: [
    { id: "USR_ADMIN", name: "Administrador", lastName: "General", email: "admin@bustrack.com", password: "admin", birthDate: "1990-01-01", role: "admin", phone: "+507 6100-0000" },
    { id: "USR_PASAJERO1", name: "Carlos", lastName: "Mendoza", email: "pasajero@bustrack.com", password: "123", birthDate: "1998-05-14", role: "passenger", city: "David", zone: "Barrio Bolívar", phone: "+507 6234-5678" },
    { id: "USR_PASAJERO2", name: "María", lastName: "González", email: "maria@bustrack.com", password: "123", birthDate: "2001-11-20", role: "passenger", city: "David", zone: "San Mateo", phone: "+507 6555-4321" },
    { id: "USR_COND1", name: "Roberto", lastName: "Pérez", email: "conductor@bustrack.com", password: "123", birthDate: "1985-03-22", role: "driver", companyId: "EMP001", busId: "BUS001", routeId: "RUT001", phone: "+507 6890-1234" },
    { id: "USR_COND2", name: "José", lastName: "Castillo", email: "jose@bustrack.com", password: "123", birthDate: "1982-08-10", role: "driver", companyId: "EMP001", busId: "BUS002", routeId: "RUT001", phone: "+507 6711-2233" },
    { id: "USR_COND3", name: "Manuel", lastName: "Sánchez", email: "manuel@bustrack.com", password: "123", birthDate: "1979-12-05", role: "driver", companyId: "EMP002", busId: "BUS003", routeId: "RUT002", phone: "+507 6999-8877" }
  ],
  companies: [
    { id: "EMP001", name: "Transportes Chiriquí Metropolitano", legalId: "RUC-108291-1", phone: "+507 775-1020", email: "contacto@chiriquimetro.com", office: "Terminal de Transporte David, Local 12", color: "#2563EB", active: true },
    { id: "EMP002", name: "Expreso David - Bugaba S.A.", legalId: "RUC-984421-2", phone: "+507 770-4450", email: "info@davidbugaba.com", office: "Parada Central Bugaba", color: "#059669", active: true },
    { id: "EMP003", name: "Trans Boquete Express", legalId: "RUC-443219-3", phone: "+507 720-1122", email: "servicio@transboquete.com", office: "Terminal David / Parque Boquete", color: "#D97706", active: true }
  ],
  routes: [
    {
      id: "RUT001",
      name: "Ruta Centro - Terminal David",
      code: "R-101",
      companyId: "EMP001",
      startPoint: "Parque Miguel de Cervantes",
      endPoint: "Terminal de Transporte David",
      estimatedDuration: "25 min",
      days: "Lunes a Domingo",
      schedule: "05:30 AM - 09:30 PM",
      frequency: "Cada 15 min",
      color: "#2563EB",
      active: true,
      path: [[8.4273, -82.4309], [8.4290, -82.4315], [8.4320, -82.4330], [8.4365, -82.4350], [8.4410, -82.4380], [8.4450, -82.4415], [8.4485, -82.4430]]
    },
    {
      id: "RUT002",
      name: "Ruta David - Bugaba Interprovincial",
      code: "R-202",
      companyId: "EMP002",
      startPoint: "Terminal David",
      endPoint: "Parque Central de La Concepción (Bugaba)",
      estimatedDuration: "40 min",
      days: "Lunes a Sábado",
      schedule: "05:00 AM - 10:00 PM",
      frequency: "Cada 20 min",
      color: "#059669",
      active: true,
      path: [[8.4485, -82.4430], [8.4550, -82.4600], [8.4620, -82.4900], [8.4710, -82.5200], [8.4790, -82.5700], [8.4840, -82.6100]]
    },
    {
      id: "RUT003",
      name: "Ruta David - Boquete Montaña",
      code: "R-303",
      companyId: "EMP003",
      startPoint: "Terminal David",
      endPoint: "Bajo Boquete (Parque Domingo Médica)",
      estimatedDuration: "50 min",
      days: "Lunes a Domingo",
      schedule: "06:00 AM - 08:30 PM",
      frequency: "Cada 30 min",
      color: "#D97706",
      active: true,
      path: [[8.4485, -82.4430], [8.4800, -82.4350], [8.5300, -82.4320], [8.6200, -82.4370], [8.7300, -82.4350], [8.7770, -82.4390]]
    }
  ],
  stops: [
    { id: "STP001", routeId: "RUT001", name: "Parque Miguel de Cervantes", lat: 8.4273, lng: -82.4309, sequence: 1, isTerminal: true },
    { id: "STP002", routeId: "RUT001", name: "Parada Calle 4ta Este / Plaza Ote", lat: 8.4320, lng: -82.4330, sequence: 2, isTerminal: false },
    { id: "STP003", routeId: "RUT001", name: "Parada Hospital Regional", lat: 8.4365, lng: -82.4350, sequence: 3, isTerminal: false },
    { id: "STP004", routeId: "RUT001", name: "Parada Centro Comercial Doleguita", lat: 8.4410, lng: -82.4380, sequence: 4, isTerminal: false },
    { id: "STP005", routeId: "RUT001", name: "Terminal de Transporte David", lat: 8.4485, lng: -82.4430, sequence: 5, isTerminal: true },
    { id: "STP006", routeId: "RUT002", name: "Terminal David (Andén Bugaba)", lat: 8.4485, lng: -82.4430, sequence: 1, isTerminal: true },
    { id: "STP007", routeId: "RUT002", name: "Cruce San Pablo", lat: 8.4620, lng: -82.4900, sequence: 2, isTerminal: false },
    { id: "STP008", routeId: "RUT002", name: "Entrada Alanje - Panamericana", lat: 8.4710, lng: -82.5200, sequence: 3, isTerminal: false },
    { id: "STP009", routeId: "RUT002", name: "Parque Central La Concepción (Bugaba)", lat: 8.4840, lng: -82.6100, sequence: 4, isTerminal: true },
    { id: "STP010", routeId: "RUT003", name: "Terminal David (Andén Boquete)", lat: 8.4485, lng: -82.4430, sequence: 1, isTerminal: true },
    { id: "STP011", routeId: "RUT003", name: "Parada Los Algarrobos", lat: 8.5300, lng: -82.4320, sequence: 2, isTerminal: false },
    { id: "STP012", routeId: "RUT003", name: "Parada Caldera Cruce", lat: 8.6200, lng: -82.4370, sequence: 3, isTerminal: false },
    { id: "STP013", routeId: "RUT003", name: "Parque Central Bajo Boquete", lat: 8.7770, lng: -82.4390, sequence: 4, isTerminal: true }
  ],
  buses: [
    {
      id: "BUS001",
      busNumber: "001",
      plate: "CH-4412",
      companyId: "EMP001",
      routeId: "RUT001",
      driverId: "USR_COND1",
      driverName: "Roberto Pérez",
      busType: "Autobús Urbano Grande",
      capacity: 45,
      currentPassengers: 22,
      status: "circulating", // circulating, full, breakdown, inactive
      isFull: false,
      isBrokenDown: false,
      lat: 8.4325,
      lng: -82.4332,
      heading: 35,
      nextStop: "Parada Hospital Regional",
      lastUpdate: new Date().toISOString()
    },
    {
      id: "BUS002",
      busNumber: "002",
      plate: "CH-5590",
      companyId: "EMP001",
      routeId: "RUT001",
      driverId: "USR_COND2",
      driverName: "José Castillo",
      busType: "Coaster Confort",
      capacity: 30,
      currentPassengers: 30,
      status: "full",
      isFull: true,
      isBrokenDown: false,
      lat: 8.4412,
      lng: -82.4382,
      heading: 210,
      nextStop: "Terminal de Transporte David",
      lastUpdate: new Date().toISOString()
    },
    {
      id: "BUS003",
      busNumber: "003",
      plate: "CH-9921",
      companyId: "EMP002",
      routeId: "RUT002",
      driverId: "USR_COND3",
      driverName: "Manuel Sánchez",
      busType: "Autobús Interprovincial",
      capacity: 50,
      currentPassengers: 15,
      status: "circulating",
      isFull: false,
      isBrokenDown: false,
      lat: 8.4625,
      lng: -82.4910,
      heading: 270,
      nextStop: "Entrada Alanje - Panamericana",
      lastUpdate: new Date().toISOString()
    },
    {
      id: "BUS004",
      busNumber: "004",
      plate: "CH-1133",
      companyId: "EMP002",
      routeId: "RUT002",
      driverId: null,
      driverName: "Sin conductor asignado",
      busType: "Microbús Urbano",
      capacity: 25,
      currentPassengers: 0,
      status: "inactive",
      isFull: false,
      isBrokenDown: false,
      lat: 8.4840,
      lng: -82.6100,
      heading: 0,
      nextStop: "En terminal",
      lastUpdate: new Date().toISOString()
    },
    {
      id: "BUS005",
      busNumber: "005",
      plate: "CH-8801",
      companyId: "EMP003",
      routeId: "RUT003",
      driverId: null,
      driverName: "En taller",
      busType: "Autobús Panorámico",
      capacity: 42,
      currentPassengers: 0,
      status: "breakdown",
      isFull: false,
      isBrokenDown: true,
      breakdownReason: "Falla mecánica en alternador",
      breakdownTime: new Date(Date.now() - 3600000).toISOString(),
      lat: 8.5320,
      lng: -82.4325,
      heading: 180,
      nextStop: "Detenido por avería",
      lastUpdate: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  schedules: [
    { id: "SCH001", routeId: "RUT001", companyId: "EMP001", busId: "BUS001", driverId: "USR_COND1", departureTime: "06:00 AM", shiftStart: "05:30 AM", shiftEnd: "02:00 PM", days: "Lunes, Martes, Miércoles, Jueves, Viernes", roundTripsPerDay: 8 },
    { id: "SCH002", routeId: "RUT001", companyId: "EMP001", busId: "BUS002", driverId: "USR_COND2", departureTime: "06:30 AM", shiftStart: "06:00 AM", shiftEnd: "02:30 PM", days: "Lunes a Sábado", roundTripsPerDay: 8 },
    { id: "SCH003", routeId: "RUT002", companyId: "EMP002", busId: "BUS003", driverId: "USR_COND3", departureTime: "06:00 AM", shiftStart: "05:30 AM", shiftEnd: "03:00 PM", days: "Lunes a Domingo", roundTripsPerDay: 6 },
    { id: "SCH004", routeId: "RUT003", companyId: "EMP003", busId: "BUS005", driverId: null, departureTime: "07:00 AM", shiftStart: "06:30 AM", shiftEnd: "04:00 PM", days: "Lunes a Domingo", roundTripsPerDay: 5 }
  ],
  requests: [
    {
      id: "REQ001",
      passengerId: "USR_PASAJERO1",
      passengerName: "Carlos Mendoza",
      busId: "BUS001",
      routeId: "RUT001",
      type: "board", // board (subir, AZUL), dropoff (bajar, ROJO)
      lat: 8.4350,
      lng: -82.4345,
      locationDesc: "Frente a Farmacia Arrocha / Hospital",
      status: "active",
      createdAt: new Date(Date.now() - 300000).toISOString()
    },
    {
      id: "REQ002",
      passengerId: "USR_PASAJERO2",
      passengerName: "María González",
      busId: "BUS001",
      routeId: "RUT001",
      type: "dropoff",
      lat: 8.4410,
      lng: -82.4380,
      stopId: "STP004",
      locationDesc: "Parada Centro Comercial Doleguita",
      status: "active",
      createdAt: new Date(Date.now() - 120000).toISOString()
    }
  ],
  incidents: [
    {
      id: "INC001",
      busId: "BUS005",
      busNumber: "005",
      companyId: "EMP003",
      driverId: null,
      type: "breakdown",
      description: "Falla mecánica en alternador y sistema eléctrico",
      lat: 8.5320,
      lng: -82.4325,
      reportedAt: new Date(Date.now() - 3600000).toISOString(),
      resolvedAt: null,
      status: "active"
    }
  ]
};

const StorageService = {
  /**
   * Inicializa la base de datos local con datos semilla si no existen
   */
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      this.resetToDefaults();
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
    return this.updateBus(busId, { lat, lng, heading });
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
    }
  },
  completeRequest(requestId) {
    const list = this.getRequests();
    const req = list.find(r => r.id === requestId);
    if (req) {
      req.status = 'completed';
      req.completedAt = new Date().toISOString();
      this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
    }
  },
  cancelRequest(requestId) {
    const list = this.getRequests();
    const req = list.find(r => r.id === requestId);
    if (req) {
      req.status = 'cancelled';
      req.cancelledAt = new Date().toISOString();
      this._set(STORAGE_KEYS.REQUESTS, list, 'requests');
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
