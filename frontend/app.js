document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const iconLeft = document.querySelector('.toggle-icon.left');
    const iconRight = document.querySelector('.toggle-icon.right');
    
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    // Toggle Sidebar
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            iconLeft.style.display = 'none';
            iconRight.style.display = 'block';
        } else {
            iconLeft.style.display = 'block';
            iconRight.style.display = 'none';
        }
    });

    // Navigation Switch
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active to clicked nav item
            item.classList.add('active');

            // Hide all views
            views.forEach(view => {
                view.style.display = 'none';
                view.classList.remove('active');
            });

            // Show target view
            const targetId = item.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.style.display = 'block';
                // Small delay to allow display:block to apply before adding opacity/transition if needed
                setTimeout(() => {
                    targetView.classList.add('active');
                }, 10);
            }
        });
    });

    // ====================================================
    // 3D Model Mapping & Update Logic
    // ====================================================
    const bonesMap = {
        's9': 'pelvis',    // Pelvis (Pinggang/Bawah)
        's8': 'spine1',    // Lower Back (Bokong atas)
        's7': 'spine2',    // Mid Back (Punggung tengah)
        's5': 'chest',     // Chest (Punggung atas)
        's2': 'lShoulder', // Lengan Kiri
        's3': 'rShoulder'  // Lengan Kanan
    };

    function updateBoneFromSensor(sid, pitch, roll) {
        if (!window.mannequinBones) return;
        const boneName = bonesMap[sid];
        const bone = window.mannequinBones[boneName];
        if (!bone) return;

        const pRad = pitch * (Math.PI / 180);
        const rRad = roll * (Math.PI / 180);

        if (sid === 's2' || sid === 's3') {
            // Sensor 2 & 3 (Lengan): Lurus ke bawah = pitch 0, roll 0
            bone.rotation.x = rRad;  // Terbalik ke depan -> roll naik (+)
            bone.rotation.z = pRad;  // Putar ke kanan -> pitch naik (+)
        } else {
            // S5, S7, S8, S9: Punggung/Dada. 
            // Posisi awal tegak: pitch = -90, roll = 0
            const adjustedPitch = pitch + 90;
            const aPitchRad = adjustedPitch * (Math.PI / 180);

            bone.rotation.x = aPitchRad; // Gerakan membungkuk ke depan/belakang
            bone.rotation.z = rRad;      // Gerakan miring ke kanan/kiri
        }
    }

    // ====================================================
    // Direct MQTT Connection & Data Processing
    // ====================================================
    const mqttBadge = document.getElementById('mqtt-status');
    if (typeof mqtt !== 'undefined' && mqttBadge) {
        const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
        console.log('Connecting directly to MQTT Broker:', brokerUrl);
        
        const client = mqtt.connect(brokerUrl);

        client.on('connect', () => {
            console.log('Connected to MQTT Broker directly from frontend');
            mqttBadge.textContent = 'ONLINE';
            mqttBadge.className = 'badge badge-safe';
            
            const topics = [
                'UMJ/EV/WR', 'UMJ/EV/S1', 'UMJ/EV/S2', 
                'UMJ/EV/S3', 'UMJ/EV/S4', 'UMJ/EV/S5', 'UMJ/EV/S6'
            ];
            client.subscribe(topics, (err) => {
                if (!err) console.log('Subscribed to topics:', topics.join(', '));
            });
        });

        // Mapping dari Topic MQTT ke Internal ID
        const topicToInternalId = {
            'UMJ/EV/S1': 's2', // S1 = Sensor 2 Lengan Kiri
            'UMJ/EV/S2': 's3', // S2 = Sensor 3 Lengan Kanan
            'UMJ/EV/S3': 's5', // S3 = Sensor 5 Chest
            'UMJ/EV/S4': 's7', // S4 = Sensor 7 Mid Back
            'UMJ/EV/S5': 's8', // S5 = Sensor 8 Lower Back
            'UMJ/EV/S6': 's9'  // S6 = Sensor 9 Pelvis
        };

        client.on('message', (topic, message) => {
            const sid = topicToInternalId[topic];
            if (!sid) return; // Abaikan topik yang tidak dipetakan (contoh: WR)

            try {
                const payload = message.toString();
                const data = JSON.parse(payload);
                
                // Pastikan JSON memiliki properti pitch dan roll
                if (data.pitch !== undefined && data.roll !== undefined) {
                    const pitch = parseFloat(data.pitch);
                    const roll = parseFloat(data.roll);
                    updateBoneFromSensor(sid, pitch, roll);
                }
            } catch (err) {
                console.error(`Invalid JSON from ${topic}:`, message.toString());
            }
        });

        client.on('offline', () => {
            console.log('MQTT Client Offline');
            mqttBadge.textContent = 'OFFLINE';
            mqttBadge.className = 'badge badge-danger';
        });

        client.on('error', (err) => {
            console.error('MQTT Connection Error:', err.message);
            mqttBadge.textContent = 'OFFLINE';
            mqttBadge.className = 'badge badge-danger';
        });
    }
});
