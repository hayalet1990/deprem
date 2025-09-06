document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const shareLocationBtn = document.getElementById('share-location-btn');
    const locationStatus = document.getElementById('location-status');
    const usersList = document.getElementById('users-list');
    const mapElement = document.getElementById('map');
    const showLocationDetailsBtn = document.getElementById('show-location-details');
    
    let userLocation = null;
    let userMarker = null;
    let map = null;
    let otherMarkers = {};
    
    // Kullanıcı kimliği oluştur
    const userId = generateUserId();
    
    // Haritayı başlat
    function initMap(lat, lng) {
        map = L.map('map').setView([lat, lng], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Kullanıcının konumunu işaretle
        userMarker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup('Siz buradasınız')
            .openPopup();
    }
    
    // Rastgele kullanıcı ID'si oluştur
    function generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Konum paylaşma butonu işlevi
    shareLocationBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            locationStatus.textContent = 'Yüksek hassasiyetli konumunuz alınıyor...';
            locationStatus.style.backgroundColor = '#f39c12';
            locationStatus.style.color = 'white';
            
            // Yüksek hassasiyetli konum alma seçenekleri
            const options = {
                enableHighAccuracy: true,    // Yüksek hassasiyet
                timeout: 10000,              // 10 saniye timeout
                maximumAge: 0                // Cache'lenmiş konumu kullanma
            };
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const altitude = position.coords.altitude; // Yükseklik (metre)
                    const accuracy = position.coords.accuracy; // Hassasiyet (metre)
                    const altitudeAccuracy = position.coords.altitudeAccuracy; // Yükseklik hassasiyeti
                    const heading = position.coords.heading; // Yön (derece)
                    const speed = position.coords.speed; // Hız (m/s)
                    const timestamp = position.timestamp; // Zaman damgası
                    
                    // Detaylı konum bilgisi
                    userLocation = { 
                        lat, 
                        lng, 
                        altitude: altitude || null,
                        accuracy,
                        altitudeAccuracy: altitudeAccuracy || null,
                        heading: heading || null,
                        speed: speed || null,
                        timestamp
                    };
                    
                    // Haritayı başlat (eğer başlatılmadıysa)
                    if (!map) {
                        initMap(lat, lng);
                    } else {
                        // Harita görünümünü güncelle
                        map.setView([lat, lng], 15); // Daha yakın zoom
                        // Marker'ı güncelle
                        userMarker.setLatLng([lat, lng]);
                    }
                    
                    // Konum bilgilerini göster
                    const locationInfo = `
                        Enlem: ${lat.toFixed(8)}°<br>
                        Boylam: ${lng.toFixed(8)}°<br>
                        ${altitude ? `Yükseklik: ${altitude.toFixed(2)} m<br>` : ''}
                        Hassasiyet: ±${accuracy.toFixed(1)} m<br>
                        ${altitudeAccuracy ? `Yükseklik Hassasiyeti: ±${altitudeAccuracy.toFixed(1)} m<br>` : ''}
                        ${heading ? `Yön: ${heading.toFixed(1)}°<br>` : ''}
                        ${speed ? `Hız: ${(speed * 3.6).toFixed(1)} km/h<br>` : ''}
                    `;
                    
                    userMarker.bindPopup(`
                        <strong>Siz buradasınız</strong><br>
                        ${locationInfo}
                    `).openPopup();
                    
                    // Sunucuya konum bilgisini gönder
                    socket.emit('location-sharing', {
                        userId: userId,
                        location: userLocation
                    });
                    
                    locationStatus.innerHTML = `
                        <strong>Konumunuz paylaşıldı!</strong><br>
                        Hassasiyet: ±${accuracy.toFixed(1)} metre<br>
                        ${altitude ? `Yükseklik: ${altitude.toFixed(1)} metre` : ''}
                    `;
                    locationStatus.style.backgroundColor = '#2ecc71';
                    locationStatus.style.color = 'white';
                    
                    // Detay butonunu göster
                    showLocationDetailsBtn.style.display = 'block';
                },
                function(error) {
                    console.error('Konum alınamadı:', error);
                    let errorMessage = 'Konum alınamadı. ';
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Konum izni reddedildi.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Konum bilgisi mevcut değil.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Konum alma zaman aşımına uğradı.';
                            break;
                        default:
                            errorMessage += 'Bilinmeyen hata.';
                            break;
                    }
                    
                    locationStatus.textContent = errorMessage;
                    locationStatus.style.backgroundColor = '#e74c3c';
                    locationStatus.style.color = 'white';
                },
                options
            );
        } else {
            locationStatus.textContent = 'Tarayıcınız konum özelliğini desteklemiyor.';
            locationStatus.style.backgroundColor = '#e74c3c';
            locationStatus.style.color = 'white';
        }
    });
    
    // Sunucudan gelen kullanıcı listesini işle
    socket.on('users-update', function(users) {
        usersList.innerHTML = '';
        
        Object.keys(users).forEach(id => {
            if (id !== userId) {
                const user = users[id];
                const li = document.createElement('li');
                
                const avatar = document.createElement('div');
                avatar.className = 'user-avatar';
                avatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'K';
                
                const userInfo = document.createElement('div');
                userInfo.textContent = user.name || 'Kullanıcı';
                
                li.appendChild(avatar);
                li.appendChild(userInfo);
                usersList.appendChild(li);
                
                // Diğer kullanıcıların konumlarını haritada göster
                if (user.location && map) {
                    const location = user.location;
                    const popupContent = `
                        <strong>${user.name || 'Kullanıcı'}</strong><br>
                        Enlem: ${location.lat.toFixed(8)}°<br>
                        Boylam: ${location.lng.toFixed(8)}°<br>
                        ${location.altitude ? `Yükseklik: ${location.altitude.toFixed(2)} m<br>` : ''}
                        ${location.accuracy ? `Hassasiyet: ±${location.accuracy.toFixed(1)} m<br>` : ''}
                        ${location.altitudeAccuracy ? `Yükseklik Hassasiyeti: ±${location.altitudeAccuracy.toFixed(1)} m<br>` : ''}
                        ${location.heading ? `Yön: ${location.heading.toFixed(1)}°<br>` : ''}
                        ${location.speed ? `Hız: ${(location.speed * 3.6).toFixed(1)} km/h<br>` : ''}
                        ${location.timestamp ? `Zaman: ${new Date(location.timestamp).toLocaleString('tr-TR')}` : ''}
                    `;
                    
                    if (otherMarkers[id]) {
                        otherMarkers[id].setLatLng([location.lat, location.lng]);
                        otherMarkers[id].bindPopup(popupContent);
                    } else {
                        otherMarkers[id] = L.marker([location.lat, location.lng])
                            .addTo(map)
                            .bindPopup(popupContent);
                    }
                }
            }
        });
    });
    
    // Kullanıcı adı iste
    const userName = prompt('Lütfen kullanıcı adınızı girin:') || 'Kullanıcı';
    socket.emit('user-joined', { userId, name: userName });
    
    // Konum detaylarını göster butonu
    showLocationDetailsBtn.addEventListener('click', function() {
        if (!userLocation) {
            alert('Henüz konum bilginiz yok. Önce konumunuzu paylaşın.');
            return;
        }
        
        const details = `
            <strong>Detaylı Konum Bilgileriniz</strong><br><br>
            <strong>Koordinatlar:</strong><br>
            Enlem: ${userLocation.lat.toFixed(8)}°<br>
            Boylam: ${userLocation.lng.toFixed(8)}°<br><br>
            
            ${userLocation.altitude ? `<strong>Yükseklik:</strong> ${userLocation.altitude.toFixed(2)} metre<br><br>` : ''}
            
            <strong>Hassasiyet:</strong><br>
            Konum Hassasiyeti: ±${userLocation.accuracy.toFixed(1)} metre<br>
            ${userLocation.altitudeAccuracy ? `Yükseklik Hassasiyeti: ±${userLocation.altitudeAccuracy.toFixed(1)} metre<br>` : ''}<br>
            
            ${userLocation.heading ? `<strong>Yön:</strong> ${userLocation.heading.toFixed(1)}°<br><br>` : ''}
            ${userLocation.speed ? `<strong>Hız:</strong> ${(userLocation.speed * 3.6).toFixed(1)} km/h<br><br>` : ''}
            
            <strong>Zaman:</strong><br>
            ${new Date(userLocation.timestamp).toLocaleString('tr-TR')}
        `;
        
        alert(details);
    });
    
    // Sağlık verilerini güncelle
    socket.on('health-update', function(data) {
        if (data.userId === userId) {
            // Kendi sağlık verilerimizi güncelle
            document.getElementById('quick-heart-rate').textContent = data.healthData.heartRate + ' BPM';
            document.getElementById('quick-step-count').textContent = data.healthData.stepCount.toLocaleString();
            document.getElementById('quick-calories').textContent = data.healthData.calories + ' kcal';
        }
    });
    
    // Sağlık uyarıları
    socket.on('health-alert', function(alert) {
        if (alert.userId === userId) {
            // Kendi uyarılarımızı göster
            const alertDiv = document.createElement('div');
            alertDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: ${alert.type === 'critical' ? '#e74c3c' : alert.type === 'warning' ? '#f39c12' : '#3498db'};
                color: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                max-width: 300px;
            `;
            alertDiv.innerHTML = `
                <strong>Sağlık Uyarısı</strong><br>
                ${alert.message}
                <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
            `;
            document.body.appendChild(alertDiv);
            
            // 5 saniye sonra otomatik kaldır
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    });
    
    // Sayfa kapatıldığında sunucuya bildir
    window.addEventListener('beforeunload', function() {
        socket.emit('user-left', userId);
    });
});
