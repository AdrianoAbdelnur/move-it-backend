const express = require("express");
const router = express.Router();

router.use('/user', require('./user'))
router.use('/userPost', require('./userPost'))

module.exports = router; 