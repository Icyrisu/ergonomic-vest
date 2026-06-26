const mqtt = require('mqtt');
const env = require('../config/env');
const logger = require('../utils/logger');

let isConnected = false;
let currentWrenchStatus = 'OFF';
let latestSensorData = {};
let ioInstance = null;
let client = null;

const mqttService = {
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
                
                if (payload.pitch !== undefined && payload.roll !== undefined) {
                    const pitch = parseFloat(payload.pitch);
                    const roll = parseFloat(payload.roll);
                    
                    let status = 'Safe';
                    if (pitch > -45) {
                        status = 'Danger';
                    } else if (pitch > -60) {
                        status = 'Warning';
                    }
                    
                    latestSensorData[topic] = { pitch, roll, status };
                    
                    if (ioInstance) {
                        ioInstance.emit('sensor_data', { topic, pitch, roll, status });
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
