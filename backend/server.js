/**
 * 
 * Entry point of the application
 * Initializes Express, connects to MongoDB, and registers all routes
 * 
 */

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

// register models
require('./models/Task')
require('./models/Project')

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/projects', require('./routes/projects'))
app.use('/api/projects', require('./routes/members'))
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/dashboard', require('./routes/dashboard'))



// Connecting to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err))

// Launching Server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))