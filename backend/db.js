const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_name VARCHAR(100) PRIMARY KEY,
                worker_name VARCHAR(100) NOT NULL,
                worker_id VARCHAR(50) NOT NULL,
                group_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS session_data (
                id SERIAL PRIMARY KEY,
                session_name VARCHAR(100) REFERENCES sessions(session_name) ON DELETE CASCADE,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                wrench_status VARCHAR(20) NOT NULL,
                curve_angle DECIMAL(5,2),
                sensors JSONB
            );

            CREATE INDEX IF NOT EXISTS idx_session_name ON session_data(session_name);

            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(50) PRIMARY KEY,
                value JSONB NOT NULL
            );

            INSERT INTO settings (key, value)
            VALUES ('danger_limit', '25')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('Database initialized: tables are ready.');
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
    }
};

// Initialize the database connection on startup
initDB();

const startSession = async (sessionName, workerName, workerId, groupName) => {
    try {
        const check = await pool.query('SELECT session_name FROM sessions WHERE session_name = $1', [sessionName]);
        if (check.rows.length > 0) {
            throw new Error('Session name already exists');
        }
        await pool.query(
            'INSERT INTO sessions (session_name, worker_name, worker_id, group_name) VALUES ($1, $2, $3, $4)',
            [sessionName, workerName, workerId, groupName]
        );
        return true;
    } catch (err) {
        console.error('Error starting session:', err.message);
        throw err;
    }
};

const endSession = async (sessionName) => {
    try {
        await pool.query(
            'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE session_name = $1',
            [sessionName]
        );
        return true;
    } catch (err) {
        console.error('Error ending session:', err.message);
        throw err;
    }
};

const insertSessionData = async (sessionName, wrenchStatus, curveAngle, sensorsData) => {
    try {
        await pool.query(
            'INSERT INTO session_data (session_name, wrench_status, curve_angle, sensors) VALUES ($1, $2, $3, $4)',
            [sessionName, wrenchStatus, curveAngle, sensorsData]
        );
    } catch (err) {
        console.error('Error inserting session data:', err.message);
    }
};

const getSessions = async () => {
    try {
        const result = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC');
        return result.rows;
    } catch (err) {
        console.error('Error fetching sessions:', err.message);
        throw err;
    }
};

const getSessionData = async (sessionName) => {
    try {
        const result = await pool.query(
            'SELECT * FROM session_data WHERE session_name = $1 ORDER BY recorded_at ASC',
            [sessionName]
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching session data:', err.message);
        throw err;
    }
};

const getSetting = async (key, defaultValue) => {
    try {
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
        if (result.rows.length > 0) {
            return result.rows[0].value;
        }
        return defaultValue;
    } catch (err) {
        console.error(`Error fetching setting ${key}:`, err.message);
        return defaultValue;
    }
};

const updateSetting = async (key, value) => {
    try {
        await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, JSON.stringify(value)]
        );
    } catch (err) {
        console.error(`Error updating setting ${key}:`, err.message);
    }
};

module.exports = {
    pool,
    initDB,
    startSession,
    endSession,
    insertSessionData,
    getSessions,
    getSessionData,
    getSetting,
    updateSetting
};
