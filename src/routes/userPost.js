const express = require("express");
const { addPost, getMyPosts, getAllPosts, getPendingPosts } = require("../controllers/userPost");
const router = express.Router();

router.post('/addPost', addPost )
router.get('/getPosts', getAllPosts )
router.get('/myPosts/:id', getMyPosts )
router.get('/pendingPosts', getPendingPosts )

module.exports = router; 