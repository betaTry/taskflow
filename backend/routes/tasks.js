/**
 * 
 * Task routes — CRUD operations for tasks
 * All routes are protected by authentication middleware
 * 
 */

const router = require('express').Router()
const Task = require('../models/Task')
const Project = require('../models/Project')
const authMiddleware = require('../middleware/auth')
const validateTask = require('../middleware/validateTask')
const logActivity = require('../utils/logActivity')
const createNotification = require('../utils/createNotification')


//  GET MY ASSIGNED TASKS (for dashboard) 
router.get('/my-tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate('project', 'title')
      .sort({ createdAt: -1 })

    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ─── GET ALL TASKS FOR A PROJECT (with filtering & pagination) ───
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { status, priority, assignedTo, search, page = 1, limit = 10 } = req.query

    // build filter conditionally — only add condition if param exists
    const filter = { project: req.params.projectId }

    if (status) filter.status = status
    if (priority) filter.priority = priority
    if (assignedTo) filter.assignedTo = assignedTo
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'fullName email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })

    const total = await Task.countDocuments(filter)

    res.json({
      data: tasks,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  GET ONE TASK 
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ message: 'Task not found' })
    res.json(task)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  CREATE TASK 
router.post('/', authMiddleware, validateTask, async (req, res) => {
  try {
    const { title, description, priority, status, deadline, project } = req.body

    const existingProject = await Project.findOne({ _id: project, owner: req.user.id })
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' })
    }

    const task = new Task({ title, description, priority, status, deadline, project })
    await task.save()

    // log activity
    await logActivity('task_created', project, req.user.id, `Task "${title}" was created`)

    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  UPDATE TASK 
router.put('/:id', authMiddleware, validateTask, async (req, res) => {
  try {
    const { title, description, priority, status, deadline } = req.body

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, priority, status, deadline },
      { new: true }
    )

    if (!task) return res.status(404).json({ message: 'Task not found' })
    res.json(task)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  UPDATE TASK STATUS ONLY 
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )

    if (!task) return res.status(404).json({ message: 'Task not found' })

    // log activity
    await logActivity('task_status_changed', task.project, req.user.id, `Task "${task.title}" status changed to "${status}"`)

    // notify the assigned user about status change
    if (task.assignedTo) {
      await createNotification(
        task.assignedTo,
        `Task "${task.title}" status changed to "${status}"`,
        task.project,
        task._id
      )
    }

    res.json(task)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  ASSIGN TASK TO A MEMBER 
router.patch('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedTo: userId },
      { new: true }
    ).populate('assignedTo', 'fullName email')

    if (!task) return res.status(404).json({ message: 'Task not found' })

    // notify the assigned user
    await createNotification(
      userId,
      `You have been assigned to task "${task.title}"`,
      task.project,
      task._id
    )

    res.json(task)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  DELETE TASK 
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id)
    if (!task) return res.status(404).json({ message: 'Task not found' })

    // log activity
    await logActivity('task_deleted', task.project, req.user.id, `Task "${task.title}" was deleted`)

    res.json({ message: 'Task deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router