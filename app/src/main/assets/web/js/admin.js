/**
 * BusTrack - admin.js
 * Panel de administración para gestionar Empresas, Rutas, Paradas, Buses,
 * Asignaciones de Conductores, Horarios, Incidencias y Usuarios.
 */

let adminCurrentTab = 'buses';

function initAdminDashboard() {
  const user = AuthService.requireAuth(['admin']);
  if (!user) return;

  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.textContent = `${user.name} (${user.role})`;

  setupAdminTabs();
  renderAdminOverview();
  renderAdminTabContent(adminCurrentTab);

  window.addEventListener('bustrack:updated', () => {
    renderAdminOverview();
    renderAdminTabContent(adminCurrentTab);
  });
}

function setupAdminTabs() {
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminCurrentTab = btn.dataset.tab;
      renderAdminTabContent(adminCurrentTab);
    });
  });
}

function renderAdminOverview() {
  const buses = StorageService.getBuses();
  const companies = StorageService.getCompanies();
  const routes = StorageService.getRoutes();
  const incidents = StorageService.getIncidents().filter(i => i.status === 'active');
  const users = StorageService.getUsers();

  const elBuses = document.getElementById('stat-total-buses');
  if (elBuses) elBuses.textContent = buses.length;

  const elCompanies = document.getElementById('stat-total-companies');
  if (elCompanies) elCompanies.textContent = companies.length;

  const elRoutes = document.getElementById('stat-total-routes');
  if (elRoutes) elRoutes.textContent = routes.length;

  const elIncidents = document.getElementById('stat-active-incidents');
  if (elIncidents) elIncidents.textContent = incidents.length;

  const elUsers = document.getElementById('stat-total-users');
  if (elUsers) elUsers.textContent = users.length;
}

function renderAdminTabContent(tab) {
  const container = document.getElementById('admin-content-area');
  if (!container) return;

  switch (tab) {
    case 'buses':
      renderBusesManagement(container);
      break;
    case 'companies':
      renderCompaniesManagement(container);
      break;
    case 'routes':
      renderRoutesManagement(container);
      break;
    case 'stops':
      renderStopsManagement(container);
      break;
    case 'incidents':
      renderIncidentsManagement(container);
      break;
    case 'users':
      renderUsersManagement(container);
      break;
  }
}

function renderBusesManagement(container) {
  const buses = StorageService.getBuses();
  const companies = StorageService.getCompanies();
  const routes = StorageService.getRoutes();
  const drivers = StorageService.getUsers().filter(u => u.role === 'driver');

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <div class="d-flex justify-between align-center mb-3">
        <h3>Gestión de Autobuses</h3>
        <button class="btn btn-primary" onclick="openCreateBusModal()">+ Registrar Nuevo Bus</button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bus #</th>
              <th>Placa</th>
              <th>Empresa</th>
              <th>Ruta</th>
              <th>Conductor</th>
              <th>Capacidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${buses.map(b => {
              const comp = companies.find(c => c.id === b.companyId);
              const route = routes.find(r => r.id === b.routeId);
              let statusBadge = '<span class="badge badge-success">Circulando</span>';
              if (b.isBrokenDown) statusBadge = '<span class="badge badge-danger">Averiado</span>';
              else if (b.isFull) statusBadge = '<span class="badge badge-warning">Lleno</span>';
              else if (b.status === 'inactive') statusBadge = '<span class="badge badge-muted">Inactivo</span>';

              return `
                <tr>
                  <td><strong>#${b.busNumber}</strong></td>
                  <td>${b.plate || 'N/A'}</td>
                  <td>${comp ? comp.name : 'N/A'}</td>
                  <td>${route ? route.name : 'N/A'}</td>
                  <td>${b.driverName || 'Sin asignar'}</td>
                  <td>${b.capacity}</td>
                  <td>${statusBadge}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editBus('${b.id}')">Editar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteBusAdmin('${b.id}')">Eliminar</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openCreateBusModal() {
  const companies = StorageService.getCompanies();
  const routes = StorageService.getRoutes();
  const drivers = StorageService.getUsers().filter(u => u.role === 'driver');

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'crud-modal';
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Registrar Nuevo Bus</h3>
      <div class="form-group">
        <label>Número de Bus:</label>
        <input type="text" id="bus-num-input" class="form-control" placeholder="Ej: 006">
      </div>
      <div class="form-group">
        <label>Número de Placa:</label>
        <input type="text" id="bus-plate-input" class="form-control" placeholder="Ej: CH-7722">
      </div>
      <div class="form-group">
        <label>Empresa:</label>
        <select id="bus-company-select" class="form-control">
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ruta Asignada:</label>
        <select id="bus-route-select" class="form-control">
          ${routes.map(r => `<option value="${r.id}">${r.name} (${r.code})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Conductor:</label>
        <select id="bus-driver-select" class="form-control">
          <option value="">-- Sin conductor asignado --</option>
          ${drivers.map(d => `<option value="${d.id}">${d.name} ${d.lastName || ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Capacidad de Pasajeros:</label>
        <input type="number" id="bus-cap-input" class="form-control" value="40">
      </div>
      <div class="modal-actions mt-3">
        <button class="btn btn-secondary" onclick="document.getElementById('crud-modal').remove()">Cancelar</button>
        <button class="btn btn-primary" id="btn-save-new-bus">Guardar Bus</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-save-new-bus').onclick = () => {
    const busNum = document.getElementById('bus-num-input').value.trim();
    const plate = document.getElementById('bus-plate-input').value.trim();
    const compId = document.getElementById('bus-company-select').value;
    const routeId = document.getElementById('bus-route-select').value;
    const driverId = document.getElementById('bus-driver-select').value || null;
    const capacity = parseInt(document.getElementById('bus-cap-input').value) || 40;

    if (!busNum) {
      alert('Ingresa el número de bus.');
      return;
    }

    const driverUser = driverId ? StorageService.getUserById(driverId) : null;

    StorageService.saveBus({
      busNumber: busNum,
      plate: plate.toUpperCase(),
      companyId: compId,
      routeId: routeId,
      driverId: driverId,
      driverName: driverUser ? `${driverUser.name} ${driverUser.lastName || ''}` : 'Sin asignar',
      capacity: capacity,
      currentPassengers: 0,
      status: 'circulating',
      isFull: false,
      isBrokenDown: false,
      lat: 8.4350,
      lng: -82.4350,
      heading: 0,
      nextStop: 'Terminal',
      lastUpdate: new Date().toISOString()
    });

    modal.remove();
    NotificationService.toast('Bus registrado con éxito.', 'success');
  };
}

function deleteBusAdmin(busId) {
  if (confirm('¿Eliminar este bus permanentemente?')) {
    StorageService.deleteBus(busId);
    NotificationService.toast('Bus eliminado.', 'info');
  }
}

function renderCompaniesManagement(container) {
  const companies = StorageService.getCompanies();

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <div class="d-flex justify-between align-center mb-3">
        <h3>Empresas de Transporte</h3>
        <button class="btn btn-primary" onclick="openCreateCompanyModal()">+ Nueva Empresa</button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre de Empresa</th>
              <th>RUC / Registro</th>
              <th>Teléfono</th>
              <th>Oficina Principal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${companies.map(c => `
              <tr>
                <td><code>${c.id}</code></td>
                <td><strong>${c.name}</strong></td>
                <td>${c.legalId || 'N/A'}</td>
                <td>${c.phone || 'N/A'}</td>
                <td>${c.office || 'N/A'}</td>
                <td><span class="badge badge-success">Activa</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openCreateCompanyModal() {
  const name = prompt('Nombre de la nueva empresa:');
  if (!name) return;
  const phone = prompt('Teléfono de contacto:', '+507 775-0000');
  const office = prompt('Oficina principal:', 'Terminal David');

  StorageService.saveCompany({
    name,
    phone,
    office,
    legalId: 'RUC-' + Math.floor(100000 + Math.random() * 900000),
    email: 'contacto@' + name.toLowerCase().replace(/\s+/g, '') + '.com',
    color: '#2563EB',
    active: true
  });

  NotificationService.toast('Empresa agregada exitosamente.', 'success');
}

function renderRoutesManagement(container) {
  const routes = StorageService.getRoutes();
  const companies = StorageService.getCompanies();

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <div class="d-flex justify-between align-center mb-3">
        <h3>Rutas del Sistema</h3>
        <button class="btn btn-primary" onclick="openCreateRouteModal()">+ Crear Nueva Ruta</button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Puntos (Inicio - Fin)</th>
              <th>Horario</th>
              <th>Duración Estimada</th>
            </tr>
          </thead>
          <tbody>
            ${routes.map(r => {
              const comp = companies.find(c => c.id === r.companyId);
              return `
                <tr>
                  <td><span class="badge badge-primary">${r.code}</span></td>
                  <td><strong>${r.name}</strong></td>
                  <td>${comp ? comp.name : 'N/A'}</td>
                  <td>${r.startPoint} ➔ ${r.endPoint}</td>
                  <td>${r.schedule || 'N/A'}</td>
                  <td>${r.estimatedDuration || 'N/A'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openCreateRouteModal() {
  const companies = StorageService.getCompanies();
  const name = prompt('Nombre de la ruta (ej: Ruta David - Boquete Express):');
  if (!name) return;
  const startPoint = prompt('Punto de inicio:', 'Terminal David');
  const endPoint = prompt('Punto de destino:', 'Parque Central');
  const code = prompt('Código de ruta:', 'R-' + Math.floor(100 + Math.random() * 900));

  StorageService.saveRoute({
    name,
    code,
    companyId: companies[0] ? companies[0].id : 'EMP001',
    startPoint,
    endPoint,
    estimatedDuration: '35 min',
    days: 'Lunes a Domingo',
    schedule: '05:30 AM - 09:00 PM',
    active: true,
    path: [[8.4350, -82.4350], [8.4450, -82.4450]]
  });

  NotificationService.toast('Ruta creada con éxito.', 'success');
}

function renderStopsManagement(container) {
  const stops = StorageService.getStops();
  const routes = StorageService.getRoutes();

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <div class="d-flex justify-between align-center mb-3">
        <h3>Paradas Programadas</h3>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Secuencia</th>
              <th>Nombre de la Parada</th>
              <th>Ruta</th>
              <th>Tipo</th>
              <th>Coordenadas (Lat, Lng)</th>
            </tr>
          </thead>
          <tbody>
            ${stops.map(s => {
              const r = routes.find(rt => rt.id === s.routeId);
              return `
                <tr>
                  <td>#${s.sequence}</td>
                  <td><strong>🚏 ${s.name}</strong></td>
                  <td>${r ? r.name : 'N/A'}</td>
                  <td>${s.isTerminal ? '<span class="badge badge-info">Terminal</span>' : 'Parada Regular'}</td>
                  <td><code>${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</code></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderIncidentsManagement(container) {
  const incidents = StorageService.getIncidents();
  const buses = StorageService.getBuses();

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <h3>Historial de Averías e Incidencias</h3>
      <div class="table-responsive mt-3">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Bus</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Hora Reporte</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${incidents.map(inc => `
              <tr>
                <td><code>${inc.id}</code></td>
                <td>Bus #${inc.busNumber || 'N/A'}</td>
                <td><span class="badge badge-danger">Avería Mecánica</span></td>
                <td>${inc.description || 'Sin detalle'}</td>
                <td>${new Date(inc.reportedAt).toLocaleString()}</td>
                <td>${inc.status === 'active' ? '<span class="badge badge-danger">Activa</span>' : '<span class="badge badge-success">Resuelta</span>'}</td>
                <td>
                  ${inc.status === 'active' ? `
                    <button class="btn btn-sm btn-success" onclick="resolveIncidentAdmin('${inc.id}')">Marcar Resuelta</button>
                  ` : 'Completado'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function resolveIncidentAdmin(id) {
  StorageService.resolveIncident(id);
  NotificationService.toast('Incidencia marcada como resuelta.', 'success');
}

function renderUsersManagement(container) {
  const users = StorageService.getUsers();

  container.innerHTML = `
    <div class="card p-3 mb-3">
      <h3>Usuarios Registrados</h3>
      <div class="table-responsive mt-3">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre y Apellido</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Ciudad / Empresa</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><code>${u.id}</code></td>
                <td><strong>${u.name} ${u.lastName || ''}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${u.role === 'driver' ? 'badge-primary' : (u.role === 'admin' ? 'badge-danger' : 'badge-info')}">${u.role.toUpperCase()}</span></td>
                <td>${u.city || u.companyId || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function resetAllSystemData() {
  if (confirm('¿Restaurar todos los datos a la demostración inicial? Esto reemplazará los datos actuales con los datos de prueba.')) {
    StorageService.resetToDefaults();
    NotificationService.toast('Datos de demostración restaurados correctamente.', 'success');
    window.location.reload();
  }
}

window.initAdminDashboard = initAdminDashboard;
window.openCreateBusModal = openCreateBusModal;
window.deleteBusAdmin = deleteBusAdmin;
window.openCreateCompanyModal = openCreateCompanyModal;
window.openCreateRouteModal = openCreateRouteModal;
window.resolveIncidentAdmin = resolveIncidentAdmin;
window.resetAllSystemData = resetAllSystemData;
