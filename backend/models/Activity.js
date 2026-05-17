/**
 *  
 * Activity model — tracks all significant actions on a project
 * Stores who did what and when
 * 
**/

const mongoose = require('mongoose')

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'task_created',
      'task_deleted',
      'task_status_changed',
      'member_added',
      'member_removed',
      'project_updated'
    ]
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    required: true
  }
}, { timestamps: true })

const Activity = mongoose.model('Activity', activitySchema)
module.exports = Activity