const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');
let mqttService = null; // Will be injected to avoid circular dependency

let activeSession = null;
let recordInterval = null;

// Initialize MQTT Service injection
const setMqttService = (service) => {
    mqttService = service;
};

const recordData = async () => {
    if (!activeSession) return;
    if (!mqttService) {
        logger.error('MQTT service not injected into sessionService');
        return;
    }

    const wrenchStatus = mqttService.getWrenchStatus() === 'ON' ? 'ONLINE' : 'OFFLINE';
    let sensorsData = null;
    let curveAngle = null;

    if (wrenchStatus === 'ONLINE') {
        const data = mqttService.getLatestSensorData();
        // Calculate curve angle: Leher(UMJ/EV/S1) pitch - Pelvis(UMJ/EV/S6) pitch
        if (data['UMJ/EV/S1'] && data['UMJ/EV/S6']) {
            const neckPitch = data['UMJ/EV/S1'].pitch;
            const pelvisPitch = data['UMJ/EV/S6'].pitch;
            curveAngle = Math.abs(neckPitch - pelvisPitch);
        }
        sensorsData = data;
    }

    try {
        await sessionModel.insertSessionData(activeSession, wrenchStatus, curveAngle, sensorsData);
    } catch (err) {
        logger.error('Failed to record session data:', err.message);
    }
};

const sessionService = {
    setMqttService,
    
    getActiveSession() {
        return activeSession;
    },

    async startSession(sessionName, workerName, workerId, groupName) {
        if (activeSession) {
            throw new Error('A session is already active');
        }

        const exists = await sessionModel.checkSessionExists(sessionName);
        if (exists) {
            throw new Error('Session name already exists');
        }

        await sessionModel.createSession(sessionName, workerName, workerId, groupName || null);
        activeSession = sessionName;
        
        // Start 1-second recording loop
        recordInterval = setInterval(recordData, 1000);
        logger.info(`Session started: ${sessionName}`);
        
        return sessionName;
    },

    async stopSession() {
        if (!activeSession) {
            throw new Error('No active session');
        }

        clearInterval(recordInterval);
        recordInterval = null;

        await sessionModel.endSession(activeSession);
        
        const endedSession = activeSession;
        activeSession = null;
        logger.info(`Session stopped: ${endedSession}`);
        
        return endedSession;
    },

    async getAllSessions() {
        return await sessionModel.getAllSessions();
    },

    async getSessionData(sessionName) {
        return await sessionModel.getSessionDataByName(sessionName);
    }
};

module.exports = sessionService;
