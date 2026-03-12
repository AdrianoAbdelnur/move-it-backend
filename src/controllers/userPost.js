const { default: mongoose } = require("mongoose");
const UserPost = require("../models/UserPost");
const Offer = require("../models/Offer");
const { expirePendingOffers } = require("./offer");
const {shareNewPost, OfferSelected, notifyNewStatus} = require("./../socketIo")

const expirePendingPosts = async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await UserPost.updateMany(
        {
            "status.mainStatus": "pending",
            "date.date": { $lt: startOfToday },
        },
        {
            $set: { "status.mainStatus": "expired" },
        }
    );
};

const addPost = async(req, res) => {
    try {
        const post = req.body
        if (post._id) {
           const currentPost = await UserPost.findById(post._id).select("owner");
           if (!currentPost) return res.status(404).json({ message: "Post not found" });
           if (String(currentPost.owner) !== String(req.userId) && String(req.userRole) !== "admin") {
             return res.status(403).json({ message: "Unauthorized" });
           }
           const updatedPost = await UserPost.findByIdAndUpdate(post._id, post, {new:true}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
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
            if (String(post?.owner || "") !== String(req.userId || "") && String(req.userRole) !== "admin") {
              return res.status(403).json({ message: "Unauthorized" });
            }
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
        await expirePendingPosts();
        await expirePendingOffers();
        const postsList = await UserPost.find({isDelete: false}).populate("owner");
        res.status(200).json({message: 'Posts obtained correctly', postsList})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getMyPosts =  async (req, res) => {
    try {
        await expirePendingPosts();
        await expirePendingOffers();
        const {id} = req.params
        if (String(id) !== String(req.userId) && String(req.userRole) !== "admin") {
          return res.status(403).json({ message: "Unauthorized" });
        }
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
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
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
        await expirePendingPosts();
        await expirePendingOffers();
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
        await expirePendingPosts();
        await expirePendingOffers();
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
        const offerFound = await Offer.findById(newOfferId).select("owner post");
        if (!offerFound) return res.status(404).json({ message: "Offer not found" });
        if (String(offerFound.owner) !== String(req.userId) && String(req.userRole) !== "admin") {
          return res.status(403).json({ message: "Unauthorized" });
        }
        if (String(offerFound.post) !== String(postId)) {
          return res.status(409).json({ message: "Offer does not belong to post." });
        }
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
        const targetPost = await UserPost.findById(postId)
          .select("owner offerSelected")
          .populate({
            path: "offerSelected",
            select: "owner",
          });
        if (!targetPost) return res.status(404).json({ message: "Post not found" });

        const postOwnerId = String(targetPost.owner || "");
        const selectedOfferOwnerId = String(targetPost?.offerSelected?.owner || "");
        const requesterId = String(req.userId || "");
        const isAdmin = String(req.userRole) === "admin";
        const canActOnPost = isAdmin || requesterId === postOwnerId || requesterId === selectedOfferOwnerId;
        if (!canActOnPost) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        if (newStatus?.mainStatus === "confirmed") {
          if (requesterId !== postOwnerId && !isAdmin) {
            return res.status(403).json({ message: "Only the post owner can confirm the service." });
          }
          if (!targetPost?.offerSelected) {
            return res.status(409).json({ message: "Cannot confirm service without selected offer." });
          }

          const selectedOfferId = targetPost?.offerSelected?._id || targetPost?.offerSelected;
          const offer = await Offer.findById(selectedOfferId).select("payment");
          const paymentState = offer?.payment?.state || (offer?.payment?.released ? "transferred" : "pending");
          if (paymentState !== "transferred") {
            return res.status(409).json({
              message: `Cannot confirm service while payment state is '${paymentState}'.`,
            });
          }
        }

        const newPost = await UserPost.findByIdAndUpdate(postId, { $set: { status: { ...newStatus } } }, {new: true}).populate({
            path: 'offers',
            populate: {
              path: 'owner',
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
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
        const post = await UserPost.findById(postId).select("owner");
        if (!post) return res.status(404).json({ message: "Post not found" });
        if (String(post.owner) !== String(req.userId) && String(req.userRole) !== "admin") {
          return res.status(403).json({ message: "Unauthorized" });
        }
        const selectedOffer = await Offer.findById(offerSelected).select("post");
        if (!selectedOffer) return res.status(404).json({ message: "Offer not found" });
        if (String(selectedOffer.post) !== String(postId)) {
          return res.status(409).json({ message: "Offer does not belong to post." });
        }

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

        const userPost = await UserPost.findById(postId).populate({
          path: "offerSelected",
          select: "owner",
        });
        if (!userPost) {
            return res.status(404).json({ error: 'UserPost not found'});
        }
        const requesterId = String(req.userId || "");
        const canSendMessage =
          String(req.userRole) === "admin" ||
          requesterId === String(userPost.owner || "") ||
          requesterId === String(userPost?.offerSelected?.owner || "");
        if (!canSendMessage) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        if (String(sender || "") !== requesterId && String(req.userRole) !== "admin") {
          return res.status(403).json({ message: "Invalid sender." });
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
        const currentPost = await UserPost.findById(postId).populate({
          path: "offerSelected",
          select: "owner",
        });
        if (!currentPost) {
          return res.status(404).json({ error: 'UserPost not found'});
        }
        const requesterId = String(req.userId || "");
        const canComplain =
          String(req.userRole) === "admin" ||
          requesterId === String(currentPost.owner || "") ||
          requesterId === String(currentPost?.offerSelected?.owner || "");
        if (!canComplain) {
          return res.status(403).json({ message: "Unauthorized" });
        }

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
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
            }
          }).populate({
            path: 'offerSelected',
            populate: {
              path: 'owner',
              select: 'given_name family_name review expoPushToken transportInfo.vehicle transportInfo.stripeAccount'
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
