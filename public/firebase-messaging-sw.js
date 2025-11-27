// Firebase Cloud Messaging Service Worker
// This file handles background notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (same as firebase-config.js)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // Extract notification data
  const notificationTitle = payload.notification?.title || 'WaspadaKu - Peringatan Bencana';
  const notificationOptions = {
    body: payload.notification?.body || 'Ada peringatan bencana baru di wilayah Anda',
    icon: payload.notification?.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: payload.data?.tag || 'disaster-alert',
    requireInteraction: true,
    vibrate: [300, 200, 300, 200, 300],
    actions: [
      {
        action: 'view',
        title: 'Lihat Detail'
      },
      {
        action: 'close',
        title: 'Tutup'
      }
    ],
    data: {
      url: payload.data?.url || '/',
      timestamp: Date.now(),
      ...payload.data
    }
  };

  // Add custom notification styles based on disaster type
  if (payload.data?.hazard) {
    const hazardColors = {
      'banjir': '#3b82f6',
      'gempa': '#ef4444',
      'longsor': '#f97316',
      'karhutla': '#ca8a04'
    };
    notificationOptions.badge = `/icons/badge-${payload.data.hazard}.png`;
  }

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  const action = event.action;

  if (action === 'close') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if there's already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );

  // Save notification interaction
  saveNotificationInteraction(event.notification.data);
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event);
  
  // Track notification dismissal
  trackNotificationDismissal(event.notification.data);
});

// Save notification interaction to IndexedDB
async function saveNotificationInteraction(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('notificationInteractions', 'readwrite');
    const store = tx.objectStore('notificationInteractions');
    
    await store.add({
      timestamp: Date.now(),
      action: 'clicked',
      data: data
    });
    
    console.log('✅ Notification interaction saved');
  } catch (error) {
    console.error('❌ Error saving notification interaction:', error);
  }
}

// Track notification dismissal
async function trackNotificationDismissal(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('notificationInteractions', 'readwrite');
    const store = tx.objectStore('notificationInteractions');
    
    await store.add({
      timestamp: Date.now(),
      action: 'dismissed',
      data: data
    });
  } catch (error) {
    console.error('❌ Error tracking dismissal:', error);
  }
}

// Open IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WaspadakuDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('notificationInteractions')) {
        db.createObjectStore('notificationInteractions', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
      }

      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
      }
    };
  });
}

// Periodic background sync for critical updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-disasters') {
    event.waitUntil(checkForCriticalDisasters());
  }
});

// Check for critical disasters
async function checkForCriticalDisasters() {
  try {
    const response = await fetch('https://data.petabencana.id/reports?timeperiod=3600');
    const data = await response.json();
    
    if (data.result && data.result.features && data.result.features.length > 0) {
      const criticalDisasters = data.result.features.filter(feature => {
        // Filter high-priority disasters
        return feature.properties.disaster_type === 'earthquake' || 
               (feature.properties.disaster_type === 'flood' && 
                feature.properties.report_data?.flood_depth > 100);
      });

      if (criticalDisasters.length > 0) {
        // Show notification for critical disasters
        const disaster = criticalDisasters[0];
        await self.registration.showNotification('⚠️ Peringatan Bencana Kritis!', {
          body: `${disaster.properties.disaster_type} terdeteksi di ${disaster.properties.title}`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          requireInteraction: true,
          vibrate: [500, 200, 500],
          tag: 'critical-disaster',
          data: {
            url: '/',
            hazard: disaster.properties.disaster_type,
            location: disaster.properties.title
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking for critical disasters:', error);
  }
}

console.log('[firebase-messaging-sw.js] Service Worker loaded');