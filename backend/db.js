const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sensor_data (
                id SERIAL PRIMARY KEY,
                topic VARCHAR(50) NOT NULL,
                pitch DECIMAL(5,2) NOT NULL,
                roll DECIMAL(5,2) NOT NULL,
                status VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized: sensor_data table is ready.');
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
    }
};

// Initialize the database connection on startup
initDB();

const insertSensorData = async (topic, pitch, roll, status) => {
    try {
        await pool.query(
            'INSERT INTO sensor_data (topic, pitch, roll, status) VALUES ($1, $2, $3, $4)',
            [topic, pitch, roll, status]
        );
    } catch (err) {
        console.error('Error inserting sensor data:', err.message);
    }
};

const getHistory = async (limit = 20) => {
    try {
        const result = await pool.query(
            'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching history:', err.message);
        return [];
    }
};

module.exports = {
    pool,
    insertSensorData,
    getHistory
};
