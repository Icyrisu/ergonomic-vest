const mqtt = require('mqtt');
const env = require('../config/env');
const logger = require('../utils/logger');

let isConnected = false;
let currentWrenchStatus = 'OFF';
let latestSensorData = {};
let ioInstance = null;
let client = null;

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
const S5_SYNTH_OFFSET = 3.0; // S5 (Mid Back) beda +3.0 deg dari S1 (Neck)
const S6_SYNTH_OFFSET = 4.5; // S6 (Pelvis) beda +4.5 deg dari S4 (Upper Back)

const evaluateAndEmitSensor = (sensorTopic, sensorPitch) => {
    let status = 'Neutral Pose';
    const bounds = activeNeutralPoses[sensorTopic];
    
    let baseline = -90;
    if (sensorTopic === 'UMJ/EV/S2' || sensorTopic === 'UMJ/EV/S3') {
        baseline = 0;
    }
    
    const relativePitch = sensorPitch - baseline;

    if (bounds && bounds.length === 2) {
        const min = bounds[0];
        const max = bounds[1];
        
        if (relativePitch >= min && relativePitch <= max) {
            status = 'Neutral Pose';
        } else if (relativePitch >= (min - activeTolerance) && relativePitch <= (max + activeTolerance)) {
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
        logger.info(`Starting MQTT Client connecting to: ${env.MQTT_BROKER}`);
        client = mqtt.connect(env.MQTT_BROKER);

        client.on('connect', () => {
            logger.info(`Connected to MQTT Broker: ${env.MQTT_BROKER}`);
            isConnected = true;
            
            const topics = [
                'UMJ/EV/WR', 'UMJ/EV/S1', 'UMJ/EV/S2', 
                'UMJ/EV/S3', 'UMJ/EV/S4', 'UMJ/EV/S5', 'UMJ/EV/S6',
                'UMJ/EV/RESP'
            ];
            
            topics.forEach(t => {
                client.subscribe(t, (err) => {
                    if (err) logger.error(`Failed to subscribe to ${t}:`, err.message);
                    else logger.info(`Subscribed to ${t}`);
                });
            });
        });

        client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                
                if (topic === 'UMJ/EV/RESP') {
                    logger.info(`Received hardware response on UMJ/EV/RESP: ${message.toString()}`);
                    if (ioInstance) {
                        ioInstance.emit('tare_ack', payload);
                    }
                    return;
                }

                if (topic === 'UMJ/EV/WR' && payload.value) {
                    currentWrenchStatus = payload.value;
                    if (ioInstance) {
                        ioInstance.emit('wrench_status', currentWrenchStatus === 'ON');
                    }
                    return;
                }
                
                if (payload.pitch !== undefined) {
                    const pitch = parseFloat(payload.pitch);

                    // 1. Evaluasi & pancarkan data sensor fisik yang diterima dari MQTT
                    evaluateAndEmitSensor(topic, pitch);

                    // 2. Manipulasi internal data S5 & S6 di sisi web backend
                    //    (ESP32 tidak perlu diubah, cukup kirim S1 dan S4 saja)
                    if (topic === 'UMJ/EV/S1') {
                        const s5Pitch = parseFloat((pitch + S5_SYNTH_OFFSET).toFixed(2));
                        evaluateAndEmitSensor('UMJ/EV/S5', s5Pitch);
                    } else if (topic === 'UMJ/EV/S4') {
                        const s6Pitch = parseFloat((pitch + S6_SYNTH_OFFSET).toFixed(2));
                        evaluateAndEmitSensor('UMJ/EV/S6', s6Pitch);
                    }
                }
            } catch (err) {
                logger.warn(`Failed to parse MQTT message on topic ${topic}: ${message.toString()}`);
            }
        });

        client.on('offline', () => {
            logger.warn('MQTT Client Offline');
            isConnected = false;
        });

        client.on('error', (err) => {
            logger.error('MQTT Connection Error:', err.message);
            isConnected = false;
        });
    },

    getStatus() {
        return isConnected;
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
