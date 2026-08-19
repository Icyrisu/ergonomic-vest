const sessionService = require('../services/sessionService');
const logger = require('../utils/logger');

const sessionController = {
    async startSession(req, res, next) {
        try {
            const { session_name, name, id, group, neutralPoses } = req.body;
            
            if (!session_name || !name || !id) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            const startedSessionName = await sessionService.startSession(session_name, name, id, group, neutralPoses);
            
            if (req.app.get('io')) {
                req.app.get('io').emit('session_status', true);
            }
            
            res.status(201).json({ message: 'Session started', session_name: startedSessionName });
        } catch (err) {
            if (err.message === 'A session is already active' || err.message === 'Session name already exists') {
                return res.status(409).json({ error: err.message });
            }
            next(err);
        }
    },

    async stopSession(req, res, next) {
        try {
            const endedSessionName = await sessionService.stopSession();
            
            if (req.app.get('io')) {
                req.app.get('io').emit('session_status', false);
            }
            
            res.status(200).json({ message: 'Session stopped', session_name: endedSessionName });
        } catch (err) {
            if (err.message === 'No active session') {
                return res.status(400).json({ error: err.message });
            }
            next(err);
        }
    },

    async getAllSessions(req, res, next) {
        try {
            const sessions = await sessionService.getAllSessions();
            res.status(200).json(sessions);
        } catch (err) {
            next(err);
        }
    },

    async getSessionData(req, res, next) {
        try {
            const data = await sessionService.getSessionData(req.params.name);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }
};

module.exports = sessionController;
