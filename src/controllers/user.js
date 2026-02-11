const User = require('../models/User');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailer = require('../helpers/emailer');
require('dotenv').config();
const crypto = require('crypto');
const { getTermsStatus, TERMS_VERSION } = require("../helpers/terms");

const { URL } = require("url");

let josePromise = null;
let appleJwks = null;

function getJose() {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

async function getAppleJwks() {
  if (appleJwks) return appleJwks;
  const { createRemoteJWKSet } = await getJose();
  appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
  return appleJwks;
}

async function verifyAppleIdentityToken(identityToken) {
  const { jwtVerify } = await getJose();
  const jwks = await getAppleJwks();
  const { payload } = await jwtVerify(identityToken, jwks, {
    issuer: "https://appleid.apple.com",
    audience: "com.adna88.CaCapp",
  });
  return payload;
}
const registerUser = async (req, res) => {
    try {
        const verificationCode = crypto.randomBytes(6).toString('hex').slice(0, 6).toUpperCase();
        const currentTime = new Date();
        const expirationTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
        const salt = await bcryptjs.genSalt(10);
        const encryptedPassword = await bcryptjs.hash(req.body.password, salt)
        const userToRegister = {
            ...req.body,
            password: encryptedPassword,
            verificationInfo:{
                verificationCode,
                expirationTime,
            }
        }
        const newUser = new User(userToRegister);
        await newUser.save();
        emailer.sendMail(newUser);
        res.status(200).json({ message: 'User successfully created.' })
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userFound = await User.findOne({ email, isDeleted: false });
    if (!userFound) return res.status(400).json({ message: "Incorrect user credentials." });

    const loginSucceed = await bcryptjs.compare(password, userFound?.password);
    if (!loginSucceed) return res.status(400).json({ message: "Incorrect user credentials." });

    const payload = { user: { id: userFound._id, role: userFound.role } };
    const termsStatus = getTermsStatus(userFound);

    jwt.sign(payload, process.env.SECRET_WORD, (error, token) => {
      if (error) throw error;
      return res.status(200).json({
        message: "User successfully logged in.",
        token,
        ...termsStatus,
      });
    });
  } catch (error) {
    return res.status(error.code || 500).json({ message: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userFound = await User.findOne({ email: userEmail });

    if (!userFound) return res.status(404).json({ message: "User not found." });
    if (userFound.isDeleted === true) return res.status(400).json({ message: "User was deleted." });

    const payload = { user: { id: userFound._id, role: userFound.role } };
    const termsStatus = getTermsStatus(userFound);

    jwt.sign(payload, process.env.SECRET_WORD, (error, token) => {
      if (error) throw error;
      return res.status(200).json({
        message: "User successfully logged in.",
        token,
        ...termsStatus,
      });
    });
  } catch (error) {
    return res.status(error.code || 500).json({ message: error.message });
  }
};

const googleRegister = async (req, res) => {
    try {
        const user = req.user
        const userToRegister = {
            role: req.body.role,
            given_name: req.user.given_name,
            family_name: req.user.family_name,
            email: req.user.email,
            validatedMail: true
        }
        const newUser = new User(userToRegister);
        await newUser.save();
        res.status(200).json({ message: 'User successfully created.' })
    } catch (error) {
        return res.status(error.code || 500).json({ message: error.message })
    }
}

    const appleLogin = async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) return res.status(400).json({ message: "Missing identityToken." });

    const payload = await verifyAppleIdentityToken(identityToken);

    const appleSub = payload.sub;
    const email = payload.email;

    if (!appleSub) return res.status(400).json({ message: "Invalid Apple token (missing sub)." });

    let userFound = await User.findOne({ appleSub, isDeleted: false });

    if (!userFound && email) {
      userFound = await User.findOne({ email, isDeleted: false });
      if (userFound) {
        userFound.appleSub = appleSub;
        if (userFound.validatedMail !== true) userFound.validatedMail = true;
        await userFound.save();
      }
    }

    if (!userFound) {
      const given_name = fullName?.givenName || "";
      const family_name = fullName?.familyName || "";
      return res.status(404).json({
        message: "User not found.",
        user: { email: email || "", given_name, family_name, appleSub },
      });
    }

    const tokenPayload = { user: { id: userFound._id, role: userFound.role } };
    const termsStatus = getTermsStatus(userFound);

    jwt.sign(tokenPayload, process.env.SECRET_WORD, (error, token) => {
      if (error) throw error;
      return res.status(200).json({
        message: "User successfully logged in.",
        token,
        ...termsStatus,
      });
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid Apple token." });
  }
};

    const appleRegister = async (req, res) => {
        try {
            const { identityToken, fullName, role } = req.body;

            if (!identityToken) return res.status(400).json({ message: "Missing identityToken." });
            if (!role) return res.status(400).json({ message: "Missing role." });

           const payload = await verifyAppleIdentityToken(identityToken);

            const appleSub = payload.sub;
            const email = payload.email;

            if (!appleSub) return res.status(400).json({ message: "Invalid Apple token (missing sub)." });

            if (!email) {
            return res.status(400).json({
                message:
                "Apple did not provide an email address. Please try again or use another login method.",
            });
            }

            const already = await User.findOne({
            $or: [{ appleSub }, { email }],
            isDeleted: false,
            });

            if (already) return res.status(400).json({ message: "User already exists." });

            const userToRegister = {
            role,
            email,
            validatedMail: true,
            appleSub,
            };

            if (fullName?.givenName) userToRegister.given_name = fullName.givenName;
            if (fullName?.familyName) userToRegister.family_name = fullName.familyName;

            await new User(userToRegister).save();
            return res.status(200).json({ message: "User successfully created." });
        } catch (error) {
            return res.status(401).json({ message: "Invalid Apple token." });
        }
};


    const deleteMyAccount = async (req, res) => {
        try {
            const user = await User.findById(req.userId);
            if (!user) return res.status(404).json({ message: "User not found." });
            if (user.isDeleted) return res.status(400).json({ message: "User already deleted." });

            const rand = crypto.randomBytes(8).toString("hex");
            const deletedEmail = `deleted+${user._id.toString()}+${rand}@callacar.invalid`;

            await User.updateOne(
            { _id: req.userId },
            {
                $set: {
                isDeleted: true,
                email: deletedEmail,
                validatedMail: false,
                appleSub: null,
                expoPushToken: null,
                given_name: "Deleted",
                family_name: "User",
                infoCompletedFlag: false,
                authorizedTransport: false,
                verificationInfo: {
                    verificationCode: null,
                    expirationTime: null,
                    attempts: 0,
                    blockTime: null,
                    isPermanentlyBlocked: false,
                },
                "transportInfo.stripeAccount.accountId": null,
                "transportInfo.stripeAccount.validatedAccount": false,
                },
                $unset: {
                "transportInfo.cargoAreaImg": "",
                "transportInfo.generalImg": "",
                "transportInfo.licenseFrontImg": "",
                "transportInfo.licenseBackImg": "",
                "transportInfo.profilePhotoImg": "",
                "transportInfo.policeCheckPdf": "",
                },
            }
            );

            return res.status(200).json({ message: "Account deleted." });
        } catch (error) {
            return res.status(error.code || 500).json({ message: error.message });
        }
};





const getUser = async (req, res) => {
    try {
        const userFound = await User.findById(req.userId).select('-password -transportInfo.generalImg -transportInfo.policeCheckPdf -transportInfo.cargoAreaImg -transportInfo.licenseFrontImg -transportInfo.licenseBackImg --transportInfo.profilePhotoImg -transportInfo.profilePhotoImg' );
        if (!userFound) return res.status(400).json({ message: 'User not found' });
        res.status(200).json({ message: 'User data found successfully', userFound });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 2, paginated = true } = req.query;
        const usersCount = await User.countDocuments();
        const pagesCount = Math.ceil(usersCount / limit);
        const skip = (page - 1) * limit;
        if (page > pagesCount) return res.status(400).json({ message: 'pagina no encontrada' });
        if (!paginated) {
            const usersFound = await User.find({ isDeleted: false }).select('-password -deleted -profilePicture');
            if (usersFound.length === 0) return res.status(400).json({ message: 'lista de usuarios vacia' });
            return res.status(200).json({ message: 'usuarios extraidos de forma exitosa', users: usersFound })
        }

        const usersFound = await User.find({ isDeleted: false }).skip(skip).limit(limit).select('-password  -deleted -profileImg').populate('role');
        if (usersFound.length === 0) return res.status(400).json({ message: 'lista de usuarios vacia' });
        return res.status(200).json({
            message: 'usuarios extraidos de forma exitosa',
            usersCount,
            pagesCount,
            currentPage: page,
            users: usersFound
        });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userToDelete = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).select('-password -_id -role -createdAt -profilePicture');
        if (!userToDelete) return res.status(400).json({ message: 'usuario no encontrado' });
        res.status(200).json({ message: 'User successfully deleted.', userToDelete });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const updateFields = async (req, res) => {
    try {
        const updateFields = {};
        for (const [field, value] of Object.entries(req.body)) {
            updateFields[`transportInfo.${field}`] = value;
        }
        const updatedUser = await User.findByIdAndUpdate(req.userId, { $set: updateFields }, { new: true }).select('-password' );
        let allFilled = true;
        for (const [key, value] of Object.entries(updatedUser.transportInfo)) {
            if (key === 'stripeAccount') {
                if (!value || value.validatedAccount !== true) {
                    allFilled = false;
                    break;
                }
            } else if (!value) {
                allFilled = false;
                break;
            }
        }
        
        if (allFilled) {
            updatedUser.infoCompletedFlag = true;
            await updatedUser.save();
        }
        let transportInfoStatus = {};
        for (const [key, value] of Object.entries(updatedUser.transportInfo)) {
            transportInfoStatus[key] = value? true : false;
        }
        transportInfoStatus={
            infoCompletedFlag: updatedUser.infoCompletedFlag,
            transportInfo:{
                ...transportInfoStatus, 
                vehicle: updatedUser.transportInfo.vehicle, 
                registrationPlate:updatedUser.transportInfo.registrationPlate, 
                stripeAccount: updatedUser.transportInfo.stripeAccount,
                ABN: updatedUser.transportInfo.ABN
            }
        }
        res.status(200).json({ message: "User's data uploaded successfully.", transportInfoStatus });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json({ message: "User's data successfully edited.", user: updatedUser });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message });
    }
};

const loginStatus = (req, res) => {
    try {
        return res.status(200).json({ message: 'user is still logged', isLogged: true, role: req.userRole.name })
    } catch (error) {
        return res.status(error.code || 500).json({ message: error.message });
    }
}

const verifyTransportFields = async(req,res) => {
    try {
        const userFound = await User.findById(req.userId).select('-password');
        if (!userFound) return res.status(400).json({ message: 'User Not Found' });
        let transportInfoStatus = {};
        for (const [key, value] of Object.entries(userFound.transportInfo)) {
            transportInfoStatus[key] = value? true : false;
        }
        transportInfoStatus= {
            ...transportInfoStatus, 
            vehicle: userFound.transportInfo.vehicle, 
            registrationPlate: userFound.transportInfo.registrationPlate ,
            ABN: userFound.transportInfo.ABN,
            stripeAccount: userFound.transportInfo.stripeAccount,
        }
        res.status(200).json({ message: 'Data successfully obtained', transportInfoStatus });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}


const acceptMyTerms = async (req, res) => {
  try {
    const userFound = await User.findById(req.userId);
    if (!userFound) return res.status(404).json({ message: "User not found." });

    userFound.consents = userFound.consents || {};
    userFound.consents.terms = {
      accepted: true,
      acceptedAt: new Date(),
      version: TERMS_VERSION,
      source: req.body?.source || "modal",
    };

    await userFound.save();

    return res.status(200).json({
      message: "Terms accepted.",
      mustAcceptTerms: false,
      currentTermsVersion: TERMS_VERSION,
      userTermsVersion: TERMS_VERSION,
    });
  } catch (error) {
    return res.status(error.code || 500).json({ message: error.message });
  }
};

const getImage = async(req,res) => {
    const { userId, imageType } = req.params;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        let imageData;
        switch (imageType) {
            case "cargoAreaImg":
                imageData = user.transportInfo.cargoAreaImg;
                break;
            case 'generalImg':
                imageData = user.transportInfo.generalImg;
                break;
            case 'profilePhotoImg':
                imageData = user.transportInfo.profilePhotoImg;
                break;
            default:
                return res.status(400).json({ message: 'Invalid image type' });
        }
        if(imageData) {
            res.status(200).json({ message: 'Image obtained', imageData });
        }

    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const updateReviews = async(req,res) => {
    try {
        const userId = req.params.id;
        const { punctualityRating, comunicationRating, generalServiceRating, review } = req.body;
        const user = await User.findById(userId).select('-password -transportInfo.generalImg -transportInfo.policeCheckPdf -transportInfo.cargoAreaImg -transportInfo.licenseFrontImg -transportInfo.licenseBackImg --transportInfo.profilePhotoImg -transportInfo.profilePhotoImg' );
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        if (user.review.punctualityRating === undefined) user.review.punctualityRating = 0;
        if (user.review.comunicationRating === undefined) user.review.comunicationRating = 0;
        if (user.review.generalServiceRating === undefined) user.review.generalServiceRating = 0;

        const reviewsQuantity = user.review.reviewsQuantity || 0;
        if (punctualityRating !== undefined) {
            const totalPunctuality = (user.review.punctualityRating * user.review.reviewsQuantity) + punctualityRating;
            user.review.punctualityRating = totalPunctuality / (user.review.reviewsQuantity + 1);
        }
          if (comunicationRating !== undefined) {
            const totalComunication = (user.review.comunicationRating * user.review.reviewsQuantity) + comunicationRating;
            user.review.comunicationRating = totalComunication / (user.review.reviewsQuantity + 1);
          }
          if (generalServiceRating !== undefined) {
            const totalGeneralService = (user.review.generalServiceRating * user.review.reviewsQuantity) + generalServiceRating;
            user.review.generalServiceRating = totalGeneralService / (user.review.reviewsQuantity + 1);
          }
          if (review !== undefined && review!=="") user.review.review = [review,...user.review.review];
          user.review.reviewsQuantity += 1;
          
          await user.save();
      
          res.status(200).json({ message: 'Reviews updated and averaged successfully', user });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const addCancelled = async(req,res) => {
    try {
        const {suspension} = req
        if (req.recentCancellations >= 3) {
            return res.status(200).json({ message: "User has more than 3 cancellations in the last 3 months. Transport authorization revoked.", suspension});
        }
        res.status(200).json({ message: "Cancellation info added successfully", suspension: null  });       
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const updateExpoPushToken = async(req, res) => {
    try {
        const {userId} = req.params
        const {newExpoPushToken} = req.body;
        const userFound = await User.findByIdAndUpdate(userId, { expoPushToken: newExpoPushToken }, { new: true });
        if (!userFound) return res.status(400).json({ message: 'User not found' });
        res.status(200).json({ message: 'User successfully updated.', userFound });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const generateNewValidationCode = async(req, res) => {
    try {
        const {userId} = req.params
        const { email } = req.body;
        
        const verificationCode = crypto.randomBytes(6).toString('hex').slice(0, 6).toUpperCase();
        const currentTime = new Date();
        const expirationTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
        
        
        let userFound;
        if(userId) {
            userFound = await User.findByIdAndUpdate(userId, {verificationInfo : {verificationCode,expirationTime, attempts : 0 }}, { new: true });
        } else if (email) {
            userFound = await User.findOneAndUpdate({ email }, {
                verificationInfo: { verificationCode, expirationTime, attempts: 0 }
            }, { new: true });
        }
        
        if (!userFound) return res.status(400).json({ message: 'User not found' });
        
        emailer.sendMail(userFound);
    
        res.status(200).json({ message: 'New code generated successfully.'});
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const checkValidationCode = async(req, res) => {
    try {
        const {userId} = req.params
        const { email, verificationCode } = req.body;
        
        let userFound;
        if(userId) {
            userFound = await User.findById(userId, );
        } else if (email) {
            userFound = await User.findOne( {email} );
        }
        if (!userFound) return res.status(400).json({ message: 'User not found' });
        
        if (userFound.verificationInfo.isPermanentlyBlocked) {
            return res.status(403).json({ message: 'The account is permanently blocked. Please contact support.' });
        }
        if (userFound.verificationInfo.blockTime && new Date() < new Date(userFound.verificationInfo.blockTime)) {
            return res.status(403).json({ message: 'Too many failed attempts. Please wait a few minutes before trying again.' });
        }
        if (new Date(userFound.verificationInfo.expirationTime) < new Date()) {
           return res.status(410).json({ message: 'The verification code has expired.' });           
        } 
        if (userFound.verificationInfo.verificationCode === verificationCode) {
            return res.status(200).json({ message: 'Code verified succesfully.'});
        } else {
            userFound.verificationInfo.attempts += 1;  
            
            if (userFound.verificationInfo.attempts >= 3) {
                if(userFound.verificationInfo.blockTime === null) {
                userFound.verificationInfo.blockTime = new Date(Date.now() + 10 * 60 * 1000)
                userFound.verificationInfo.attempts =0;
                } else {
                    userFound.verificationInfo.isPermanentlyBlocked = true;
                }
            }
            await userFound.save();
            return res.status(400).json({
                message: userFound.verificationInfo.isPermanentlyBlocked
                    ?'Your account is permanently blocked. Please contact support.':
                    userFound.verificationInfo.blockTime && new Date() < new Date(userFound.verificationInfo.blockTime)
                    ?'Too many failed attempts. Please wait before trying again.'
                    : 'Invalid verification code.'
            });
        }

    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }

}

const validateMail = async(req, res) => {
    try {
        const {userId} = req.params
        const {verificationCode} = req.body
        const userFound = await User.findById(userId);
        if (!userFound) return res.status(400).json({ message: 'User not found' });
        if (userFound.verificationInfo.isPermanentlyBlocked) {
            return res.status(403).json({ message: 'Your account is permanently blocked. Please contact support.' });
        }
        if (userFound.verificationInfo.blockTime && new Date() < new Date(userFound.verificationInfo.blockTime)) {
            return res.status(403).json({ message: 'Too many failed attempts. Please wait a few minutes before trying again.' });
        }
        if (new Date(userFound.verificationInfo.expirationTime) < new Date()) {
           return res.status(410).json({ message: 'The verification code has expired.' });           
        } 
        if (userFound.verificationInfo.verificationCode === verificationCode) {
            userFound.validatedMail = true
            await userFound.save()
            return res.status(200).json({ message: 'Email validated successfully.', userFound});
        } else {
            userFound.verificationInfo.attempts += 1;  
            
            if (userFound.verificationInfo.attempts >= 3) {
                if(userFound.verificationInfo.blockTime === null) {
                userFound.verificationInfo.blockTime = new Date(Date.now() + 10 * 60 * 1000)
                userFound.verificationInfo.attempts =0;
            } else {
                    userFound.verificationInfo.isPermanentlyBlocked = true;
                }
            }
            await userFound.save();
            return res.status(400).json({
                message: userFound.verificationInfo.isPermanentlyBlocked
                    ?'Your account is permanently blocked. Please contact support.':
                    userFound.verificationInfo.blockTime && new Date() < new Date(userFound.verificationInfo.blockTime)
                    ?'Too many failed attempts. Please wait before trying again.'
                    : 'Invalid verification code.'
            });
        }
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

const updatePass = async(req, res) => {
    try {
        const {userId} = req.params
        const { email , verificationCode, password} = req.body;
        const salt = await bcryptjs.genSalt(10);
        const encryptedPassword = await bcryptjs.hash(password, salt)
        let userFound;
        if(userId) {
            userFound = await User.findById(userId, );
        } else if (email) {
            userFound = await User.findOne( {email} );
        }
        if (!userFound) return res.status(400).json({ message: 'User not found' });

        if (userFound.verificationInfo.verificationCode === verificationCode) {
            userFound.password = encryptedPassword;
            userFound.save()
            return res.status(200).json({ message: 'password updated successfully.'});
        }


    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
    
}

module.exports = {
    registerUser,
    loginUser,
    getUser,
    getAllUsers,
    deleteMyAccount,
    deleteUser,
    updateUser,
    loginStatus,
    updateFields,
    verifyTransportFields,
    updateReviews,
    acceptMyTerms,
    getImage,
    addCancelled,
    updateExpoPushToken,
    generateNewValidationCode,
    validateMail,
    checkValidationCode,
    updatePass,
    googleLogin,
    googleRegister,
    appleLogin,
    appleRegister
}