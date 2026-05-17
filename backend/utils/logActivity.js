/**
 * 
 * Helper function to log activities
 * Called from routes whenever a significant action happens
 * 
**/

const Activity = require('../models/Activity')

async function logActivity(type, projectId, userId, description) {
  try {
    const activity = new Activity({
      type,
      project: projectId,
      user: userId,
      description
    })
    await activity.save()
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}

module.exports = logActivity