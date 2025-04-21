const { default: mongoose } = require("mongoose");
const UserPost = require("../models/UserPost");
const {shareNewPost, OfferSelected, notifyNewStatus} = require("./../socketIo")

const addPost = async(req, res) => {
    try {
        const post = req.body
        if (post._id) {
           const updatedPost = await UserPost.findByIdAndUpdate(post._id, post, {new:true}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          }).populate({
            path: 'transportCancel',    
            select: 'given_name'
          }).populate({
            path: 'owner',
            select: '-password'
        })
          shareNewPost(updatedPost)
           res.status(200).json({message: 'Post updated successfully', newPost: updatedPost})
        } else {
            const newPost = new UserPost(post);
            await newPost.save();
            const populatedPost = await UserPost.findById(newPost._id)
                .populate({
                    path: 'owner',
                    select: '-password'
                })
            shareNewPost(populatedPost)
            res.status(200).json({message: 'New Post added successfully', newPost})
        }
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
              select: 'given_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount',
            },
            select: "_id price post expiredTime offerDetails status"
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          }).populate({
            path: 'transportCancel',    
            select: 'given_name'
          })
        res.status(200).json({message: 'Posts found succesfully', myPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getPendingPosts =  async (req, res) => {
    try {
        const pendingPost = await UserPost.find({"status.mainStatus": "pending" }).populate({path: "owner", select: "-password"}).populate({
            path: "offers",
            select: "_id price post expiredTime offerDetails status",
            populate: {
                path: "owner",
                select: "given_name _id expoPushToken transportInfo.stripeAccount"
            }
        }).populate({
            path: 'transportCancel',    
            select: 'given_name'
          });
        res.status(200).json({message: 'Pending Posts found succesfully', pendingPost})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}


const getMySelectedPosts =  async (req, res) => {
    const { ownerId } = req.params
    try {
        const postsSelectedOffers = await UserPost.find({ offerSelected: { $ne: null } }).populate("offerSelected").populate({
            path: 'owner',
            model: 'User',
            select: 'given_name expoPushToken'
        });
        if (postsSelectedOffers) {
            const yourOfferSelectedPosts = postsSelectedOffers.filter(post => 
                 post.offerSelected.owner == ownerId
              );
              res.status(200).json({message: 'Your offer selected Posts found succesfully',yourOfferSelectedPosts })
            }
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const addNewOffer =  async (req, res) => {
    try {
        const {postId, newOfferId} = req.body
        const postFound = await UserPost.findById(postId);
        if (postFound) {
            const newPost = await UserPost.findByIdAndUpdate(postId, {$push: { offers: newOfferId }, "status.newOffers": true}, {new: true})
            res.status(200).json({message: 'Offer sent succesfully', newPost})
        }
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const modifyStatus =  async (req, res) => {
    try {
        const {postId, newStatus}= req.body
        const newPost = await UserPost.findByIdAndUpdate(postId, { $set: { status: { ...newStatus } } }, {new: true}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          });
          if (newPost.status.mainStatus === "inProgress" || newPost.status.mainStatus === "transportDone") {
            notifyNewStatus(newPost.owner, newPost)
          }
          if (newPost.status.mainStatus === "confirmed") {
            notifyNewStatus(newPost.offerSelected.owner._id, newPost)
          }
        res.status(200).json({message: 'Post updated succesfully', newPost})
       
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const selectOffer = async(req, res) => {
    try {
        const {postId, offerSelected} = req.body
        const postFound = await UserPost.findByIdAndUpdate(postId, {offerSelected, "status.mainStatus": "offerSelected", "status.offerAcepted": true}, {new:true}).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name expoPushToken review'
            }
          });
        if (postFound) {
            OfferSelected(postFound.offerSelected.owner._id, postFound)
            res.status(200).json({message: 'Offer selected', postFound})
        }    
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
    
}

const addMessage = async(req, res) => {
    try {
        const { postId } = req.params;
        const { sender, text } = req.body;

        const userPost = await UserPost.findById(postId);
        if (!userPost) {
            return res.status(404).json({ error: 'UserPost not found'});
        }
        const newMessage = {
            sender,
            text,
        };
        userPost.chatMessages = [newMessage, ...userPost.chatMessages];
        if (sender == userPost.owner) {
            userPost.status.messagesStatus.newUserMessage = true;
        } else userPost.status.messagesStatus.newTransportMessage= true;
        await userPost.save();
        const lastMessage = userPost.chatMessages[0];
        res.status(200).json({message: 'Message successfully added', message: lastMessage  })
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
    
}

const addComplaint = async(req, res) => {
    try {
        const { postId } = req.params;
        const { complaintText} = req.body;

        const newPost = await UserPost.findByIdAndUpdate(postId, {
            $set: {
                complaint: complaintText,
                'status.mainStatus': 'complaint',
                'status.newComplaint': true
            }
        } , {new: true}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name review expoPushToken'
            }
          });
        if (!newPost) {
            return res.status(404).json({ error: 'UserPost not found'});
        }
        res.status(200).json({message: 'Your complaint has been received. We will review the case and assist you. We will contact you by email as soon as possible',newPost })
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
    selectOffer,
    modifyStatus,
    addMessage,
    getMySelectedPosts,
    addComplaint
}
