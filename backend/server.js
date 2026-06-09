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

io.on('connection', (socket) => {
  console.log('Frontend connected to Socket.io');
  
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

app.get('/', (req, res) => {
  res.send('Backend OK')
})

app.get('/api/mqtt-status', (req, res) => {
  res.json({ online: mqttWorker.getStatus() })
})

const db = require('./db')

app.get('/api/history', async (req, res) => {
  try {
    const history = await db.getHistory(50) // fetch last 50 records
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server and Socket.io running on port ${PORT}`)
})