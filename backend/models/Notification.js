/**
 * 
 * Notification model — stores notifications for users
 * Triggered when tasks are assigned, status changes, or member is added
 * 
*/


const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }
}, { timestamps: true })

const Notification = mongoose.model('Notification', notificationSchema)
module.exports = Notification