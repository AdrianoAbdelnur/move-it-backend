const express = require("express");
const { addPost, getMyPosts, getAllPosts, getPendingPosts, addNewOffer, selectOffer, modifyStatus, addMessage, getMySelectedPosts, addComplaint } = require("../controllers/userPost");
const { decodeToken } = require("../middlewares/auth");
const router = express.Router();

router.post('/addPost', decodeToken, addPost )
router.get('/getPosts', decodeToken, getAllPosts )
router.get('/myPosts/:id', decodeToken, getMyPosts )
router.get('/pendingPosts', decodeToken, getPendingPosts )
router.get('/getMySelectedPosts/:ownerId', decodeToken, getMySelectedPosts )
router.put('/addNewOffer', decodeToken, addNewOffer)
router.patch('/selectOffer', decodeToken, selectOffer)
router.patch('/modifyStatus', decodeToken, modifyStatus)
router.patch('/addMessage/:postId', decodeToken, addMessage)
router.patch('/addComplaint/:postId', decodeToken, addComplaint)

module.exports = router; 
