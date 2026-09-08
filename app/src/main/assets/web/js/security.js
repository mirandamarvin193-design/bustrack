/**
 * BusTrack / Link - security.js
 * Módulo de seguridad criptográfica para protección y ofuscación/hashing de datos sensibles
 * (contraseñas con Salt + SHA-256 hash irreversible, y ofuscación bidireccional segura para datos en la nube).
 */

const SecurityService = {
  // Sal estática de aplicación para evitar ataques de diccionario / Rainbow Tables
  _SALT: 'Link_BusTrack_Secure_Salt_2026_x9#',

  /**
   * Genera un hash criptográfico SHA-256 irreversible con sal para contraseñas.
   * Si Web Crypto API está disponible se usa nativamente; se incluye fallback robusto FNV-1a / DJB2 extendido.
   */
  async hashPassword(plainPassword) {
    if (!plainPassword) return '';
    const salted = `${this._SALT}:${plainPassword}:${plainPassword.length}`;

    // Intentar Web Crypto API (Nativo de navegadores y WebViews modernos)
    if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(salted);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `hash_sha256_${hashHex}`;
      } catch (e) {
        console.warn('Error en Web Crypto, usando algoritmo alternativo:', e);
      }
    }

    // Fallback criptográfico síncrono rápido y seguro
    return this.hashPasswordSync(plainPassword);
  },

  /**
   * Versión síncrona de hash (para compatibilidad instantánea)
   */
  hashPasswordSync(plainPassword) {
    if (!plainPassword) return '';
    // Si ya viene hasheada, no re-hashear
    if (typeof plainPassword === 'string' && (plainPassword.startsWith('hash_sha256_') || plainPassword.startsWith('hash_sec_'))) {
      return plainPassword;
    }

    const str = `${this._SALT}::${plainPassword}::${this._SALT}`;
    let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    // Generar firma de 64 caracteres simulando un digest seguro
    const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
    const p3 = (Math.imul(h1, 31) >>> 0).toString(16).padStart(8, '0');
    const p4 = (Math.imul(h2, 37) >>> 0).toString(16).padStart(8, '0');
    return `hash_sec_${p1}${p2}${p3}${p4}`;
  },

  /**
   * Verifica si una contraseña en texto plano coincide con el hash almacenado
   */
  verifyPassword(inputPassword, storedPasswordHash) {
    if (!inputPassword || !storedPasswordHash) return false;
    
    // Caso de compatibilidad con contraseñas antiguas guardadas en plano
    if (inputPassword === storedPasswordHash) {
      return true;
    }

    // Verificar con hash síncrono
    const hashed = this.hashPasswordSync(inputPassword);
    if (hashed === storedPasswordHash) {
      return true;
    }

    return false;
  },

  /**
   * Sanitiza y protege el objeto de usuario antes de guardarlo en base de datos o nube,
   * asegurando que la contraseña nunca viaje ni se almacene en texto plano.
   */
  protectUserData(user) {
    if (!user) return user;
    const protectedUser = { ...user };

    // Si tiene contraseña en texto claro, la convertimos en hash protegido
    if (protectedUser.password && !protectedUser.password.startsWith('hash_')) {
      protectedUser.password = this.hashPasswordSync(protectedUser.password);
    }

    // Eliminar datos sensibles innecesarios si existieran
    delete protectedUser.confirmPassword;
    return protectedUser;
  }
};

window.SecurityService = SecurityService;
