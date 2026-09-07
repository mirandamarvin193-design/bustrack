/**
 * BusTrack - auth.js
 * Control de autenticación, validación de formularios, registro por roles (Pasajero, Conductor, Admin)
 * y protección de rutas.
 */

const AuthService = {
  getCurrentUser() {
    return StorageService.getCurrentUser();
  },

  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  login(email, password) {
    if (!email || !password) {
      return { success: false, message: 'Por favor ingresa correo y contraseña.' };
    }

    const user = StorageService.getUserByEmail(email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado con ese correo electrónico.' };
    }

    if (user.password !== password) {
      return { success: false, message: 'Contraseña incorrecta. Por favor verifica tus datos.' };
    }

    // Guardar sesión activa
    StorageService.setCurrentUser(user);
    return { success: true, user };
  },

  logout() {
    StorageService.clearCurrentUser();
    // Redirigir a login o inicio
    const basePath = this.getBasePath();
    window.location.href = `${basePath}login.html`;
  },

  getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/passenger/') || path.includes('/driver/') || path.includes('/admin/')) {
      return '../';
    }
    return '';
  },

  /**
   * Registro con validaciones completas de seguridad
   */
  register(formData) {
    const {
      name,
      lastName,
      email,
      birthDate,
      password,
      confirmPassword,
      role,
      // Campos de pasajero
      city,
      zone,
      // Campos de conductor
      plate,
      busNumber,
      companyName,
      routeName,
      startPoint,
      endPoint,
      shiftStart,
      shiftEnd,
      days,
      capacity,
      busType
    } = formData;

    // 1. Validaciones básicas
    if (!name || !lastName || !email || !birthDate || !password || !role) {
      return { success: false, message: 'Por favor completa todos los campos obligatorios.' };
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'El correo electrónico ingresado no tiene un formato válido.' };
    }

    // Validar contraseña
    if (password.length < 4) {
      return { success: false, message: 'La contraseña debe tener al menos 4 caracteres.' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Las contraseñas no coinciden. Verifícalas e intenta nuevamente.' };
    }

    // Validar no duplicado de correo
    const existing = StorageService.getUserByEmail(email);
    if (existing) {
      return { success: false, message: 'Ya existe una cuenta registrada con este correo electrónico.' };
    }

    const userId = 'USR_' + Date.now();
    const newUser = {
      id: userId,
      name: name.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      birthDate,
      password,
      role,
      createdAt: new Date().toISOString()
    };

    if (role === 'passenger') {
      newUser.city = city || 'David';
      newUser.zone = zone || 'Centro';
    } else if (role === 'driver') {
      if (!plate || !busNumber || !companyName || !routeName) {
        return { success: false, message: 'Como conductor, debes especificar la placa, número de bus, empresa y ruta.' };
      }

      // Buscar o crear empresa si no existe
      let company = StorageService.getCompanies().find(c => c.name.toLowerCase() === companyName.toLowerCase());
      if (!company) {
        company = StorageService.saveCompany({
          name: companyName,
          legalId: 'RUC-' + Math.floor(100000 + Math.random() * 900000),
          phone: '+507 700-0000',
          email: 'info@' + companyName.toLowerCase().replace(/\s+/g, '') + '.com',
          office: 'Terminal',
          color: '#2563EB',
          active: true
        });
      }

      // Buscar o crear ruta si no existe
      let route = StorageService.getRoutes().find(r => r.name.toLowerCase() === routeName.toLowerCase() && r.companyId === company.id);
      if (!route) {
        route = StorageService.saveRoute({
          name: routeName,
          code: 'R-' + Math.floor(100 + Math.random() * 900),
          companyId: company.id,
          startPoint: startPoint || 'Punto Inicial',
          endPoint: endPoint || 'Punto Final',
          estimatedDuration: '30 min',
          days: days || 'Lunes a Domingo',
          schedule: `${shiftStart || '06:00 AM'} - ${shiftEnd || '08:00 PM'}`,
          active: true,
          path: [[8.4350, -82.4350], [8.4450, -82.4450]]
        });
      }

      // Crear bus para este conductor
      const newBus = StorageService.saveBus({
        busNumber: busNumber,
        plate: plate.toUpperCase(),
        companyId: company.id,
        routeId: route.id,
        driverId: userId,
        driverName: `${name} ${lastName}`,
        busType: busType || 'Autobús',
        capacity: parseInt(capacity) || 40,
        currentPassengers: 0,
        status: 'circulating',
        isFull: false,
        isBrokenDown: false,
        lat: 8.4350,
        lng: -82.4350,
        heading: 0,
        nextStop: 'Inicio de ruta',
        lastUpdate: new Date().toISOString()
      });

      // Crear horario
      StorageService.saveSchedule({
        routeId: route.id,
        companyId: company.id,
        busId: newBus.id,
        driverId: userId,
        shiftStart: shiftStart || '06:00 AM',
        shiftEnd: shiftEnd || '08:00 PM',
        days: days || 'Lunes a Sábado',
        roundTripsPerDay: 6
      });

      newUser.companyId = company.id;
      newUser.busId = newBus.id;
      newUser.routeId = route.id;
    }

    StorageService.saveUser(newUser);
    StorageService.setCurrentUser(newUser);
    return { success: true, user: newUser };
  },

  /**
   * Guarda de navegación: asegura que el usuario esté logueado y tenga el rol permitido
   */
  requireAuth(allowedRoles = []) {
    const user = this.getCurrentUser();
    const basePath = this.getBasePath();

    if (!user) {
      window.location.href = `${basePath}login.html`;
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert('Acceso no autorizado para tu perfil de usuario.');
      this.redirectByUserRole(user);
      return null;
    }

    return user;
  },

  redirectByUserRole(user) {
    const basePath = this.getBasePath();
    if (!user) {
      window.location.href = `${basePath}login.html`;
      return;
    }

    if (user.role === 'passenger') {
      window.location.href = `${basePath}passenger/dashboard.html`;
    } else if (user.role === 'driver') {
      window.location.href = `${basePath}driver/dashboard.html`;
    } else if (user.role === 'admin') {
      window.location.href = `${basePath}admin/dashboard.html`;
    } else {
      window.location.href = `${basePath}index.html`;
    }
  }
};

window.AuthService = AuthService;
