/**
 * 
 * Authentication routes — register and login
 * Returns a JWT token on successful login
 * 
 */

const router = require('express').Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const User = require('../models/User')

// Register
router.post('/register',async (req,res)=>{
    try{
        const { fullName , email , password } = req.body
        const existing = await User.findOne({email})
        if(existing)
        {
            return res.status(400).json({message: 'Email already used.'})
        }


        const user = new User({fullName,email,password})
        await user.save()
        res.status(201).json({ message: 'Successively Registred.'})

    } catch (err) {
        console.error(err)
        res.status(500).json({message:'Erreur de Serveur.',error:err.message})
    }
})

// Login
router.post('/login',async (req,res)=>{
    try{
        const {email, password} = req.body
        const user = await User.findOne({email})
        if(!user) {
            return res.status(400).json({message:'Invalid Credentials.'})
        }

        const isMatch = await bcrypt.compare(password,user.password)
        if(!isMatch) {
            return res.status(400).json({message:'Invalid Credentials.'})
        }

        const token = jwt.sign(
            { id: user._id, name : user.fullName},
            process.env.JWT_SECRET,
            { expiresIn:'7d'}
        )
        res.json({token,user: {id: user._id, name: user.fullName, email: user.email}})

    } catch (err) {
        console.error(err) // add this line
        res.status(500).json({ message: 'Server Error.',error:err.message})
    }
})

// Exporting the module
module.exports = router