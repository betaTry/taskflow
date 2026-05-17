/**
 * Task model — defines the schema for tasks in MongoDB
 * Each task is linked to a project and optionally assigned to a user
 */

const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['basse', 'moyenne', 'haute'],
    required: true
  },
  status: {
    type: String,
    enum: ['à faire', 'en cours', 'terminé'],
    default: 'à faire',
    required: true
  },
  deadline: {
    type: Date
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true })

const Task = mongoose.model('Task', taskSchema)
module.exports = Task