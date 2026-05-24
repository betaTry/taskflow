/**
 * 
 * Dashboard route — returns activity metrics for the logged in user
 * Uses MongoDB aggregation pipeline for server-side calculations
 * 
 */

const router = require('express').Router()
const mongoose = require('mongoose')
const Project = require('../models/Project')
const Task = require('../models/Task')
const authMiddleware = require('../middleware/auth')

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const now = new Date()

    // 1. count active projects where user is owner OR member
    // FIX: was { owner: userId, status: 'actif' } — missed member projects
    const activeProjects = await Project.countDocuments({
      status: 'actif',
      $or: [
        { owner: userId },
        { members: userId }
      ]
    })

    // 2. aggregation pipeline for task metrics
    const taskStats = await Task.aggregate([
      {
        $match: {
          assignedTo: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'terminé'] }, 1, 0]
            }
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$deadline', now] },
                    { $ne: ['$status', 'terminé'] }
                  ]
                },
                1, 0
              ]
            }
          }
        }
      }
    ])

    // 3. in progress tasks sorted by priority then deadline
    const inProgressTasks = await Task.find({
      assignedTo: userId,
      status: 'en cours'
    })
    .populate('project', 'title')
    .sort({ priority: -1, deadline: 1 })

    const stats = taskStats[0] || { totalAssigned: 0, completed: 0, overdue: 0 }

    res.json({
      activeProjects,
      assignedTasks: stats.totalAssigned,
      completedTasks: stats.completed,
      overdueTasks: stats.overdue,
      inProgressTasks
    })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router