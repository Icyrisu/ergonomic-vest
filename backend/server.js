const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow frontend access
    methods: ["GET", "POST"]
  }
});

const mqttWorker = require('./mqtt');
const db = require('./db');

// ---------------------------------------------------------
// SESSION RECORDING LOGIC STATE
// ---------------------------------------------------------
let activeSession = null;
let recordInterval = null;

io.on('connection', (socket) => {
  console.log('Frontend connected to Socket.io');
  
  // Also send current session status on connect
  socket.emit('session_status', activeSession !== null);
  
  socket.on('request_session_status', () => {
    socket.emit('session_status', activeSession !== null);
  });
  
  socket.on('wrench_control', (data) => {
    if (data && data.value) {
      mqttWorker.publishWrench(data.value);
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected from Socket.io');
  });
});

mqttWorker.setSocketIo(io);

if (process.env.NODE_ENV === 'development') {
    require('./dummy_mqtt.js');
}

// ---------------------------------------------------------
// SESSION RECORDING LOGIC
// ---------------------------------------------------------

const recordData = async () => {
    if (!activeSession) return;
    
    const wrenchStatus = mqttWorker.getWrenchStatus() === 'ON' ? 'ONLINE' : 'OFFLINE';
    
    let sensorsData = null;
    let curveAngle = null;
    
    if (wrenchStatus === 'ONLINE') {
        const data = mqttWorker.getLatestSensorData();
        // Calculate curve angle: Chest(s5) pitch - Pelvis(s9) pitch
        // Note: checking if both s5 and s9 exist
        if (data['UMJ/EV/S3'] && data['UMJ/EV/S6']) { // Wait, s5 is S3? Let's map it.
            // In Dashboard.tsx: s5=Chest('UMJ/EV/S3'), s9=Pelvis('UMJ/EV/S6')
            const chestPitch = data['UMJ/EV/S3'].pitch;
            const pelvisPitch = data['UMJ/EV/S6'].pitch;
            curveAngle = Math.abs(chestPitch - pelvisPitch);
        }
        sensorsData = data;
    }
    
    await db.insertSessionData(activeSession, wrenchStatus, curveAngle, sensorsData);
};

app.post('/api/sessions/start', async (req, res) => {
    try {
        const { session_name, name, id, group } = req.body;
        
        if (!session_name || !name || !id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (activeSession) {
            return res.status(400).json({ error: 'A session is already active' });
        }
        
        await db.startSession(session_name, name, id, group || null);
        activeSession = session_name;
        
        // Start 1-second recording loop
        recordInterval = setInterval(recordData, 1000);
        
        io.emit('session_status', true);
        res.json({ message: 'Session started', session_name });
    } catch (err) {
        if (err.message === 'Session name already exists') {
            return res.status(409).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to start session' });
    }
});

app.post('/api/sessions/stop', async (req, res) => {
    try {
        if (!activeSession) {
            return res.status(400).json({ error: 'No active session' });
        }
        
        clearInterval(recordInterval);
        recordInterval = null;
        
        await db.endSession(activeSession);
        
        const endedSession = activeSession;
        activeSession = null;
        
        io.emit('session_status', false);
        res.json({ message: 'Session stopped', session_name: endedSession });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await db.getSessions();
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

app.get('/api/sessions/:name/data', async (req, res) => {
    try {
        const data = await db.getSessionData(req.params.name);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch session data' });
    }
});

// ---------------------------------------------------------
// OTHER ENDPOINTS
// ---------------------------------------------------------
app.get('/', (req, res) => {
  res.send('Backend OK');
});

app.get('/api/mqtt-status', (req, res) => {
  res.json({ online: mqttWorker.getStatus() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server and Socket.io running on port ${PORT}`);
});