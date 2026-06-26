const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        logger.info('Connected to PostgreSQL database');
        client.release();
    } catch (err) {
        logger.error('Failed to connect to PostgreSQL database:', err.message);
        process.exit(1);
    }
};

module.exports = {
    pool,
    connectDB
};
