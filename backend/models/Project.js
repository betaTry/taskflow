/**
 * 
 * Project model — defines the schema for projects in MongoDB
 * Each project is linked to the user who created it
 * 
 */

const mongoose = require('mongoose')

const projectSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    deadline: {
        type: Date
    },
    status: {
        type: String,
        enum: ['actif', 'en pause', 'archivé'],
        default: 'actif'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    member: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true })


// cascade delete all tasks when project is deleted
projectSchema.pre('deleteOne', { document: true, query: false }, async function() {
    const Task = mongoose.model('Task')
    await Task.deleteMany({ project: this._id })
})


const Project = mongoose.model('Project', projectSchema)
module.exports = Project