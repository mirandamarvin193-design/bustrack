/**
 * BusTrack - notifications.js
 * Sistema de alertas sonoras (Web Audio API) y notificaciones visuales en pantalla.
 * Incluye sonidos diferenciados para:
 *  - AZUL: Pasajero que quiere SUBIR
 *  - ROJO: Pasajero que quiere BAJAR
 *  - PARADA: Aproximación a parada programada
 */

const NotificationService = {
  audioCtx: null,
  audioPermissionGranted: false,

  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.audioPermissionGranted = true;
  },

  /**
   * Tono sintetizado para alerta AZUL: Pasajero quiere SUBIR
   * Doble tono ascendente brillante (C5 -> E5)
   */
  playBlueAlert() {
    this.initAudio();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);

    // Segundo beep rápido
    const osc3 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(783.99, now + 0.2); // G5
    gain2.gain.setValueAtTime(0.01, now + 0.2);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc3.connect(gain2);
    gain2.connect(ctx.destination);
    osc3.start(now + 0.2);
    osc3.stop(now + 0.5);
  },

  /**
   * Tono sintetizado para alerta ROJA: Pasajero quiere BAJAR
   * Triple tono descendente de aviso (G5 -> E5 -> C5)
   */
  playRedAlert() {
    this.initAudio();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(784, now); // G5
    osc.frequency.setValueAtTime(659, now + 0.15); // E5
    osc.frequency.setValueAtTime(523, now + 0.30); // C5

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.setValueAtTime(0.3, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  },

  /**
   * Tono sintetizado para alerta de PARADA PROGRAMADA
   * Timbre armónico suave y agradable
   */
  playStopAlert() {
    this.initAudio();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25); // C6

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  },

  /**
   * Muestra notificación visual en pantalla (Toast flotante)
   */
  toast(message, type = 'info', duration = 4500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'blue' || type === 'board') icon = '🔵';
    else if (type === 'red' || type === 'dropoff') icon = '🔴';
    else if (type === 'stop') icon = '🚏';
    else if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Inicializa el audio automáticamente en el primer toque del usuario (sin bloquear pantalla)
   */
  setupAutoAudioUnlock() {
    const unlock = () => {
      this.initAudio();
    };
    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  },

  /**
   * No bloquea la pantalla. El audio se activa automáticamente al interactuar.
   */
  requestPermissionsDialog() {
    this.setupAutoAudioUnlock();
  }
};

// Permitir cerrar cualquier modal al hacer clic en el fondo oscuro
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-backdrop')) {
    e.target.remove();
  }
});

// Inicializar desbloqueo de audio silencioso al cargar
document.addEventListener('DOMContentLoaded', () => {
  NotificationService.setupAutoAudioUnlock();
});

window.NotificationService = NotificationService;
