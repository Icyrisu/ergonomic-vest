const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/database');
const mqttService = require('./mqtt/mqttService');
const sessionService = require('./services/sessionService');
const settingModel = require('./models/settingModel');
const logger = require('./utils/logger');

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Attach io to app so controllers can access it
app.set('io', io);

// Inject dependencies to avoid circular imports
sessionService.setMqttService(mqttService);

let globalThreshold = 25;

const startServer = async () => {
    await connectDB();
    
    // Load initial threshold
    globalThreshold = await settingModel.getSetting('danger_limit', 25);
    
    mqttService.init(io);

    io.on('connection', (socket) => {
        logger.info(`Frontend connected to Socket.io: ${socket.id}`);
        
        socket.emit('session_status', sessionService.getActiveSession() !== null);
        socket.emit('threshold_sync', globalThreshold);
        socket.emit('wrench_status', mqttService.getWrenchStatus() === 'ON');
        
        socket.on('request_session_status', () => {
            socket.emit('session_status', sessionService.getActiveSession() !== null);
            socket.emit('threshold_sync', globalThreshold);
        });

        socket.on('threshold_change', async (value) => {
            const val = parseInt(value, 10);
            if (!isNaN(val) && val >= 10 && val <= 90) {
                globalThreshold = val;
                await settingModel.updateSetting('danger_limit', val);
                socket.broadcast.emit('threshold_sync', globalThreshold);
            }
        });
        
        socket.on('wrench_control', (data) => {
            if (data && data.value) {
                mqttService.publishWrench(data.value);
            }
        });

        socket.on('tare_request', () => {
            logger.info('Tare command requested by frontend');
            mqttService.publishCommand('tare');
            io.emit('tare_synced', { success: true, timestamp: Date.now() });
        });

        socket.on('disconnect', () => {
            logger.info(`Frontend disconnected from Socket.io: ${socket.id}`);
        });
    });

    server.listen(env.PORT, () => {
        logger.info(`Server and Socket.io running on port ${env.PORT}`);
    });
};

startServer().catch(err => {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
});
