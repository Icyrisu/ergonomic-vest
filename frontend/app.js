document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const iconLeft = document.querySelector('.toggle-icon.left');
    const iconRight = document.querySelector('.toggle-icon.right');
    
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    // Toggle Sidebar
    if (toggleBtn) {
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
    }

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        }
    });

    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            
            navItems.forEach(nav => nav.classList.remove('active'));
            
            
            item.classList.add('active');

            
            views.forEach(view => {
                view.style.display = 'none';
                view.classList.remove('active');
            });

            
            const targetId = item.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.style.display = 'block';
                
                setTimeout(() => {
                    targetView.classList.add('active');
                }, 10);
                
                if (targetId === 'history-view') {
                    fetchHistoryData();
                }
            }
        });
    });
    
    // Fetch History Data from Backend API
    function fetchHistoryData() {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;
        
        // Ensure we handle local and remote host gracefully
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api/history' 
            : '/api/history';
            
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No data available yet</td></tr>';
                    return;
                }
                
                tbody.innerHTML = '';
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    // Format timestamp
                    const date = new Date(row.created_at);
                    const formattedDate = date.toLocaleString('en-GB');
                    
                    // Format badge
                    let badgeClass = 'badge-safe';
                    if (row.status === 'Warning') badgeClass = 'badge-warning';
                    if (row.status === 'Danger') badgeClass = 'badge-danger';
                    
                    tr.innerHTML = `
                        <td>${formattedDate}</td>
                        <td>${row.topic}</td>
                        <td>${row.roll}&deg;</td>
                        <td>${row.pitch}&deg;</td>
                        <td><span class="badge ${badgeClass}">${row.status}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error fetching history:', err);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Failed to load data</td></tr>';
            });
    }

    // ====================================================
    // 3D Model Mapping & Update Logic
    // ====================================================
    const bonesMap = {
        's9': 'pelvis',    // Pelvis
        's8': 'spine1',    // Lower Back
        's7': 'spine2',    // Mid Back
        's5': 'chest',     // Chest
        's2': 'lShoulder', // Left Arm
        's3': 'rShoulder'  // Right Arm
    };

    function updateBoneFromSensor(sid, pitch, roll) {
        if (!window.mannequinBones) return;
        const boneName = bonesMap[sid];
        const bone = window.mannequinBones[boneName];
        if (!bone) return;

        // Update Real-time Angles UI
        const uiLabel = document.getElementById(`val-${sid}`);
        if (uiLabel) {
            uiLabel.innerHTML = `P:${pitch.toFixed(1)}&deg; R:${roll.toFixed(1)}&deg;`;
        }

        const pRad = pitch * (Math.PI / 180);
        const rRad = roll * (Math.PI / 180);

        if (sid === 's2' || sid === 's3') {
            // Sensor 2 & 3 (Arms): Default straight down = pitch 0, roll 0
            bone.rotation.x = rRad;  // Forward -> roll increases (+)
            bone.rotation.z = pRad;  // Right turn -> pitch increases (+)
        } else {
            // S5, S7, S8, S9: Back/Chest. 
            // Initial upright position: pitch = -90, roll = 0
            const adjustedPitch = pitch + 90;
            const aPitchRad = adjustedPitch * (Math.PI / 180);

            bone.rotation.x = aPitchRad; // Forward/backward bending
            bone.rotation.z = rRad;      // Left/right tilting
        }
    }

    // ====================================================
    // Real-time Data via Socket.io (Backend Proxy)
    // ====================================================
    const mqttBadge = document.getElementById('mqtt-status');
    if (typeof io !== 'undefined') {
        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000' 
            : window.location.origin;
            
        const socket = io(socketUrl);

        socket.on('connect', () => {
            console.log('Connected to Backend via Socket.io');
            if (mqttBadge) {
                mqttBadge.textContent = 'ONLINE';
                mqttBadge.className = 'badge badge-safe';
            }
        });

        // MQTT Topic to Internal ID mapping
        const topicToInternalId = {
            'UMJ/EV/S1': 's2', // S1 = Sensor 2 Left Arm
            'UMJ/EV/S2': 's3', // S2 = Sensor 3 Right Arm
            'UMJ/EV/S3': 's5', // S3 = Sensor 5 Chest
            'UMJ/EV/S4': 's7', // S4 = Sensor 7 Mid Back
            'UMJ/EV/S5': 's8', // S5 = Sensor 8 Lower Back
            'UMJ/EV/S6': 's9'  // S6 = Sensor 9 Pelvis
        };

        socket.on('sensor_data', (data) => {
            const sid = topicToInternalId[data.topic];
            if (!sid) return;
            updateBoneFromSensor(sid, data.pitch, data.roll);
        });

        socket.on('wrench_status', (isOn) => {
            if (window.updateWrenchState) {
                window.updateWrenchState(isOn);
            }
        });

        // Wrench Buttons Control
        const btnWrenchOn = document.getElementById('btn-wrench-on');
        const btnWrenchOff = document.getElementById('btn-wrench-off');

        if (btnWrenchOn) {
            btnWrenchOn.addEventListener('click', () => {
                socket.emit('wrench_control', { value: 'ON' });
            });
        }

        if (btnWrenchOff) {
            btnWrenchOff.addEventListener('click', () => {
                socket.emit('wrench_control', { value: 'OFF' });
            });
        }

        socket.on('disconnect', () => {
            console.log('Socket.io Disconnected');
            if (mqttBadge) {
                mqttBadge.textContent = 'OFFLINE';
                mqttBadge.className = 'badge badge-danger';
            }
        });
        
        socket.on('connect_error', (err) => {
            console.error('Socket.io Connection Error:', err.message);
            if (mqttBadge) {
                mqttBadge.textContent = 'OFFLINE';
                mqttBadge.className = 'badge badge-danger';
            }
        });
    }
});
