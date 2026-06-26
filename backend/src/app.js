const express = require('express');
const cors = require('cors');
const sessionRoutes = require('./routes/sessionRoutes');
const errorHandler = require('./middleware/errorHandler');
const mqttService = require('./mqtt/mqttService');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.status(200).send('Backend OK');
});

app.get('/api/mqtt-status', (req, res) => {
    res.json({ online: mqttService.getStatus() });
});

app.use('/api/sessions', sessionRoutes);

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
