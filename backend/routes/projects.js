/** 
* Project routes — CRUD operations for projects
* All routes are protected by authentication middleware
*
*/

const router = require('express').Router()
const Project = require('../models/Project')
const authMiddleware = require('../middleware/auth')

//  GET ALL PROJECTS (with pagination) 
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const projects = await Project.find({ owner: req.user.id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await Project.countDocuments({ owner: req.user.id })

    res.json({
      data: projects,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  GET ONE PROJECT 
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.json(project)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  CREATE PROJECT 
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, deadline } = req.body

    const project = new Project({
      title,
      description,
      deadline,
      owner: req.user.id
    })

    await project.save()
    res.status(201).json(project)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  UPDATE PROJECT 
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, deadline, status } = req.body

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { title, description, deadline, status },
      { new: true }
    )

    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.json(project)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  DELETE PROJECT 
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    await project.deleteOne()
    res.json({ message: 'Project deleted successfully' })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router