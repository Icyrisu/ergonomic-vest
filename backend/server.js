const express = require('express')
require('dotenv').config()

const app = express()

app.get('/', (req, res) => {
  res.send('Backend OK')
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})