/**
 *
 * Entry point of the application
 * Initializes Express, connects to MongoDB, and registers all routes
 *  
 * **/

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()

// Middleware
app.use(cors()) // Accorder A le frontend d'appeler le backend
app.use(express.json()) // parse Json from request body

// Routes
app.use('/api/auth', require('./routes/auth'))

// Connecting to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(()=>console.log('MongoDB connected'))
    .catch(()=>console.log('MongoDB error : ',err))

// Launching Server
const PORT = process.env.PORT
app.listen(PORT,()=> console.log(`Server running on port ${PORT}`))