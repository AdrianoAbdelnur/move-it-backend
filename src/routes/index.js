const express = require("express");
const router = express.Router();

router.use('/user', require('./user'))
router.use('/userPost', require('./userPost'))
router.use('/offer', require('./offer'))
router.use('/payment', require('./payment'))
router.use('/uploads', require('./uploads'))

module.exports = router; 
