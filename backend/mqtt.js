// backend/mqtt.js
const mqtt = require('mqtt');
require('dotenv').config();

const brokerUrl = process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt';
let isConnected = false;

// In-memory state for session recording
let currentWrenchStatus = 'OFF';
let latestSensorData = {};

console.log('Starting MQTT Client connecting to:', brokerUrl);
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
    console.log('Connected to MQTT Broker:', brokerUrl);
    isConnected = true;
    
    const topics = [
        'UMJ/EV/WR', 'UMJ/EV/S1', 'UMJ/EV/S2', 
        'UMJ/EV/S3', 'UMJ/EV/S4', 'UMJ/EV/S5', 'UMJ/EV/S6'
    ];
    topics.forEach(t => {
        client.subscribe(t, (err) => {
            if (!err) console.log(`Subscribed to ${t}`);
        });
    });
});

const db = require('./db');

let ioInstance = null;

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        
        // Handle Wrench Status Updates
        if (topic === 'UMJ/EV/WR' && payload.value) {
            currentWrenchStatus = payload.value; // 'ON' or 'OFF'
            if (ioInstance) {
                ioInstance.emit('wrench_status', currentWrenchStatus === 'ON');
            }
            return;
        }
        
        if (payload.pitch !== undefined && payload.roll !== undefined) {
            const pitch = parseFloat(payload.pitch);
            const roll = parseFloat(payload.roll);
            
            // Determine posture status based on pitch (assuming -90 is upright, 0 is bent forward)
            let status = 'Safe';
            if (pitch > -45) {
                status = 'Danger';
            } else if (pitch > -60) {
                status = 'Warning';
            }
            
            // Store latest data
            latestSensorData[topic] = { pitch, roll, status };
            
            if (ioInstance) {
                ioInstance.emit('sensor_data', { topic, pitch, roll, status });
            }
        }
    } catch (err) {
        // Not JSON or missing fields
        console.log(`[MQTT Backend] ${topic}: ${message.toString()}`);
    }
});

client.on('offline', () => {
    console.log('MQTT Client Offline');
    isConnected = false;
});

client.on('error', (err) => {
    console.error('MQTT Connection Error:', err.message);
    isConnected = false;
});

module.exports = {
    getStatus: () => isConnected,
    getWrenchStatus: () => currentWrenchStatus,
    getLatestSensorData: () => latestSensorData,
    client: client,
    setSocketIo: (io) => { ioInstance = io; },
    publishWrench: (value) => {
        if (isConnected) {
            // Also update local state so it's immediate
            currentWrenchStatus = value;
            client.publish('UMJ/EV/WR', JSON.stringify({ value: value }));
        }
    }
};
