const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Veritabanı bağlantısı
const db = new sqlite3.Database(':memory:'); // Bellekte geçici veritabanı

// Kullanıcılar tablosu oluştur
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            status TEXT DEFAULT 'online',
            location TEXT,
            bio TEXT,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Sağlık verileri tablosu oluştur
    db.run(`
        CREATE TABLE IF NOT EXISTS health_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            heart_rate INTEGER,
            step_count INTEGER,
            calories INTEGER,
            sleep_quality INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);
    
    // Akıllı saat verileri tablosu oluştur
    db.run(`
        CREATE TABLE IF NOT EXISTS watch_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            watch_id TEXT,
            heart_rate INTEGER,
            step_count INTEGER,
            calories INTEGER,
            sleep_hours REAL,
            battery_level INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);
});

// Middleware
app.use(express.static(path.join(__dirname)));

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Kullanıcı paneli için endpoint
app.get('/user-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'user-panel.html'));
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);
    
    // Kullanıcı katıldığında
    socket.on('user-joined', (userData) => {
        console.log('Kullanıcı katıldı:', userData.name);
        
        // Kullanıcıyı veritabanına ekle veya güncelle
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO users (id, name, location, last_seen) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(userData.userId, userData.name, null);
        stmt.finalize();
        
        // Tüm kullanıcıları yeni bağlanan kullanıcıya gönder
        sendUsersUpdate();
    });
    
    // Kullanıcı panele bağlandığında
    socket.on('user-connected', (userData) => {
        console.log('Kullanıcı panele bağlandı:', userData.name);
        
        // Kullanıcıyı veritabanına ekle veya güncelle
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO users (id, name, email, status, location, bio, last_seen) 
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(
            userData.id, 
            userData.name, 
            userData.email || '', 
            userData.status || 'online', 
            userData.location || '', 
            userData.bio || ''
        );
        stmt.finalize();
        
        // Tüm kullanıcıları güncelle
        sendUsersUpdate();
    });
    
    // Konum paylaşıldığında
    socket.on('location-sharing', (data) => {
        console.log('Konum paylaşıldı:', data.userId);
        
        // Konum bilgisini veritabanında güncelle
        const stmt = db.prepare('UPDATE users SET location = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(JSON.stringify(data.location), data.userId);
        stmt.finalize();
        
        // Tüm kullanıcılara güncellenmiş listeyi gönder
        sendUsersUpdate();
    });
    
    // Kullanıcı güncellendiğinde
    socket.on('update-user', (userData) => {
        console.log('Kullanıcı güncellendi:', userData.name);
        
        // Kullanıcıyı veritabanında güncelle
        const stmt = db.prepare(`
            UPDATE users 
            SET name = ?, email = ?, status = ?, location = ?, bio = ?, last_seen = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        stmt.run(
            userData.name, 
            userData.email, 
            userData.status, 
            userData.location, 
            userData.bio, 
            userData.id
        );
        stmt.finalize();
        
        // Tüm kullanıcıları güncelle
        sendUsersUpdate();
    });
    
    // Kullanıcı ayrıldığında
    socket.on('user-left', (userId) => {
        console.log('Kullanıcı ayrıldı:', userId);
        
        // Kullanıcıyı veritabanından sil
        db.run('DELETE FROM users WHERE id = ?', userId);
        
        // Tüm kullanıcılara güncellenmiş listeyi gönder
        sendUsersUpdate();
    });
    
    // Kullanıcı çıkış yaptığında
    socket.on('user-logout', (userId) => {
        console.log('Kullanıcı çıkış yaptı:', userId);
        
        // Kullanıcı durumunu güncelle
        const stmt = db.prepare('UPDATE users SET status = "offline" WHERE id = ?');
        stmt.run(userId);
        stmt.finalize();
        
        // Tüm kullanıcıları güncelle
        sendUsersUpdate();
    });
    
    // Hesap silindiğinde
    socket.on('delete-account', (userId) => {
        console.log('Kullanıcı hesabını sildi:', userId);
        
        // Kullanıcıyı veritabanından sil
        db.run('DELETE FROM users WHERE id = ?', userId);
        
        // Tüm kullanıcıları güncelle
        sendUsersUpdate();
    });
    
    // Sağlık verileri alındığında
    socket.on('health-data', (healthData) => {
        console.log('Sağlık verisi alındı:', healthData.userId, 'Kalp atışı:', healthData.heartRate);
        
        // Sağlık verilerini veritabanına kaydet
        const stmt = db.prepare(`
            INSERT INTO health_data (user_id, heart_rate, step_count, calories, sleep_quality, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            healthData.userId,
            healthData.heartRate,
            healthData.stepCount,
            healthData.calories,
            healthData.sleepQuality,
            healthData.timestamp
        );
        stmt.finalize();
        
        // Sağlık uyarıları kontrol et
        checkHealthAlerts(healthData);
        
        // Tüm kullanıcılara sağlık güncellemesi gönder
        io.emit('health-update', {
            userId: healthData.userId,
            healthData: healthData
        });
    });
    
    // Akıllı saat senkronizasyonu
    socket.on('watch-sync', (watchData) => {
        console.log('Akıllı saat senkronizasyonu:', watchData.userId, 'Saat:', watchData.watchId);
        
        // Akıllı saat verilerini veritabanına kaydet
        const stmt = db.prepare(`
            INSERT INTO watch_data (user_id, watch_id, heart_rate, step_count, calories, sleep_hours, battery_level, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            watchData.userId,
            watchData.watchId,
            watchData.data.heartRate,
            watchData.data.stepCount,
            watchData.data.calories,
            watchData.data.sleepHours,
            watchData.data.battery,
            watchData.data.timestamp
        );
        stmt.finalize();
        
        // Sağlık verilerini de güncelle
        const healthStmt = db.prepare(`
            INSERT INTO health_data (user_id, heart_rate, step_count, calories, sleep_quality, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        healthStmt.run(
            watchData.userId,
            watchData.data.heartRate,
            watchData.data.stepCount,
            watchData.data.calories,
            Math.round(watchData.data.sleepHours * 10), // Uyku kalitesi olarak saat * 10
            watchData.data.timestamp
        );
        healthStmt.finalize();
        
        // Tüm kullanıcılara güncelleme gönder
        sendUsersUpdate();
        
        // Akıllı saat uyarıları kontrol et
        checkWatchAlerts(watchData);
    });
    
    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
        console.log('Kullanıcı bağlantısı kesildi:', socket.id);
    });
    
    // Tüm kullanıcıları istemcilere gönder
    function sendUsersUpdate() {
        db.all('SELECT id, name, email, status, location, bio, last_seen FROM users WHERE datetime(last_seen) > datetime("now", "-5 minutes")', (err, rows) => {
            if (err) {
                console.error('Veritabanı hatası:', err);
                return;
            }
            
            const users = {};
            rows.forEach(row => {
                users[row.id] = {
                    name: row.name,
                    email: row.email,
                    status: row.status,
                    location: row.location ? JSON.parse(row.location) : null,
                    bio: row.bio,
                    lastSeen: row.last_seen
                };
            });
            
            // Her kullanıcı için son sağlık verilerini al
            db.all('SELECT user_id, heart_rate, step_count, calories, sleep_quality, timestamp FROM health_data WHERE user_id IN (' + rows.map(() => '?').join(',') + ') ORDER BY timestamp DESC', rows.map(r => r.id), (err, healthRows) => {
                if (!err && healthRows) {
                    // Her kullanıcı için en son sağlık verisini al
                    const latestHealthData = {};
                    healthRows.forEach(healthRow => {
                        if (!latestHealthData[healthRow.user_id]) {
                            latestHealthData[healthRow.user_id] = {
                                heartRate: healthRow.heart_rate,
                                stepCount: healthRow.step_count,
                                calories: healthRow.calories,
                                sleepQuality: healthRow.sleep_quality,
                                timestamp: healthRow.timestamp
                            };
                        }
                    });
                    
                    // Sağlık verilerini kullanıcı bilgilerine ekle
                    Object.keys(users).forEach(userId => {
                        if (latestHealthData[userId]) {
                            users[userId].healthData = latestHealthData[userId];
                        }
                    });
                }
                
                io.emit('users-update', users);
            });
        });
    }
    
    // Sağlık uyarıları kontrol et
    function checkHealthAlerts(healthData) {
        const alerts = [];
        
        // Kalp atışı uyarıları
        if (healthData.heartRate < 50) {
            alerts.push({
                type: 'critical',
                message: `${healthData.userId} kullanıcısının kalp atışı çok düşük: ${healthData.heartRate} BPM`,
                userId: healthData.userId
            });
        } else if (healthData.heartRate > 120) {
            alerts.push({
                type: 'warning',
                message: `${healthData.userId} kullanıcısının kalp atışı yüksek: ${healthData.heartRate} BPM`,
                userId: healthData.userId
            });
        }
        
        // Adım sayısı uyarıları
        if (healthData.stepCount > 15000) {
            alerts.push({
                type: 'info',
                message: `${healthData.userId} kullanıcısı günlük hedefini aştı: ${healthData.stepCount} adım`,
                userId: healthData.userId
            });
        }
        
        // Uyarıları gönder
        alerts.forEach(alert => {
            io.emit('health-alert', alert);
            console.log('Sağlık uyarısı:', alert.message);
        });
    }
    
    // Akıllı saat uyarıları kontrol et
    function checkWatchAlerts(watchData) {
        const alerts = [];
        
        // Pil seviyesi uyarıları
        if (watchData.data.battery < 20) {
            alerts.push({
                type: 'warning',
                message: `${watchData.userId} kullanıcısının akıllı saati düşük pil: %${watchData.data.battery}`,
                userId: watchData.userId
            });
        }
        
        // Kalp atışı uyarıları
        if (watchData.data.heartRate < 50) {
            alerts.push({
                type: 'critical',
                message: `${watchData.userId} kullanıcısının kalp atışı çok düşük: ${watchData.data.heartRate} BPM`,
                userId: watchData.userId
            });
        } else if (watchData.data.heartRate > 120) {
            alerts.push({
                type: 'warning',
                message: `${watchData.userId} kullanıcısının kalp atışı yüksek: ${watchData.data.heartRate} BPM`,
                userId: watchData.userId
            });
        }
        
        // Uyku uyarıları
        if (watchData.data.sleepHours < 6) {
            alerts.push({
                type: 'warning',
                message: `${watchData.userId} kullanıcısı yetersiz uyku: ${watchData.data.sleepHours} saat`,
                userId: watchData.userId
            });
        }
        
        // Uyarıları gönder
        alerts.forEach(alert => {
            io.emit('watch-alert', alert);
            console.log('Akıllı saat uyarısı:', alert.message);
        });
    }
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
