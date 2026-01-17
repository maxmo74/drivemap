/**
 * localStorage caching module for Shovo
 */

const CACHE_PREFIX = 'shovo_cache_';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get an item from localStorage cache
 * @param {string} key - Cache key
 * @returns {any|null} - Cached value or null if expired/missing
 */
export function getCached(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) {
      return null;
    }
    const { value, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return value;
  } catch (error) {
    return null;
  }
}

/**
 * Set an item in localStorage cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 */
export function setCached(key, value) {
  try {
    const item = {
      value,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (error) {
    // localStorage might be full or disabled
    cleanupCache();
    try {
      const item = {
        value,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (retryError) {
      // Silently fail
    }
  }
}

/**
 * Remove an item from cache
 * @param {string} key - Cache key
 */
export function removeCached(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Clear all cached items
 */
export function clearCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // Silently fail
  }
}

/**
 * Remove expired items from cache
 */
export function cleanupCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (Date.now() - (item.timestamp || 0) > CACHE_TTL) {
            keysToRemove.push(key);
          }
        } catch (parseError) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // Silently fail
  }
}

/**
 * Get list cache key for a room
 * @param {string} room - Room ID
 * @param {string} status - Status (unwatched/watched)
 * @param {number} page - Page number
 * @returns {string} - Cache key
 */
export function getListCacheKey(room, status, page) {
  return `list_${room}_${status}_${page}`;
}

/**
 * Get detail cache key for a title
 * @param {string} titleId - Title ID
 * @returns {string} - Cache key
 */
export function getDetailCacheKey(titleId) {
  return `detail_${titleId}`;
}

/**
 * Get search cache key
 * @param {string} query - Search query
 * @returns {string} - Cache key
 */
export function getSearchCacheKey(query) {
  return `search_${query.toLowerCase().trim()}`;
}

/**
 * Invalidate list cache for a room
 * @param {string} room - Room ID
 */
export function invalidateListCache(room) {
  try {
    const keysToRemove = [];
    const prefix = CACHE_PREFIX + 'list_' + room + '_';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // Silently fail
  }
}

// Run cleanup on module load
cleanupCache();
