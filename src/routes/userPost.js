const express = require("express");
const { addPost, getMyPosts, getAllPosts, getPendingPosts, addNewOffer, selectOffer, modifyStatus, addMessage, getMySelectedPosts } = require("../controllers/userPost");
const router = express.Router();

router.post('/addPost', addPost )
router.get('/getPosts', getAllPosts )
router.get('/myPosts/:id', getMyPosts )
router.get('/pendingPosts', getPendingPosts )
router.get('/getMySelectedPosts/:ownerId', getMySelectedPosts )
router.put('/addNewOffer',  addNewOffer)
router.patch('/selectOffer',  selectOffer)
router.patch('/modifyStatus',  modifyStatus)
router.patch('/addMessage/:postId',  addMessage)

module.exports = router; 