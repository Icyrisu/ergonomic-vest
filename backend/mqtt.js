// backend/mqtt.js
const mqtt = require('mqtt');
require('dotenv').config();

const brokerUrl = process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt';
let isConnected = false;

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

client.on('message', (topic, message) => {
    console.log(`[MQTT Backend] ${topic}: ${message.toString()}`);
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
    client: client
};
