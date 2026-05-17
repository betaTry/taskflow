/**
 * 
 * Activities route — returns chronological activity feed for a project
 *  
 **/ 

const router = require('express').Router()
const Activity = require('../models/Activity')
const authMiddleware = require('../middleware/auth')

//  GET ACTIVITIES FOR A PROJECT 
router.get('/:projectId/activities', authMiddleware, async (req, res) => {
  try {
    const activities = await Activity.find({ project: req.params.projectId })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 }) // most recent first

    res.json(activities)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router