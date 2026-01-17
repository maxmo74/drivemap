/**
 * Settings management module for Shovo
 */

const SETTINGS_COOKIE = 'shovo_settings';
const DEFAULT_ROOM_COOKIE = 'shovo_default_room';

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string} - Cookie value or empty string
 */
export function getCookie(name) {
  const cookies = document.cookie.split(';').map((cookie) => cookie.trim());
  const entry = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!entry) {
    return '';
  }
  return decodeURIComponent(entry.split('=').slice(1).join('='));
}

/**
 * Set a cookie
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration
 */
export function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Default settings object
 */
export const defaultSettings = {
  compact: false,
  defaultRoom: '',
  rooms: {}
};

/**
 * Load settings from cookie
 * @returns {object} - Settings object
 */
export function loadSettings() {
  try {
    const raw = getCookie(SETTINGS_COOKIE);
    if (!raw) {
      return { ...defaultSettings };
    }
    const parsed = JSON.parse(raw);
    return {
      compact: Boolean(parsed.compact),
      defaultRoom: parsed.defaultRoom || '',
      rooms: parsed.rooms || {}
    };
  } catch (error) {
    return { ...defaultSettings };
  }
}

/**
 * Save settings to cookie
 * @param {object} settings - Settings object
 */
export function saveSettings(settings) {
  setCookie(SETTINGS_COOKIE, JSON.stringify(settings));
  if (settings.defaultRoom) {
    setCookie(DEFAULT_ROOM_COOKIE, settings.defaultRoom);
  }
}

/**
 * Generate a random password
 * @returns {string} - Random password
 */
export function generatePassword() {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Ensure room state exists in settings
 * @param {object} settings - Settings object
 * @param {string} roomId - Room ID
 */
export function ensureRoomState(settings, roomId) {
  if (!settings.rooms[roomId]) {
    settings.rooms[roomId] = {
      private: false,
      password: '',
      lastVisited: Date.now(),
      authorized: true
    };
  } else {
    settings.rooms[roomId].lastVisited = Date.now();
    if (settings.rooms[roomId].private && !settings.rooms[roomId].password) {
      settings.rooms[roomId].password = generatePassword();
    }
  }
}

/**
 * Encode a share token
 * @param {object} payload - Payload to encode
 * @returns {string} - Encoded token
 */
export function encodeShareToken(payload) {
  const raw = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(raw)));
}

/**
 * Decode a share token
 * @param {string} token - Token to decode
 * @returns {object|null} - Decoded payload or null
 */
export function decodeShareToken(token) {
  try {
    const raw = decodeURIComponent(escape(atob(token)));
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

/**
 * Check if a room is private
 * @param {object} settings - Settings object
 * @param {string} roomId - Room ID
 * @returns {boolean}
 */
export function isRoomPrivate(settings, roomId) {
  return settings.rooms[roomId]?.private || false;
}

/**
 * Get room password
 * @param {object} settings - Settings object
 * @param {string} roomId - Room ID
 * @returns {string}
 */
export function getRoomPassword(settings, roomId) {
  return settings.rooms[roomId]?.password || '';
}

/**
 * Check if room is authorized
 * @param {object} settings - Settings object
 * @param {string} roomId - Room ID
 * @returns {boolean}
 */
export function isRoomAuthorized(settings, roomId) {
  return settings.rooms[roomId]?.authorized !== false;
}

export { SETTINGS_COOKIE, DEFAULT_ROOM_COOKIE };
