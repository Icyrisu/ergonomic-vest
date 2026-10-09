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
let activeTolerance = 10;

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
                'UMJ/EV/S3', 'UMJ/EV/S4', 'UMJ/EV/S5', 'UMJ/EV/S6'
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
                
                if (topic === 'UMJ/EV/WR' && payload.value) {
                    currentWrenchStatus = payload.value;
                    if (ioInstance) {
                        ioInstance.emit('wrench_status', currentWrenchStatus === 'ON');
                    }
                    return;
                }
                
                if (payload.pitch !== undefined) {
                    const pitch = parseFloat(payload.pitch);
                    
                    let status = 'Neutral Pose';
                    const bounds = activeNeutralPoses[topic];
                    
                    let baseline = -90;
                    if (topic === 'UMJ/EV/S2' || topic === 'UMJ/EV/S3') {
                        baseline = 0;
                    }
                    
                    const relativePitch = pitch - baseline;

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
                    
                    latestSensorData[topic] = { pitch, status };
                    
                    if (ioInstance) {
                        ioInstance.emit('sensor_data', { topic, pitch, status });
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
    }
};

module.exports = mqttService;
