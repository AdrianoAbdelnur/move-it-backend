const express = require("express");
const { addPost, getMyPosts, getAllPosts } = require("../controllers/userPost");
const router = express.Router();

router.post('/addPost', addPost )
router.get('/getPosts', getAllPosts )
router.get('/myPosts/:id', getMyPosts )

module.exports = router; 