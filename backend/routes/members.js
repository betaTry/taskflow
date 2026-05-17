/**
 * 
 * Members routes — manage project team members
 * Only the project owner can invite or remove members
 * 
 */



const router = require('express').Router()
const Project = require('../models/Project')
const User = require('../models/User')
const authMiddleware = require('../middleware/auth')
const logActivity = require('../utils/logActivity')
const createNotification = require('../utils/createNotification')

//  INVITE MEMBER BY EMAIL 
router.post('/:projectId/members', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body

    // 1. find the project and make sure the logged in user is the owner
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user.id
    })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    // 2. find the user by email
    const userToAdd = await User.findOne({ email })
    if (!userToAdd) return res.status(404).json({ message: 'User not found' })

    // 3. check if already a member
    if (project.members.includes(userToAdd._id)) {
      return res.status(400).json({ message: 'User is already a member' })
    }

    // 4. add to members array
    project.members.push(userToAdd._id)
    await project.save()
    await logActivity('member_added', project._id, req.user.id, `${userToAdd.fullName} was added to the project`)
    // notify the invited user
    await createNotification(
      userToAdd._id,
      'You have been added to a project',
      project._id
    )
    res.json({ message: 'Member added successfully', project })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  REMOVE MEMBER 
router.delete('/:projectId/members/:userId', authMiddleware, async (req, res) => {
  try {
    // make sure logged in user is the owner
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user.id
    })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    // remove the member from the array
    project.members = project.members.filter(
      memberId => memberId.toString() !== req.params.userId
    )
    await project.save()
    await logActivity('member_removed', project._id, req.user.id, `Member was removed from the project`)

    res.json({ message: 'Member removed successfully', project })

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

//  GET ALL MEMBERS OF A PROJECT 
router.get('/:projectId/members', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('members', 'fullName email')

    if (!project) return res.status(404).json({ message: 'Project not found' })

    res.json(project.members)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router