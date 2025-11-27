const CACHE_NAME = 'waspadaku-v1';
const RUNTIME_CACHE = 'waspadaku-runtime-v1';
const API_CACHE = 'waspadaku-api-v1';

// Static assets to cache - only include files that exist
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        // Cache files one by one to avoid errors
        return Promise.all(
          STATIC_ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache:', url, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== API_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests - stale-while-revalidate
  if (url.origin === 'https://data.petabencana.id') {
    event.respondWith(
      caches.open(API_CACHE).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Handle static assets - cache first
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Cache runtime assets
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseToCache).catch(err => {
              console.warn('[SW] Failed to cache:', request.url);
            });
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline page if available
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background Sync
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-status') {
    event.waitUntil(syncStatus());
  }

  if (event.tag === 'sync-report') {
    event.waitUntil(syncReports());
  }
});

async function syncStatus() {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingStatus', 'readonly');
    const store = tx.objectStore('pendingStatus');
    const allStatus = await getAllFromStore(store);

    for (const status of allStatus) {
      try {
        await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(status)
        });

        const deleteTx = db.transaction('pendingStatus', 'readwrite');
        await deleteTx.objectStore('pendingStatus').delete(status.id);
      } catch (err) {
        console.error('[SW] Failed to sync status:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

async function syncReports() {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingReports', 'readonly');
    const store = tx.objectStore('pendingReports');
    const allReports = await getAllFromStore(store);

    for (const report of allReports) {
      try {
        await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });

        const deleteTx = db.transaction('pendingReports', 'readwrite');
        await deleteTx.objectStore('pendingReports').delete(report.id);
      } catch (err) {
        console.error('[SW] Failed to sync report:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync reports failed:', err);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WaspadakuDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pendingStatus')) {
        db.createObjectStore('pendingStatus', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('pendingReports')) {
        db.createObjectStore('pendingReports', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('disasters')) {
        db.createObjectStore('disasters', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('evacPoints')) {
        db.createObjectStore('evacPoints', { keyPath: 'id' });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Push notification event
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);

  let notificationData = {
    title: 'WaspadaKu',
    body: 'Ada notifikasi baru',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    tag: 'disaster-alert',
    requireInteraction: true
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (err) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Message event
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker loaded');