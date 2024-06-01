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
        const myPost = await UserPost.find({owner: id});
        res.status(200).json({message: 'Posts found succesfully', myPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getPendingPosts =  async (req, res) => {
    try {
        const pendingPost = await UserPost.find({status: "Pending"});
        res.status(200).json({message: 'Pending Posts found succesfully', pendingPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

module.exports = {
    addPost,
    getAllPosts,
    getMyPosts,
    getPendingPosts
}
