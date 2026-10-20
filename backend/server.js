
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

app.get('/api', (req, res) => {
  res.json({
    message: 'School tutoring API is running!',
  })
})

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
})
