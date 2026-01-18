const CACHE_NAME = 'shovo-v1.6.14';
const STATIC_CACHE = 'shovo-static-v1.6.14';
const API_CACHE = 'shovo-api-v1.6.14';

const STATIC_ASSETS = [
  '/',
  '/static/style.css',
  '/static/app.js',
  '/static/share.svg',
  '/static/copy.svg',
  '/static/email.svg',
  '/static/whatsapp.svg',
  '/static/messenger.svg',
  '/static/telegram.svg',
  '/static/instagram.svg',
  '/static/imdb-logo.svg',
  '/static/rotten-tomatoes.svg',
  '/manifest.json'
];

const API_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('/r/')));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json') {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Handle room pages - network first, cache fallback
  if (url.pathname.startsWith('/r/')) {
    event.respondWith(handlePageRequest(event.request));
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

async function handleStaticRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Return cached and update in background
    fetchAndCache(request, STATIC_CACHE);
    return cached;
  }
  return fetchAndCache(request, STATIC_CACHE);
}

async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Only cache GET requests for list and details
  if (request.method !== 'GET') {
    return fetch(request);
  }

  // Cache list and details endpoints
  if (url.pathname === '/api/list' || url.pathname === '/api/details') {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        const responseToCache = response.clone();
        // Add timestamp header for cache invalidation
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const cachedResponse = new Response(await responseToCache.blob(), {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
        cache.put(request, cachedResponse);
      }
      return response;
    } catch (error) {
      // Network failed, try cache
      const cached = await caches.match(request);
      if (cached) {
        const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
        if (Date.now() - cachedAt < API_CACHE_DURATION) {
          return cached;
        }
      }
      throw error;
    }
  }

  // Search and trending - network only but cache for offline
  if (url.pathname === '/api/search' || url.pathname === '/api/trending') {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  return fetch(request);
}

async function handlePageRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page or error
    return new Response('Offline - Please check your connection', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE);
  }
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
