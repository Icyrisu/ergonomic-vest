require('dotenv').config();

let rawBroker = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
if (!rawBroker.includes('://')) {
    rawBroker = `mqtt://${rawBroker}`;
}

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL,
    MQTT_BROKER: rawBroker,
};

const validateEnv = () => {
    const required = ['DATABASE_URL'];
    const missing = required.filter(key => !env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};

validateEnv();

module.exports = env;
