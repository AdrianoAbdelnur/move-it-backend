const User = require('../models/User');
const { body } = require('express-validator');

const verifyRegisterFields = () => {
    return [
        body('email').isEmail().normalizeEmail().trim().escape().custom( email => {
            return  User.findOne({ email }).then(user => {
                if (user) return Promise.reject('The email address is already in use. If this email belongs to you, please log in instead');
            })
        }),
        body('password').isLength({ min: 6, max: 16 }),
        body('given_name').not().isEmpty().trim().escape().isLength({ min: 3, max: 24 }),
        body('family_name').not().isEmpty().trim().escape().isLength({ min: 3, max: 24 }),
    ];
};

const verifyLoginFields = () => {
    return [
        body('email').isEmail().normalizeEmail().trim().escape(),
    ];
}

module.exports = {
    verifyRegisterFields,
    verifyLoginFields,
}