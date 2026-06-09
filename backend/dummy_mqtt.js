const mqtt = require('mqtt');

// Connect to HiveMQ Public Broker
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
console.log('Dummy MQTT script connecting to:', brokerUrl);
const client = mqtt.connect(brokerUrl);

// Topics mapped to the back sensors
const topics = [
    'UMJ/EV/S3', // Chest
    'UMJ/EV/S4', // Mid Back
    'UMJ/EV/S5', // Lower Back
    'UMJ/EV/S6'  // Pelvis
];

client.on('connect', () => {
    console.log('Connected! Starting dummy data loop...');
    
    let step = 0;
    // We will animate pitch from -90 (upright) to 0 (bent) and back
    // Pitch path: -90 -> 0 -> -90
    
    setInterval(() => {
        // Create a sine wave oscillation between -90 and 0
        // Math.sin(step) goes from -1 to 1.
        // We want a value between -90 and 0.
        // Center is -45, amplitude is 45.
        const pitchValue = -45 + 45 * Math.sin(step);
        
        // Slightly offset the phase for each sensor to make it look like a rolling wave
        topics.forEach((topic, index) => {
            const phaseOffset = index * 0.2;
            const pitch = -45 + 45 * Math.sin(step + phaseOffset);
            
            const payload = JSON.stringify({
                pitch: pitch.toFixed(2),
                roll: 0 // Keep roll at 0 to avoid sideways bending in this dummy
            });
            
            client.publish(topic, payload);
            console.log(`Published to ${topic}: ${payload}`);
        });

        step += 0.1; // Speed of animation
    }, 200); // Update every 200ms
});

client.on('error', (err) => {
    console.error('MQTT Error:', err.message);
});
