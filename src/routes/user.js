const express = require("express");
const { registerUser, loginUser, getUser, getAllUsers, verifyTransportFields, updateFields, updateReviews, acceptMyTerms, getImage, addCancelled, updateExpoPushToken, generateNewValidationCode, validateMail, checkValidationCode, updatePass, googleLogin, googleRegister , appleLogin, appleRegister,deleteMyAccount} = require("../controllers/user");
const { validate } = require("../helpers/validate");
const { verifyRegisterFields, verifyLoginFields, checkCancellations } = require("../middlewares/users");
const { decodeToken, maybeDecodeToken, adminRequiredValidation, decodeFirebaseToken } = require("../middlewares/auth");
const router = express.Router();

router.post('/register', verifyRegisterFields(), validate, registerUser);
router.post('/login', verifyLoginFields(), validate, loginUser);
router.post('/googleLogin', decodeFirebaseToken , googleLogin);
router.post('/googleRegister', decodeFirebaseToken , googleRegister);
router.post("/appleLogin", appleLogin);
router.post("/appleRegister", appleRegister);

router.delete("/me", decodeToken, deleteMyAccount);
router.post("/me/consents/terms", decodeToken, acceptMyTerms);


router.get('/verifyFields', decodeToken, verifyTransportFields);
router.patch('/updateFields', decodeToken, updateFields);
router.patch('/updateReviews/:id', decodeToken, updateReviews);

router.get('/dataUser', decodeToken, getUser);
router.get('/all', decodeToken, adminRequiredValidation, getAllUsers);

router.get('/getImage/:userId/:imageType', getImage);

router.patch('/addCancelation/:userId', decodeToken, checkCancellations, addCancelled);
router.patch('/updateExpoPushToken/:userId', decodeToken, updateExpoPushToken);
router.patch('/generateNewValidationCode/:userId?', maybeDecodeToken, generateNewValidationCode);
router.patch('/validateMail/:userId', decodeToken, validateMail);
router.patch('/checkValidationCode/:userId?', maybeDecodeToken, checkValidationCode);
router.patch('/updatePass/:userId?', maybeDecodeToken, updatePass);

module.exports = router; 
