require('dotenv').config();

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL,
    MQTT_BROKER: process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt',
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
