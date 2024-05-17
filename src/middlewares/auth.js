const jwt = require("jsonwebtoken");
require('dotenv').config();


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
    console.log(req.userRole) 
    if (req?.userRole !== 'admin')
        return res.status(401).json({ message: 'User without necessary privileges.' })
    next();
};

module.exports = {
    decodeToken,
    adminRequiredValidation,
};