const { pool } = require('../config/database');
const logger = require('../utils/logger');

const sessionModel = {
    async createSession(sessionName, workerName, workerId, groupName) {
        const query = 'INSERT INTO sessions (session_name, worker_name, worker_id, group_name) VALUES ($1, $2, $3, $4)';
        await pool.query(query, [sessionName, workerName, workerId, groupName]);
    },

    async checkSessionExists(sessionName) {
        const query = 'SELECT session_name FROM sessions WHERE session_name = $1';
        const result = await pool.query(query, [sessionName]);
        return result.rows.length > 0;
    },

    async endSession(sessionName) {
        const query = 'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE session_name = $1';
        await pool.query(query, [sessionName]);
    },

    async getAllSessions() {
        const query = 'SELECT * FROM sessions ORDER BY created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    },

    async insertSessionData(sessionName, wrenchStatus, curveAngle, sensorsData) {
        const query = 'INSERT INTO session_data (session_name, wrench_status, curve_angle, sensors) VALUES ($1, $2, $3, $4)';
        await pool.query(query, [sessionName, wrenchStatus, curveAngle, sensorsData]);
    },

    async getSessionDataByName(sessionName) {
        const query = 'SELECT * FROM session_data WHERE session_name = $1 ORDER BY recorded_at ASC';
        const result = await pool.query(query, [sessionName]);
        return result.rows;
    }
};

module.exports = sessionModel;
