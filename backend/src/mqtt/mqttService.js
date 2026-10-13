const mqtt = require('mqtt');
const env = require('../config/env');
const logger = require('../utils/logger');

let isConnected = false;
let currentWrenchStatus = 'OFF';
let latestSensorData = {};
let ioInstance = null;
let client = null;

let activeTolerance = 10;
let activeNeutralPoses = {
    'UMJ/EV/S1': [0, 10],
    'UMJ/EV/S2': [-20, 20],
    'UMJ/EV/S3': [-20, 20],
    'UMJ/EV/S4': [0, 20],
    'UMJ/EV/S5': [-10, 10],
    'UMJ/EV/S6': [-10, 10],
};
// Konfigurasi manipulasi internal data sensor S5 & S6 (Web Level):
// Karena sensor fisik S5 dan S6 belum siap dan program ESP32 tidak diubah,
// data S5 disintesis dari S1 dan data S6 disintesis dari S4 dengan selisih beberapa derajat.
const S5_SYNTH_OFFSET = parseFloat(process.env.S5_SYNTH_OFFSET ?? '-5.0'); // S5 (Mid Back) offset dari S1 (Neck)
const S6_SYNTH_OFFSET = parseFloat(process.env.S6_SYNTH_OFFSET ?? '-5.0'); // S6 (Pelvis) offset dari S4 (Upper Back)

const evaluateAndEmitSensor = (sensorTopic, sensorPitch) => {
    let status = 'Neutral Pose';
    const bounds = activeNeutralPoses[sensorTopic];
    
    let baseline = -90;
    if (sensorTopic === 'UMJ/EV/S2' || sensorTopic === 'UMJ/EV/S3') {
        baseline = 0;
    }
    
    const relativePitch = sensorPitch - baseline;
    const tolerance = typeof activeTolerance === 'number' ? activeTolerance : 10;

    if (bounds && bounds.length === 2) {
        const min = bounds[0];
        const max = bounds[1];
        
        if (relativePitch >= min && relativePitch <= max) {
            status = 'Neutral Pose';
        } else if (relativePitch >= (min - tolerance) && relativePitch <= (max + tolerance)) {
            status = 'Working Pose';
        } else {
            status = 'Bad Pose';
        }
    }
    
    latestSensorData[sensorTopic] = { pitch: sensorPitch, status };
    
    if (ioInstance) {
        ioInstance.emit('sensor_data', { topic: sensorTopic, pitch: sensorPitch, status });
    }
};

let diagnosticStats = {
    connected: false,
    brokerUrl: env.MQTT_BROKER,
    connectTime: null,
    disconnectTime: null,
    totalMessagesReceived: 0,
    lastMessageTime: null,
    lastTopic: null,
    lastPayload: null,
    lastError: null,
    subscribedTopics: []
};

const mqttService = {
    setActiveSessionNeutralPoses(poses) {
        if (poses) {
            if (poses.tolerance !== undefined) {
                activeTolerance = poses.tolerance;
            } else {
                activeTolerance = 10;
            }
            activeNeutralPoses = poses;
        }
    },

    init(io) {
        ioInstance = io;
        logger.info(`[MQTT] Connecting to broker: ${env.MQTT_BROKER}`);
        client = mqtt.connect(env.MQTT_BROKER, {
            reconnectPeriod: 2000,
            connectTimeout: 10000,
        });

        client.on('connect', () => {
            logger.info(`[MQTT] Successfully connected to broker: ${env.MQTT_BROKER}`);
            isConnected = true;
            diagnosticStats.connected = true;
            diagnosticStats.connectTime = new Date().toISOString();
            diagnosticStats.lastError = null;

            if (ioInstance) {
                ioInstance.emit('mqtt_status', { connected: true, broker: env.MQTT_BROKER });
            }
            
            const topics = [
                'UMJ/EV/#',
                'UMJ/EV/WR', 'UMJ/EV/S1', 'UMJ/EV/S2', 
                'UMJ/EV/S3', 'UMJ/EV/S4', 'UMJ/EV/S5', 'UMJ/EV/S6',
                'UMJ/EV/RESP'
            ];
            diagnosticStats.subscribedTopics = topics;
            
            topics.forEach(t => {
                client.subscribe(t, (err) => {
                    if (err) logger.error(`[MQTT] Failed to subscribe to ${t}:`, err.message);
                    else logger.info(`[MQTT] Subscribed to topic: ${t}`);
                });
            });
        });

        client.on('message', (topic, message) => {
            const rawStr = message.toString().trim();
            diagnosticStats.totalMessagesReceived++;
            diagnosticStats.lastMessageTime = new Date().toISOString();
            diagnosticStats.lastTopic = topic;
            diagnosticStats.lastPayload = rawStr;

            // Log setiap pesan masuk agar langsung terlihat di `docker logs -f ev-backend`
            logger.info(`[MQTT RX] Topic: ${topic} | Payload: ${rawStr}`);

            // Normalisasi topik ke UPPERCASE agar tahan beda huruf besar/kecil
            const normTopic = topic.toUpperCase();

            try {
                let payload = null;
                try {
                    payload = JSON.parse(rawStr);
                } catch (jsonErr) {
                    // Jika payload dikirim sebagai angka mentah (contoh: "-89.82")
                    const rawNum = parseFloat(rawStr);
                    if (!isNaN(rawNum)) {
                        payload = { pitch: rawNum };
                    }
                }

                if (!payload) {
                    logger.warn(`[MQTT] Cannot parse message on ${topic}: "${rawStr}"`);
                    return;
                }
                
                if (normTopic === 'UMJ/EV/RESP') {
                    logger.info(`[MQTT] Hardware response on UMJ/EV/RESP: ${rawStr}`);
                    if (ioInstance) {
                        ioInstance.emit('tare_ack', payload);
                    }
                    return;
                }

                if (normTopic === 'UMJ/EV/WR') {
                    const wrenchVal = payload.value || (rawStr.toUpperCase() === 'ON' ? 'ON' : rawStr.toUpperCase() === 'OFF' ? 'OFF' : null);
                    if (wrenchVal) {
                        currentWrenchStatus = wrenchVal;
                        if (ioInstance) {
                            ioInstance.emit('wrench_status', currentWrenchStatus === 'ON');
                        }
                    }
                    return;
                }
                
                // Ambil nilai sudut (bisa berformat .pitch, .p, .angle, atau .val)
                const pitchRaw = payload.pitch !== undefined ? payload.pitch : 
                                 (payload.p !== undefined ? payload.p : 
                                 (payload.angle !== undefined ? payload.angle : payload.val));

                if (pitchRaw !== undefined) {
                    const pitch = parseFloat(pitchRaw);

                    // 1. Evaluasi & pancarkan data sensor fisik dari MQTT
                    // (Abaikan payload fisik S5 & S6 dari broker agar tidak flicker/bertabrakan dengan manipulasi)
                    if (normTopic !== 'UMJ/EV/S5' && normTopic !== 'UMJ/EV/S6') {
                        evaluateAndEmitSensor(normTopic, pitch);
                    }

                    // 2. Manipulasi internal data S5 & S6 di sisi web backend
                    //    (ESP32 tidak perlu diubah, cukup kirim S1 dan S4 saja)
                    if (normTopic === 'UMJ/EV/S1') {
                        const s5Pitch = parseFloat((pitch + S5_SYNTH_OFFSET).toFixed(2));
                        evaluateAndEmitSensor('UMJ/EV/S5', s5Pitch);
                    } else if (normTopic === 'UMJ/EV/S4') {
                        const s6Pitch = parseFloat((pitch + S6_SYNTH_OFFSET).toFixed(2));
                        evaluateAndEmitSensor('UMJ/EV/S6', s6Pitch);
                    }
                } else {
                    logger.warn(`[MQTT] Topic ${topic} received without numeric pitch field: ${rawStr}`);
                }
            } catch (err) {
                logger.error(`[MQTT Error] Error parsing topic ${topic}: ${err.message}`);
            }
        });

        client.on('offline', () => {
            logger.warn('[MQTT] Client Offline (Disconnected from Broker)');
            isConnected = false;
            diagnosticStats.connected = false;
            diagnosticStats.disconnectTime = new Date().toISOString();
            if (ioInstance) {
                ioInstance.emit('mqtt_status', { connected: false, broker: env.MQTT_BROKER });
            }
        });

        client.on('error', (err) => {
            logger.error(`[MQTT] Connection Error: ${err.message}`);
            isConnected = false;
            diagnosticStats.connected = false;
            diagnosticStats.lastError = err.message;
            if (ioInstance) {
                ioInstance.emit('mqtt_status', { connected: false, error: err.message, broker: env.MQTT_BROKER });
            }
        });
    },

    getStatus() {
        return isConnected;
    },

    getDiagnosticStats() {
        return {
            ...diagnosticStats,
            connected: isConnected,
            brokerUrl: env.MQTT_BROKER,
            wrenchStatus: currentWrenchStatus
        };
    },

    getWrenchStatus() {
        return currentWrenchStatus;
    },

    getLatestSensorData() {
        return latestSensorData;
    },

    publishWrench(value) {
        if (isConnected && client) {
            currentWrenchStatus = value;
            client.publish('UMJ/EV/WR', JSON.stringify({ value: value }));
        }
    },

    publishCommand(cmd, extra = {}) {
        if (isConnected && client) {
            const payload = JSON.stringify({ command: cmd, timestamp: Date.now(), ...extra });
            client.publish('UMJ/EV/CMD', payload);
            logger.info(`Published command to UMJ/EV/CMD: ${payload}`);
        }
    }
};

module.exports = mqttService;
