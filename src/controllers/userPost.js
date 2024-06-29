const { default: mongoose } = require("mongoose");
const UserPost = require("../models/UserPost");

const addPost = async(req, res) => {
    try {
        const newPost = new UserPost(req.body)
        await newPost.save();
        res.status(200).json({message: 'Post added successfully', newPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getAllPosts =  async (req, res) => {
    try {
        const postsList = await UserPost.find({isDelete: false}).populate("owner");
        res.status(200).json({message: 'Posts obtained correctly', postsList})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getMyPosts =  async (req, res) => {
    try {
        const {id} = req.params
        const myPost = await UserPost.find({owner: id}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name'
            }
          });
        res.status(200).json({message: 'Posts found succesfully', myPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getPendingPosts =  async (req, res) => {
    try {
        const pendingPost = await UserPost.find({status: "Pending"}).populate("owner");
        res.status(200).json({message: 'Pending Posts found succesfully', pendingPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const addNewOffer =  async (req, res) => {
    try {
        const {postId, newOfferId} = req.body
        const postFound = await UserPost.findById(postId);
        if (postFound) {
            const newOffersList = [...postFound.offers, newOfferId]
            const newPost = await UserPost.findByIdAndUpdate(postId, {offers: newOffersList}, {new: true})
            res.status(200).json({message: 'Offer sent succesfully', newPost})
        }
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const selectOffer = async(req, res) => {
    try {
        const {postId, offerSelected} = req.body
        console.log(postId, offerSelected)
        const postFound = await UserPost.findByIdAndUpdate(postId, {offerSelected}, {new:true})
        console.log(postFound)
        if (postFound) {
            res.status(200).json({message: 'Offer selected', postFound})
        }    
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
    
}

module.exports = {
    addPost,
    getAllPosts,
    getMyPosts,
    getPendingPosts,
    addNewOffer,
    selectOffer
}
