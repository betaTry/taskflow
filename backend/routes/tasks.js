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

//  GET ALL TASKS FOR A PROJECT 
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })

    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET ONE TASK 
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

    // make sure the project exists and belongs to the user
    const existingProject = await Project.findOne({ _id: project, owner: req.user.id })
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' })
    }

    const task = new Task({ title, description, priority, status, deadline, project })
    await task.save()
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
    res.json({ message: 'Task deleted successfully' })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router