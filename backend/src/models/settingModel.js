const { pool } = require('../config/database');

const settingModel = {
    async getSetting(key, defaultValue) {
        const query = 'SELECT value FROM settings WHERE key = $1';
        const result = await pool.query(query, [key]);
        if (result.rows.length > 0) {
            return result.rows[0].value;
        }
        return defaultValue;
    },

    async updateSetting(key, value) {
        const query = 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
        await pool.query(query, [key, JSON.stringify(value)]);
    }
};

module.exports = settingModel;
