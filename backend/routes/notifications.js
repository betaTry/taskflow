/**
 * 
 * 
 * Notifications routes — get and mark notifications as read
 * Client polls this every 30 seconds via setInterval
 *
**/


const router = require('express').Router()
const Notification = require('../models/Notification')
const authMiddleware = require('../middleware/auth')

//  GET ALL NOTIFICATIONS FOR LOGGED IN USER 
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)

    res.json(notifications)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  MARK NOTIFICATION AS READ 
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    console.log('notification id:', req.params.id)
    console.log('user id from token:', req.user.id)

    const notification = await Notification.findById(req.params.id)
    console.log('notification found:', notification)

    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    )

    if (!updated) return res.status(404).json({ message: 'Notification not found' })
    res.json(updated)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router