/**
 * 
 * Authentication middleware
 * Verifies JWT token on every protected route before allowing access
 * 
 */

const jwt = require('jsonwebtoken')

function authMiddleware(req,res,next)
{
    const token = req.headers.authorization?.split(' ')[1]
    if(!token) {
        return res.status(401).json({message: 'Invalid Access, No Token.'})
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch(err) {
        res.status(401).json({message:'Invalid or Expired Token.'})
    }
}

//Exporting the module
module.exports = authMiddleware