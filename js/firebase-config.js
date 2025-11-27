// Firebase Configuration for FCM (Push Notifications)
// Note: This file is for the main app, NOT service worker

// Firebase configuration
// GANTI dengan konfigurasi Firebase Anda dari Firebase Console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOQQNNIJYlsR5LLNoVUw6S6trfQ4YhNjY",
  authDomain: "waspadaku-f6f56.firebaseapp.com",
  projectId: "waspadaku-f6f56",
  storageBucket: "waspadaku-f6f56.firebasestorage.app",
  messagingSenderId: "944530757052",
  appId: "1:944530757052:web:aee32849f12067d939c7b9",
  measurementId: "G-627DF3DTX9"
};

// Initialize Firebase
let messaging = null;

function initializeFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    // Check if messaging is supported
    if (firebase.messaging.isSupported()) {
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
    if (!initializeFirebase()) {
      throw new Error('Firebase Messaging not supported');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM token
      const token = await messaging.getToken({
        vapidKey: 'BIuHh8pNiewQq0yZR6Nu-uquXMZGpl9AxWaK1exWZXSF3EEVx9Bi9Po98-vGs_O22WIpEETx9KDTz80lUx8_ezY' // Get from Firebase Console > Project Settings > Cloud Messaging
      });
      
      if (token) {
        console.log('📱 FCM Token:', token);
        
        // Save token to localStorage
        localStorage.setItem('fcm_token', token);
        
        // Send token to your server
        await sendTokenToServer(token);
        
        return token;
      } else {
        console.warn('⚠️ No FCM token available');
        return null;
      }
    } else {
      console.warn('⚠️ Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting notification permission:', error);
    return null;
  }
}

// Send FCM token to server
async function sendTokenToServer(token) {
  try {
    const response = await fetch('/api/fcm/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    });
    
    if (response.ok) {
      console.log('✅ FCM token sent to server');
    } else {
      console.error('❌ Failed to send FCM token to server');
    }
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
      icon: payload.notification?.icon || '/icons/icon-192.png',
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
    
    // Keep only last 50 notifications
    if (notifications.length > 50) {
      notifications = notifications.slice(0, 50);
    }
    
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    // Trigger custom event to update UI
    window.dispatchEvent(new CustomEvent('notification-received', { 
      detail: notification 
    }));
  } catch (error) {
    console.error('Error saving notification:', error);
  }
}

// Show emergency alert
function showEmergencyAlert(title, message) {
  // Trigger custom event for Alpine.js to handle
  window.dispatchEvent(new CustomEvent('emergency-alert', {
    detail: { title, message }
  }));
}

// Token refresh handler
function setupTokenRefreshHandler() {
  if (!messaging) return;
  
  messaging.onTokenRefresh(async () => {
    try {
      const newToken = await messaging.getToken({
        vapidKey: 'YOUR_VAPID_KEY'
      });
      
      console.log('🔄 FCM Token refreshed:', newToken);
      localStorage.setItem('fcm_token', newToken);
      await sendTokenToServer(newToken);
    } catch (error) {
      console.error('❌ Error refreshing FCM token:', error);
    }
  });
}

// Delete FCM token (for logout/unsubscribe)
async function deleteFCMToken() {
  try {
    if (!messaging) return;
    
    const token = localStorage.getItem('fcm_token');
    if (token) {
      await messaging.deleteToken();
      localStorage.removeItem('fcm_token');
      console.log('✅ FCM token deleted');
    }
  } catch (error) {
    console.error('❌ Error deleting FCM token:', error);
  }
}

// Initialize when page loads
if (typeof window !== 'undefined') {
  window.initializeFirebase = initializeFirebase;
  window.requestNotificationPermission = requestNotificationPermission;
  window.deleteFCMToken = deleteFCMToken;
  
  // Auto-initialize if permission already granted
  if (Notification.permission === 'granted') {
    initializeFirebase();
    setupForegroundMessageHandler();
    setupTokenRefreshHandler();
  }
  
  // Listen for emergency alerts
  window.addEventListener('emergency-alert', (event) => {
    const alpineInstance = document.querySelector('[x-data]').__x;
    if (alpineInstance) {
      alpineInstance.$data.emergencyMessage = event.detail.message;
      alpineInstance.$data.showEmergencyModal = true;
    }
  });
  
  // Listen for notification updates
  window.addEventListener('notification-received', (event) => {
    const alpineInstance = document.querySelector('[x-data]').__x;
    if (alpineInstance) {
      alpineInstance.$data.notifications.unshift(event.detail);
    }
  });
}