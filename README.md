# BusTrack - Sistema de Monitoreo de Transporte Público en Tiempo Real

**BusTrack** es una aplicación integral para la visualización, seguimiento y gestión de flotas de autobuses en tiempo real, diseñada para operar en dispositivos móviles, tablets y computadoras, e integrada nativamente en Android con Jetpack Compose y WebView.

---

## 🚀 Características Principales

### 🧑‍🤝‍🧑 Módulo de Pasajeros
- **Mapa interactivo en tiempo real**: Visualización de unidades en movimiento sobre mapas interactivos (OpenStreetMap / Leaflet).
- **Buscador de transporte**: Búsqueda por empresa de transporte, ruta o número de bus.
- **Solicitud de parada interactiva**:
  - **Subir al Bus (Azul)**: Genera un marcador azul en el mapa y alerta al conductor cuando está a menos de 50 metros.
  - **Bajar del Bus (Rojo)**: Notificación en cabina con sonido descendente distintivo para solicitar la parada.
- **Horarios y rutas**: Consulta de paradas oficiales, frecuencias y recorridos completos.

### 👨‍✈️ Módulo de Conductor
- **Cabina interactiva**:
  - **Botón "Bus Lleno"**: Marca la unidad en amarillo y actualiza el estado en el mapa para todos los usuarios.
  - **Botón "Bus Averiado"**: Marca la unidad en rojo, registra una incidencia y notifica a los pasajeros y a la administración.
- **Contadores de pasajeros**: Conteo de pasajeros esperando subir y pasajeros que desean descender.
- **Alertas sonoras automáticas (Radio de 50 metros)**: Utiliza la fórmula de Haversine para emitir sonidos diferenciados cuando el bus entra en el radio de 50 metros de un pasajero en espera.
- **Aislamiento por Empresa**: Cada conductor solo visualiza las solicitudes y unidades de su propia empresa de transporte.

### ⚙️ Módulo de Administración
- Gestión completa (CRUD) de Empresas, Rutas, Paradas, Buses y Horarios.
- Panel de control de incidencias y averías mecánicas en tiempo real.
- Botón para restaurar datos iniciales de demostración.

---

## 🛠️ Arquitectura y Tecnologías

- **Android Client**: Kotlin, Android Jetpack Compose, Android WebView con soporte de geolocalización por hardware (`ACCESS_FINE_LOCATION`).
- **Frontend Web**: HTML5, CSS3 responsivo (diseño adaptable a móviles, tablets y monitores), JavaScript moderno (ES6+).
- **Capa de Persistencia Desacoplada (DAO)**: Patrón repositorio en `storage.js` con estructuras JSON normalizadas, listas para conectarse directamente a Firebase, PostgreSQL o MySQL.
- **Geolocalización y Cálculo de Distancias**: Implementación de la fórmula de Haversine para detección de cercanía a 50m.
- **Alertas de Audio**: Web Audio API para alertas sonoras ascendentes (subida) y descendentes (bajada).

---

## 📂 Estructura del Proyecto

```text
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/example/MainActivity.kt   # Integración Jetpack Compose y WebView
│   │   │   ├── assets/web/                        # Aplicación web completa
│   │   │   │   ├── css/                           # Estilos (style.css, passenger.css, driver.css)
│   │   │   │   ├── js/                            # Lógica (storage.js, gps.js, notifications.js, map.js, auth.js, etc.)
│   │   │   │   ├── passenger/                     # Vistas de pasajero (dashboard, map, buses, schedules, profile)
│   │   │   │   ├── driver/                        # Vistas de conductor (dashboard, route, bus, schedule, profile)
│   │   │   │   ├── admin/                         # Panel de administración
│   │   │   │   ├── index.html                     # Pantalla de bienvenida con accesos de prueba
│   │   │   │   ├── login.html                     # Login con acceso rápido demo
│   │   │   │   └── register.html                  # Registro de usuarios y conductores
│   │   │   └── res/                               # Recursos Android (strings, drawable, mipmap)
│   └── build.gradle.kts
└── settings.gradle.kts
```

---

## 📲 Cómo Ejecutar el Proyecto

### Opción 1: En Android Studio
1. Clona este repositorio o abre la carpeta en **Android Studio**.
2. Deja que Gradle sincronice las dependencias.
3. Conecta un dispositivo físico o inicia un emulador Android.
4. Presiona **Run** (`Shift + F10`) para compilar e instalar la APK.

### Opción 2: En Cualquier Navegador Web
Puedes abrir directamente el archivo `app/src/main/assets/web/index.html` en tu navegador web favorito (Chrome, Firefox, Edge, Safari) o servirlo mediante un servidor local:
```bash
npx serve app/src/main/assets/web
```

---

## 🔑 Credenciales de Prueba Rápidas
En la pantalla de inicio de sesión (`login.html`), puedes usar los botones de 1-clic o introducir:
- **Pasajero**: `pasajero@demo.com` / `123456`
- **Conductor**: `conductor@demo.com` / `123456`
- **Administrador**: `admin@bustrack.com` / `admin123`
