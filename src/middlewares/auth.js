const jwt = require("jsonwebtoken");
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');


const decodeToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        if (!token) return res.status(401).json({ message: 'Token not found' })
        const {user} = jwt.verify(token, process.env.SECRET_WORD);
        req.userId = user.id;
        req.userRole = user.role;
        next();
    } catch (error) {
        return res.status(401).json({ message: error.message });
    }
};

const adminRequiredValidation = (req, res, next) => {
    if (req?.userRole !== 'admin')
        return res.status(401).json({ message: 'User without necessary privileges.' })
    next();
};

const decodeFirebaseToken = async (req, res, next) => {
    const client = new OAuth2Client(process.env.CLIENT_ID);
    try {
        const token = req.headers['googleauth'];
        if (!token) {
            return res.status(401).json({ error: 'Token missing in Authorization header' });
        }

        
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.CLIENT_ID,
        });
        const payload = ticket.getPayload();
    
        req.user = payload;
        req.idToken= token

        next();

    } catch (error) {
        console.error('Error al verificar el token:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = {
    decodeToken,
    decodeFirebaseToken,
    adminRequiredValidation,
};