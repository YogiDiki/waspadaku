// Admin Dashboard Alpine.js Application

function adminApp() {
  return {
    // Authentication
    isAuthenticated: false,
    currentUser: null,
    loginForm: {
      email: '',
      password: ''
    },

    // Navigation
    currentTab: 'broadcast',

    // Broadcast
    broadcastForm: {
      hazard: 'banjir',
      title: '',
      body: '',
      location: '',
      priority: 'high',
      emergency: 'false'
    },
    broadcastHistory: [],

    // Reports
    reports: [],
    reportFilter: 'all',

    // Evacuation Points
    evacPoints: [],
    evacForm: {
      name: '',
      type: 'Sport Hall',
      address: '',
      lat: -6.2088,
      lng: 106.8456,
      capacity: 100,
      phone: ''
    },

    // Statistics
    stats: {
      totalReports: 0,
      verifiedReports: 0,
      activeUsers: 0,
      evacPoints: 0,
      banjir: 0,
      gempa: 0,
      longsor: 0,
      karhutla: 0
    },

    // Users
    users: [],

    // Initialize
    init() {
      console.log('🔐 Admin Dashboard initialized');
      
      // Check if already logged in
      const savedAuth = localStorage.getItem('admin_auth');
      if (savedAuth) {
        try {
          const auth = JSON.parse(savedAuth);
          if (auth.email && auth.token) {
            this.isAuthenticated = true;
            this.currentUser = auth;
            this.loadDashboardData();
          }
        } catch (error) {
          console.error('Invalid auth data:', error);
          localStorage.removeItem('admin_auth');
        }
      }
    },

    // Login
    async login() {
      // Demo authentication - replace with real API
      if (this.loginForm.email === 'admin@waspadaku.id' && this.loginForm.password === 'admin123') {
        this.isAuthenticated = true;
        this.currentUser = {
          email: this.loginForm.email,
          token: 'demo-token-' + Date.now(),
          role: 'admin'
        };

        // Save to localStorage
        localStorage.setItem('admin_auth', JSON.stringify(this.currentUser));

        // Load dashboard data
        await this.loadDashboardData();

        alert('✅ Login berhasil!');
      } else {
        alert('❌ Email atau password salah!');
      }
    },

    // Logout
    logout() {
      if (confirm('Yakin ingin logout?')) {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('admin_auth');
        this.loginForm = { email: '', password: '' };
      }
    },

    // Load all dashboard data
    async loadDashboardData() {
      await Promise.all([
        this.loadBroadcastHistory(),
        this.loadReports(),
        this.loadEvacPoints(),
        this.loadUsers(),
        this.loadStatistics()
      ]);
    },

    // Send broadcast notification
    async sendBroadcast() {
      if (!this.broadcastForm.title || !this.broadcastForm.body) {
        alert('⚠️ Mohon isi semua field yang wajib');
        return;
      }

      const broadcast = {
        id: Date.now(),
        ...this.broadcastForm,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleString('id-ID'),
        recipients: this.users.filter(u => u.active).length,
        status: 'sent'
      };

      try {
        // Send to Firebase Cloud Messaging
        const response = await fetch('/api/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.currentUser.token}`
          },
          body: JSON.stringify(broadcast)
        });

        if (response.ok) {
          this.broadcastHistory.unshift(broadcast);
          alert('✅ Broadcast berhasil dikirim ke ' + broadcast.recipients + ' pengguna!');
          
          // Reset form
          this.broadcastForm.title = '';
          this.broadcastForm.body = '';
          this.broadcastForm.location = '';
        } else {
          throw new Error('Failed to send broadcast');
        }
      } catch (error) {
        console.error('Broadcast error:', error);
        
        // Demo mode - simulate success
        this.broadcastHistory.unshift(broadcast);
        alert('✅ [DEMO MODE] Broadcast tersimpan! Dalam production, akan dikirim ke ' + broadcast.recipients + ' pengguna.');
        
        this.broadcastForm.title = '';
        this.broadcastForm.body = '';
        this.broadcastForm.location = '';
      }

      // Save to localStorage
      localStorage.setItem('broadcastHistory', JSON.stringify(this.broadcastHistory));
    },

    // Test broadcast (send only to admin)
    async testBroadcast() {
      if (!this.broadcastForm.title || !this.broadcastForm.body) {
        alert('⚠️ Mohon isi semua field yang wajib');
        return;
      }

      alert('🧪 Test broadcast akan dikirim hanya ke perangkat Anda...');

      // In real implementation, this would use FCM to send to admin's device only
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(this.broadcastForm.title, {
          body: this.broadcastForm.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png'
        });
      }
    },

    // Load broadcast history
    async loadBroadcastHistory() {
      const saved = localStorage.getItem('broadcastHistory');
      if (saved) {
        this.broadcastHistory = JSON.parse(saved);
      } else {
        // Demo data
        this.broadcastHistory = [
          {
            id: 1,
            title: 'Peringatan Banjir Jakarta Utara',
            body: 'Waspadai banjir di wilayah Kelapa Gading dan sekitarnya',
            hazard: 'banjir',
            time: '2025-01-15 10:30',
            recipients: 1250,
            status: 'sent'
          },
          {
            id: 2,
            title: 'Info Gempa Banten',
            body: 'Gempa berkekuatan 5.2 SR terjadi di Banten, tidak berpotensi tsunami',
            hazard: 'gempa',
            time: '2025-01-14 15:20',
            recipients: 3400,
            status: 'sent'
          }
        ];
      }
    },

    // Load reports
    async loadReports() {
      // In production, fetch from API
      const demoReports = [
        {
          id: 1,
          hazard: 'banjir',
          description: 'Banjir setinggi 50cm di Jl. Kelapa Gading Boulevard',
          location: 'Kelapa Gading, Jakarta Utara',
          time: '2 jam lalu',
          verified: false
        },
        {
          id: 2,
          hazard: 'longsor',
          description: 'Tanah longsor menutupi jalan di Puncak',
          location: 'Puncak, Bogor',
          time: '5 jam lalu',
          verified: true
        },
        {
          id: 3,
          hazard: 'karhutla',
          description: 'Kebakaran lahan di area perkebunan',
          location: 'Cengkareng, Jakarta Barat',
          time: '1 hari lalu',
          verified: true
        }
      ];

      this.reports = demoReports;
    },

    // Verify report
    async verifyReport(reportId) {
      const report = this.reports.find(r => r.id === reportId);
      if (report) {
        report.verified = true;
        alert('✅ Laporan berhasil diverifikasi');
      }
    },

    // Delete report
    async deleteReport(reportId) {
      if (confirm('Yakin ingin menghapus laporan ini?')) {
        this.reports = this.reports.filter(r => r.id !== reportId);
        alert('✅ Laporan berhasil dihapus');
      }
    },

    // Load evacuation points
    async loadEvacPoints() {
      try {
        const response = await fetch('/data/bpbd.json');
        const data = await response.json();
        this.evacPoints = data.evacuation_points || [];
      } catch (error) {
        console.error('Failed to load evac points:', error);
        this.evacPoints = [];
      }
    },

    // Add evacuation point
    async addEvacPoint() {
      const newPoint = {
        id: Date.now(),
        ...this.evacForm,
        status: 'active',
        facilities: ['toilet', 'kitchen']
      };

      this.evacPoints.push(newPoint);
      
      alert('✅ Titik evakuasi berhasil ditambahkan!');
      
      // Reset form
      this.evacForm = {
        name: '',
        type: 'Sport Hall',
        address: '',
        lat: -6.2088,
        lng: 106.8456,
        capacity: 100,
        phone: ''
      };

      // In production, save to backend
      // await fetch('/api/evacuation-points', { method: 'POST', body: JSON.stringify(newPoint) });
    },

    // Delete evacuation point
    async deleteEvacPoint(pointId) {
      if (confirm('Yakin ingin menghapus titik evakuasi ini?')) {
        this.evacPoints = this.evacPoints.filter(p => p.id !== pointId);
        alert('✅ Titik evakuasi berhasil dihapus');
      }
    },

    // Load statistics
    async loadStatistics() {
      // Calculate from existing data
      this.stats.totalReports = this.reports.length;
      this.stats.verifiedReports = this.reports.filter(r => r.verified).length;
      this.stats.activeUsers = this.users.filter(u => u.active).length;
      this.stats.evacPoints = this.evacPoints.length;
      
      this.stats.banjir = this.reports.filter(r => r.hazard === 'banjir').length;
      this.stats.gempa = this.reports.filter(r => r.hazard === 'gempa').length;
      this.stats.longsor = this.reports.filter(r => r.hazard === 'longsor').length;
      this.stats.karhutla = this.reports.filter(r => r.hazard === 'karhutla').length;

      // In production, fetch real stats from API
      // const response = await fetch('/api/statistics');
      // this.stats = await response.json();
    },

    // Load users
    async loadUsers() {
      // Demo users data
      this.users = [
        {
          id: 1,
          fcm_token: 'fcm_token_abc123xyz789...',
          registered: '2025-01-10',
          active: true
        },
        {
          id: 2,
          fcm_token: 'fcm_token_def456uvw012...',
          registered: '2025-01-12',
          active: true
        },
        {
          id: 3,
          fcm_token: 'fcm_token_ghi789rst345...',
          registered: '2025-01-14',
          active: false
        }
      ];

      // In production, fetch from API
      // const response = await fetch('/api/users');
      // this.users = await response.json();
    },

    // Delete user
    async deleteUser(userId) {
      if (confirm('Yakin ingin menghapus user ini?')) {
        this.users = this.users.filter(u => u.id !== userId);
        alert('✅ User berhasil dihapus');
        
        // Update stats
        this.stats.activeUsers = this.users.filter(u => u.active).length;
      }
    },

    // Computed properties
    get filteredReports() {
      if (this.reportFilter === 'all') {
        return this.reports;
      }
      return this.reports.filter(r => r.hazard === this.reportFilter);
    },

    // Helper methods
    getHazardClass(hazard) {
      const classes = {
        'banjir': 'bg-blue-100 text-blue-800',
        'gempa': 'bg-red-100 text-red-800',
        'longsor': 'bg-orange-100 text-orange-800',
        'karhutla': 'bg-yellow-100 text-yellow-800'
      };
      return classes[hazard] || 'bg-gray-100 text-gray-800';
    }
  };
}

// Auto-refresh dashboard data every 5 minutes
setInterval(() => {
  const alpineInstance = document.querySelector('[x-data]').__x;
  if (alpineInstance && alpineInstance.$data.isAuthenticated) {
    alpineInstance.$data.loadReports();
    alpineInstance.$data.loadStatistics();
  }
}, 300000);