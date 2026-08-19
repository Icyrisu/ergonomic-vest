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
    const sensorsData = mqttService.getLatestSensorData();

    try {
        await sessionModel.insertSessionData(activeSession, wrenchStatus, sensorsData);
    } catch (err) {
        logger.error('Failed to record session data:', err.message);
    }
};

const sessionService = {
    setMqttService,
    
    getActiveSession() {
        return activeSession;
    },

    async startSession(sessionName, workerName, workerId, groupName, neutralPoses) {
        if (activeSession) {
            throw new Error('A session is already active');
        }

        const exists = await sessionModel.checkSessionExists(sessionName);
        if (exists) {
            throw new Error('Session name already exists');
        }

        await sessionModel.createSession(sessionName, workerName, workerId, groupName || null, JSON.stringify(neutralPoses));
        activeSession = sessionName;
        
        if (mqttService) {
            mqttService.setActiveSessionNeutralPoses(neutralPoses);
        }
        
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
