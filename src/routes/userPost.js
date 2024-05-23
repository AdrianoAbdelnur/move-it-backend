const express = require("express");
const { addPost } = require("../controllers/userPost");
const router = express.Router();

router.post('/addPost', addPost )

module.exports = router; 