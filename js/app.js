// Alpine.js Main Application
function waspadaApp() {
  return {
    // State
    currentPage: 'dashboard',
    loading: true,
    isOnline: navigator.onLine,
    showEmergencyModal: false,
    emergencyMessage: '',
    
    // Data
    disasters: [],
    stats: {
      banjir: 0,
      gempa: 0,
      longsor: 0,
      karhutla: 0
    },
    notifications: [],
    evacPoints: [],
    myReports: [],
    
    // Form
    reportForm: {
      hazard: 'banjir',
      description: ''
    },
    
    // Map
    map: null,
    markers: [],

    // Initialize
    async init() {
      console.log('🚀 WaspadaKu initialized');
      
      // Setup online/offline detection
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncPendingData();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Load data
      await this.loadData();
      
      // Initialize map after a short delay
      setTimeout(() => {
        if (this.currentPage === 'map') {
          this.initMap();
        }
      }, 500);

      // Watch for page changes
      this.$watch('currentPage', (value) => {
        if (value === 'map' && !this.map) {
          setTimeout(() => this.initMap(), 100);
        }
      });

      // Auto refresh data every 2 minutes
      setInterval(() => {
        if (this.isOnline) {
          this.loadDisasters();
        }
      }, 120000);

      this.loading = false;
    },

    // Load all data
    async loadData() {
      await Promise.all([
        this.loadDisasters(),
        this.loadEvacPoints(),
        this.loadNotifications(),
        this.loadMyReports()
      ]);
    },

    // Load disasters from PetaBencana.id
    async loadDisasters() {
      try {
        const response = await fetch('https://data.petabencana.id/reports?timeperiod=604800');
        const data = await response.json();
        
        if (data.result && data.result.features) {
          this.disasters = data.result.features.map(feature => ({
            id: feature.properties.pkey,
            hazard: feature.properties.disaster_type || 'unknown',
            description: feature.properties.text || '',
            location: feature.properties.title || '',
            water_depth: feature.properties.report_data?.flood_depth || null,
            created_at: feature.properties.created_at,
            coordinates: feature.geometry.coordinates,
            image_url: feature.properties.image_url || null,
            source: feature.properties.source || 'user'
          })).slice(0, 50); // Limit to 50 latest
          
          // Calculate statistics
          this.calculateStats();
          
          // Save to IndexedDB for offline
          await this.saveToIndexedDB('disasters', this.disasters);
          
          // Update map markers if map is visible
          if (this.map && this.currentPage === 'map') {
            this.updateMapMarkers();
          }
        }
      } catch (error) {
        console.error('Failed to load disasters:', error);
        
        // Load from IndexedDB if offline
        if (!this.isOnline) {
          const cached = await this.getFromIndexedDB('disasters');
          if (cached) {
            this.disasters = cached;
            this.calculateStats();
          }
        }
      }
    },

    // Calculate statistics
    calculateStats() {
      this.stats = {
        banjir: this.disasters.filter(d => d.hazard === 'flood').length,
        gempa: this.disasters.filter(d => d.hazard === 'earthquake').length,
        longsor: this.disasters.filter(d => d.hazard === 'landslide').length,
        karhutla: this.disasters.filter(d => d.hazard === 'fire').length
      };
    },

    // Load evacuation points
    async loadEvacPoints() {
      try {
        // Try to load from BPBD API or use static data
        const response = await fetch('/data/bpbd.json');
        const data = await response.json();
        this.evacPoints = data.evacuation_points || [];
        
        await this.saveToIndexedDB('evacPoints', this.evacPoints);
      } catch (error) {
        console.error('Failed to load evac points:', error);
        
        // Use default data
        this.evacPoints = [
          {
            id: 1,
            name: 'Posko BPBD Jakarta Pusat',
            address: 'Jl. Letjen Suprapto, Cempaka Putih',
            phone: '021-4892828',
            capacity: 500,
            lat: -6.1751,
            lng: 106.8650
          },
          {
            id: 2,
            name: 'GOR Ciracas',
            address: 'Jl. Raya Bogor, Ciracas',
            phone: '021-8710537',
            capacity: 1000,
            lat: -6.3247,
            lng: 106.8753
          },
          {
            id: 3,
            name: 'Balai Warga Kelapa Gading',
            address: 'Kelapa Gading, Jakarta Utara',
            phone: '021-4585233',
            capacity: 300,
            lat: -6.1579,
            lng: 106.8991
          }
        ];
        
        await this.saveToIndexedDB('evacPoints', this.evacPoints);
      }
    },

    // Load notifications
    async loadNotifications() {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    },

    // Load my reports
    async loadMyReports() {
      const stored = localStorage.getItem('myReports');
      if (stored) {
        this.myReports = JSON.parse(stored);
      }
    },

    // Initialize Leaflet map
    initMap() {
      if (this.map) return;
      
      try {
        // Create map centered on Indonesia
        this.map = L.map('map').setView([-6.2088, 106.8456], 11);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18
        }).addTo(this.map);
        
        // Add markers
        this.updateMapMarkers();
        
        console.log('✅ Map initialized');
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    },

    // Update map markers
    updateMapMarkers() {
      if (!this.map) return;
      
      // Clear existing markers
      this.markers.forEach(marker => marker.remove());
      this.markers = [];
      
      // Add disaster markers
      this.disasters.forEach(disaster => {
        if (!disaster.coordinates) return;
        
        const [lng, lat] = disaster.coordinates;
        const color = this.getMarkerColor(disaster.hazard);
        
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [24, 24]
        });
        
        const marker = L.marker([lat, lng], { icon }).addTo(this.map);
        
        marker.bindPopup(`
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px; text-transform: capitalize;">${disaster.hazard}</h3>
            <p style="font-size: 14px; margin-bottom: 4px;">${disaster.description || 'Tidak ada deskripsi'}</p>
            <p style="font-size: 12px; color: #666;">${this.formatTime(disaster.created_at)}</p>
            ${disaster.water_depth ? `<p style="font-size: 12px; margin-top: 4px;"><strong>Kedalaman:</strong> ${disaster.water_depth} cm</p>` : ''}
          </div>
        `);
        
        this.markers.push(marker);
      });
      
      // Add evacuation point markers
      this.evacPoints.forEach(point => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">🏥</div>`,
          iconSize: [28, 28]
        });
        
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(this.map);
        
        marker.bindPopup(`
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${point.name}</h3>
            <p style="font-size: 14px; margin-bottom: 4px;">${point.address}</p>
            <p style="font-size: 12px;"><strong>📞</strong> ${point.phone}</p>
            <p style="font-size: 12px;"><strong>👥 Kapasitas:</strong> ${point.capacity} orang</p>
          </div>
        `);
        
        this.markers.push(marker);
      });
    },

    // Get marker color based on hazard type
    getMarkerColor(hazard) {
      const colors = {
        'flood': '#3b82f6',
        'banjir': '#3b82f6',
        'earthquake': '#ef4444',
        'gempa': '#ef4444',
        'landslide': '#f97316',
        'longsor': '#f97316',
        'fire': '#ca8a04',
        'karhutla': '#ca8a04',
        'default': '#6b7280'
      };
      return colors[hazard.toLowerCase()] || colors.default;
    },

    // Get disaster color for UI
    getDisasterColor(hazard) {
      const colors = {
        'flood': 'bg-blue-500',
        'banjir': 'bg-blue-500',
        'earthquake': 'bg-red-500',
        'gempa': 'bg-red-500',
        'landslide': 'bg-orange-500',
        'longsor': 'bg-orange-500',
        'fire': 'bg-yellow-600',
        'karhutla': 'bg-yellow-600'
      };
      return colors[hazard.toLowerCase()] || 'bg-gray-500';
    },

    // Get disaster icon
    getDisasterIcon(hazard) {
      const icons = {
        'flood': '🌊',
        'banjir': '🌊',
        'earthquake': '🌍',
        'gempa': '🌍',
        'landslide': '⛰️',
        'longsor': '⛰️',
        'fire': '🔥',
        'karhutla': '🔥'
      };
      return icons[hazard.toLowerCase()] || '⚠️';
    },

    // Format time
    formatTime(timestamp) {
      if (!timestamp) return 'Waktu tidak diketahui';
      
      const date = new Date(timestamp);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000); // seconds
      
      if (diff < 60) return 'Baru saja';
      if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
      if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
      
      return date.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // Request notification permission
    async requestNotificationPermission() {
      if (!('Notification' in window)) {
        alert('Browser Anda tidak mendukung notifikasi');
        return;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        alert('✅ Notifikasi berhasil diaktifkan!');
        
        // Initialize FCM token
        if (window.initializeFirebase) {
          window.initializeFirebase();
        }
      } else {
        alert('❌ Notifikasi ditolak. Anda tidak akan menerima peringatan bencana.');
      }
    },

    // Send status (Saya Aman / Butuh Bantuan)
    async sendStatus(type) {
      const status = {
        id: Date.now(),
        type: type,
        timestamp: new Date().toISOString(),
        lat: null,
        lng: null,
        synced: false
      };

      // Get current location
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          
          status.lat = position.coords.latitude;
          status.lng = position.coords.longitude;
        } catch (error) {
          console.error('Failed to get location:', error);
        }
      }

      // Save to IndexedDB for background sync
      await this.saveToIndexedDB('pendingStatus', [status]);

      // Try to send immediately if online
      if (this.isOnline) {
        try {
          await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(status)
          });
          status.synced = true;
          
          alert(type === 'aman' ? '✅ Status "Saya Aman" terkirim!' : '🆘 Permintaan bantuan terkirim!');
        } catch (error) {
          console.error('Failed to send status:', error);
          alert('⏳ Status disimpan dan akan dikirim saat online');
          
          // Register background sync
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-status');
          }
        }
      } else {
        alert('⏳ Anda offline. Status akan dikirim otomatis saat online kembali.');
      }
    },

    // Submit disaster report
    async submitReport() {
      if (!this.reportForm.description.trim()) {
        alert('Mohon isi deskripsi laporan');
        return;
      }

      const report = {
        id: Date.now(),
        hazard: this.reportForm.hazard,
        description: this.reportForm.description,
        timestamp: new Date().toISOString(),
        time: this.formatTime(new Date()),
        lat: null,
        lng: null,
        synced: false
      };

      // Get location
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          report.lat = position.coords.latitude;
          report.lng = position.coords.longitude;
        } catch (error) {
          console.error('Failed to get location:', error);
        }
      }

      // Add to my reports
      this.myReports.unshift(report);
      localStorage.setItem('myReports', JSON.stringify(this.myReports));

      // Save to IndexedDB for sync
      await this.saveToIndexedDB('pendingReports', [report]);

      // Try to send if online
      if (this.isOnline) {
        try {
          await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
          });
          
          report.synced = true;
          this.myReports[0].synced = true;
          localStorage.setItem('myReports', JSON.stringify(this.myReports));
          
          alert('✅ Laporan berhasil dikirim!');
        } catch (error) {
          alert('⏳ Laporan disimpan dan akan dikirim saat online');
          
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-report');
          }
        }
      } else {
        alert('⏳ Anda offline. Laporan akan dikirim otomatis saat online kembali.');
      }

      // Reset form
      this.reportForm.description = '';
    },

    // Sync pending data when back online
    async syncPendingData() {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-status');
        await registration.sync.register('sync-report');
      }
    },

 // IndexedDB operations
async saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WaspadakuDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create all stores if they don't exist
      const stores = ['pendingStatus', 'pendingReports', 'disasters', 'evacPoints'];
      stores.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
        }
      });
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      // Check if store exists
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn('Store not found:', storeName);
        resolve();
        return;
      }
      
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        if (Array.isArray(data)) {
          data.forEach(item => store.put(item));
        } else {
          store.put(data);
        }
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.error('Transaction error:', tx.error);
          resolve(); // Don't reject, just resolve
        };
      } catch (error) {
        console.error('IndexedDB error:', error);
        resolve(); // Don't reject
      }
    };
    
    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      resolve(); // Don't reject, just resolve
    };
  });
},

async getFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WaspadakuDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const stores = ['pendingStatus', 'pendingReports', 'disasters', 'evacPoints'];
      stores.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
        }
      });
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn('Store not found:', storeName);
        resolve([]);
        return;
      }
      
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
        getAllRequest.onerror = () => {
          console.error('Get error:', getAllRequest.error);
          resolve([]);
        };
      } catch (error) {
        console.error('IndexedDB get error:', error);
        resolve([]);
      }
    };
    
    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      resolve([]);
    };
  });
},