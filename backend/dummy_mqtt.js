const mqtt = require('mqtt');

// Connect to HiveMQ Public Broker
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
console.log('Dummy MQTT script connecting to:', brokerUrl);
const client = mqtt.connect(brokerUrl);

// Topics mapped to the back sensors
const spineTopics = [
    'UMJ/EV/S3', // Chest
    'UMJ/EV/S4', // Mid Back
    'UMJ/EV/S5', // Lower Back
    'UMJ/EV/S6'  // Pelvis
];

// Topics mapped to the shoulders/arms
const shoulderTopics = [
    'UMJ/EV/S1', // Left Arm
    'UMJ/EV/S2'  // Right Arm
];

client.on('connect', () => {
    console.log('Connected! Starting dummy data loop...');
    
    let step = 0;
    
    setInterval(() => {
        // Spine calculations (-90 when upright, 0 when bent)
        spineTopics.forEach((topic, index) => {
            const phaseOffset = index * 0.2;
            const pitch = -45 + 45 * Math.sin(step + phaseOffset);
            
            const payload = JSON.stringify({
                pitch: pitch.toFixed(2),
                roll: 0 
            });
            
            client.publish(topic, payload);
        });

        // Shoulder calculations (S2 and S3)
        // User requested: 0 degrees when upright (-90 chest), 90 degrees when bent (0 chest)
        // So shoulderPitch = chestPitch + 90
        const chestPitch = -45 + 45 * Math.sin(step);
        let shoulderPitch = chestPitch + 90; 
        
        // Add subtle variation
        shoulderPitch += 10 * Math.cos(step);

        shoulderTopics.forEach((topic, index) => {
            const armOffset = index === 0 ? 2 : -2;
            const finalPitch = shoulderPitch + armOffset;

            const payload = JSON.stringify({
                pitch: finalPitch.toFixed(2),
                roll: 0
            });
            
            client.publish(topic, payload);
        });

        step += 0.1; // Speed of animation
    }, 200); // Update every 200ms
});

client.on('error', (err) => {
    console.error('MQTT Error:', err.message);
});
