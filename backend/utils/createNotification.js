/**
 * 
 * Helper to create notifications for users
 * 
**/

const Notification = require('../models/Notification')

async function createNotification(userId, message, projectId = null, taskId = null) {
  try {
    const notification = new Notification({
      user: userId,
      message,
      project: projectId,
      task: taskId
    })
    await notification.save()
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}

module.exports = createNotification