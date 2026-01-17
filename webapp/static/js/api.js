/**
 * API module for Shovo
 */

import {
  getCached,
  setCached,
  getListCacheKey,
  getDetailCacheKey,
  getSearchCacheKey,
  invalidateListCache
} from './cache.js';

const MAX_RESULTS = 10;

/**
 * Search for titles
 * @param {string} query - Search query
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<object>} - Search results
 */
export async function searchTitles(query, signal) {
  if (!query || query.length < 3) {
    return { results: [] };
  }

  // Check cache first
  const cacheKey = getSearchCacheKey(query);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) {
    throw new Error('Search failed');
  }
  const data = await response.json();

  // Cache the results
  setCached(cacheKey, data);

  return data;
}

/**
 * Get trending titles
 * @returns {Promise<object>} - Trending results
 */
export async function getTrending() {
  // Check cache first
  const cached = getCached('trending');
  if (cached) {
    return cached;
  }

  const response = await fetch('/api/trending');
  if (!response.ok) {
    throw new Error('Failed to fetch trending');
  }
  const data = await response.json();

  // Cache the results
  setCached('trending', data);

  return data;
}

/**
 * Get list items for a room
 * @param {string} room - Room ID
 * @param {string} status - Status (unwatched/watched)
 * @param {number} page - Page number
 * @param {number} perPage - Items per page
 * @returns {Promise<object>} - List data
 */
export async function getList(room, status, page = 1, perPage = MAX_RESULTS) {
  // Check cache first
  const cacheKey = getListCacheKey(room, status, page);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `/api/list?room=${encodeURIComponent(room)}&status=${status}&page=${page}&per_page=${perPage}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch list');
  }
  const data = await response.json();

  // Cache the results
  setCached(cacheKey, data);

  return data;
}

/**
 * Get details for a title
 * @param {string} titleId - Title ID
 * @param {string} typeLabel - Type label
 * @returns {Promise<object>} - Title details
 */
export async function getDetails(titleId, typeLabel) {
  // Check cache first
  const cacheKey = getDetailCacheKey(titleId);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `/api/details?title_id=${encodeURIComponent(titleId)}&type_label=${encodeURIComponent(typeLabel || '')}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch details');
  }
  const data = await response.json();

  // Cache the results
  setCached(cacheKey, data);

  return data;
}

/**
 * Add an item to a list
 * @param {string} room - Room ID
 * @param {object} item - Item to add
 * @param {boolean} watched - Whether item is watched
 * @returns {Promise<object>} - Response
 */
export async function addToList(room, item, watched = false) {
  const response = await fetch('/api/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...item, room, watched })
  });
  if (!response.ok) {
    throw new Error('Failed to add item');
  }

  // Invalidate list cache
  invalidateListCache(room);

  return response.json();
}

/**
 * Update watched status
 * @param {string} room - Room ID
 * @param {string} titleId - Title ID
 * @param {boolean} watched - Watched status
 * @returns {Promise<object>} - Response
 */
export async function updateWatched(room, titleId, watched) {
  const response = await fetch('/api/list', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title_id: titleId, room, watched: watched ? 1 : 0 })
  });
  if (!response.ok) {
    throw new Error('Failed to update item');
  }

  // Invalidate list cache
  invalidateListCache(room);

  return response.json();
}

/**
 * Remove an item from a list
 * @param {string} room - Room ID
 * @param {string} titleId - Title ID
 * @returns {Promise<object>} - Response
 */
export async function removeFromList(room, titleId) {
  const response = await fetch('/api/list', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title_id: titleId, room })
  });
  if (!response.ok) {
    throw new Error('Failed to remove item');
  }

  // Invalidate list cache
  invalidateListCache(room);

  return response.json();
}

/**
 * Update list order
 * @param {string} room - Room ID
 * @param {string[]} order - Array of title IDs in order
 * @returns {Promise<object>} - Response
 */
export async function updateOrder(room, order) {
  const response = await fetch('/api/list/order', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, order })
  });
  if (!response.ok) {
    throw new Error('Failed to update order');
  }

  // Invalidate list cache
  invalidateListCache(room);

  return response.json();
}

/**
 * Start database refresh
 * @param {string} room - Room ID
 * @returns {Promise<object>} - Response
 */
export async function startRefresh(room) {
  const response = await fetch('/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room })
  });
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Refresh already in progress');
    }
    throw new Error('Failed to start refresh');
  }

  // Invalidate list cache
  invalidateListCache(room);

  return response.json();
}

/**
 * Get refresh status
 * @param {string} room - Room ID
 * @returns {Promise<object>} - Refresh status
 */
export async function getRefreshStatus(room) {
  const response = await fetch(`/api/refresh/status?room=${encodeURIComponent(room)}`);
  if (!response.ok) {
    throw new Error('Failed to get refresh status');
  }
  return response.json();
}

export { MAX_RESULTS };
