// Firebase Configuration for FCM (Push Notifications)
// Note: This file is for the main app, NOT service worker

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOQQNNIJYlsR5LLNoVUw6S6trfQ4YhNjY",
  authDomain: "waspadaku-f6f56.firebaseapp.com",
  projectId: "waspadaku-f6f56",
  storageBucket: "waspadaku-f6f56.firebasestorage.app",
  messagingSenderId: "944530757052",
  appId: "1:944530757052:web:aee32849f12067d939c7b9",
  measurementId: "G-627DF3DTX9"
};

// Initialize Firebase (dilakukan di index.html dengan script tag)
let messaging = null;

async function initializeFirebase() {
  try {
    // Check if Firebase SDK loaded
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK not loaded');
      return false;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    // Check if messaging is supported
    if (firebase.messaging && firebase.messaging.isSupported()) {
      messaging = firebase.messaging();
      console.log('✅ Firebase Messaging initialized');
      return true;
    } else {
      console.warn('⚠️ Firebase Messaging not supported in this browser');
      return false;
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    return false;
  }
}

// Request notification permission and get FCM token
async function requestNotificationPermission() {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) {
      alert('❌ Firebase Messaging tidak didukung di browser ini');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM token
      const token = await messaging.getToken({
        vapidKey: 'BIuHh8pNiewQq0yZR6Nu-uquXMZGpl9AxWaK1exWZXSF3EEVx9Bi9Po98-vGs_O22WIpEETx9KDTz80lUx8_ezY'
      });
      
      if (token) {
        console.log('📱 FCM Token:', token);
        localStorage.setItem('fcm_token', token);
        await sendTokenToServer(token);
        return token;
      } else {
        console.warn('⚠️ No FCM token available');
        return null;
      }
    } else {
      console.warn('⚠️ Notification permission denied');
      alert('❌ Izin notifikasi ditolak. Anda tidak akan menerima peringatan bencana.');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting notification permission:', error);
    alert('❌ Gagal mengaktifkan notifikasi: ' + error.message);
    return null;
  }
}

// Send FCM token to server
async function sendTokenToServer(token) {
  try {
    // In production, send to your backend
    console.log('📤 Saving FCM token locally (demo mode)');
    localStorage.setItem('fcm_token', token);
    localStorage.setItem('fcm_token_time', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error sending FCM token:', error);
  }
}

// Handle foreground messages
function setupForegroundMessageHandler() {
  if (!messaging) return;
  
  messaging.onMessage((payload) => {
    console.log('📨 Message received (foreground):', payload);
    
    const notificationTitle = payload.notification?.title || 'WaspadaKu';
    const notificationOptions = {
      body: payload.notification?.body || 'Ada notifikasi baru',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: payload.data?.tag || 'disaster-alert',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: payload.data
    };

    // Show notification
    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, notificationOptions);
    }

    // Save to notification history
    saveNotificationToHistory({
      id: Date.now(),
      title: notificationTitle,
      body: notificationOptions.body,
      time: new Date().toLocaleString('id-ID'),
      data: payload.data
    });

    // Show emergency modal if critical
    if (payload.data?.priority === 'high' || payload.data?.emergency === 'true') {
      showEmergencyAlert(notificationTitle, notificationOptions.body);
    }
  });
}

// Save notification to history
function saveNotificationToHistory(notification) {
  try {
    let notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    notifications.unshift(notification);
    
    if (notifications.length > 50) {
      notifications = notifications.slice(0, 50);
    }
    
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    window.dispatchEvent(new CustomEvent('notification-received', { 
      detail: notification 
    }));
  } catch (error) {
    console.error('Error saving notification:', error);
  }
}

// Show emergency alert
function showEmergencyAlert(title, message) {
  window.dispatchEvent(new CustomEvent('emergency-alert', {
    detail: { title, message }
  }));
}

// Initialize when page loads
if (typeof window !== 'undefined') {
  window.initializeFirebase = initializeFirebase;
  window.requestNotificationPermission = requestNotificationPermission;
  
  // Auto-initialize if permission already granted
  if (Notification.permission === 'granted') {
    initializeFirebase().then(success => {
      if (success) {
        setupForegroundMessageHandler();
      }
    });
  }
  
  // Listen for emergency alerts
  window.addEventListener('emergency-alert', (event) => {
    const alpineEl = document.querySelector('[x-data]');
    if (alpineEl && alpineEl._x_dataStack) {
      const data = alpineEl._x_dataStack[0];
      if (data) {
        data.emergencyMessage = event.detail.message;
        data.showEmergencyModal = true;
      }
    }
  });
  
  // Listen for notification updates
  window.addEventListener('notification-received', (event) => {
    const alpineEl = document.querySelector('[x-data]');
    if (alpineEl && alpineEl._x_dataStack) {
      const data = alpineEl._x_dataStack[0];
      if (data && data.notifications) {
        data.notifications.unshift(event.detail);
      }
    }
  });
}