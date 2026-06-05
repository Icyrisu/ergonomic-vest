const express = require('express')
const cors = require('cors')
require('dotenv').config()
const mqttWorker = require('./mqtt.js')

const app = express()
app.use(cors())

app.get('/', (req, res) => {
  res.send('Backend OK')
})

app.get('/api/mqtt-status', (req, res) => {
  res.json({ online: mqttWorker.getStatus() })
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})