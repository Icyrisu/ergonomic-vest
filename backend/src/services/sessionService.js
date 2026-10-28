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
        if (mqttService) {
            mqttService.setActiveSessionNeutralPoses({
                'UMJ/EV/S1': [0, 10],
                'UMJ/EV/S2': [-20, 20],
                'UMJ/EV/S3': [-20, 20],
                'UMJ/EV/S4': [0, 20],
                'UMJ/EV/S5': [-10, 10],
                'UMJ/EV/S6': [-10, 10],
                tolerance: 10,
                useML: true
            });
        }
        logger.info(`Session stopped: ${endedSession}`);
        
        return endedSession;
    },

    async getAllSessions() {
        return await sessionModel.getAllSessions();
    },

    async getSessionData(sessionName) {
        return await sessionModel.getSessionDataByName(sessionName);
    },

    async formatSessionCsv(sessionName) {
        const rows = await sessionModel.getSessionDataByName(sessionName);
        let csv = 'Timestamp,Wrench Status,S1 Neck Pitch,S2 Right Shoulder Pitch,S3 Left Shoulder Pitch,S4 Upper Back Pitch,S5 Mid Back Pitch,S6 Pelvis Pitch\n';

        rows.forEach(r => {
            const ts = new Date(r.recorded_at).toISOString();
            const wrench = r.wrench_status === 'ONLINE' ? 'ON' : 'OFF';
            const sensors = r.sensors || {};

            const s1 = sensors['UMJ/EV/S1']?.pitch ?? '';
            const s2 = sensors['UMJ/EV/S2']?.pitch ?? '';
            const s3 = sensors['UMJ/EV/S3']?.pitch ?? '';
            const s4 = sensors['UMJ/EV/S4']?.pitch ?? '';
            const s5 = sensors['UMJ/EV/S5']?.pitch ?? '';
            const s6 = sensors['UMJ/EV/S6']?.pitch ?? '';

            csv += `${ts},${wrench},${s1},${s2},${s3},${s4},${s5},${s6}\n`;
        });

        return csv;
    }
};

module.exports = sessionService;
