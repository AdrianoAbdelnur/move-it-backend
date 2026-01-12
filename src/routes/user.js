const express = require("express");
const { registerUser, loginUser, getUser, getAllUsers, verifyTransportFields, updateFields, updateReviews, getImage, addCancelled, updateExpoPushToken, generateNewValidationCode, validateMail, checkValidationCode, updatePass, googleLogin, googleRegister , appleLogin, appleRegister,deleteMyAccount} = require("../controllers/user");
const { validate } = require("../helpers/validate");
const { verifyRegisterFields, verifyLoginFields, checkCancellations } = require("../middlewares/users");
const { decodeToken, adminRequiredValidation, decodeFirebaseToken } = require("../middlewares/auth");
const router = express.Router();

router.post('/register', verifyRegisterFields(), validate, registerUser);
router.post('/login', verifyLoginFields(), validate, loginUser);
router.post('/googleLogin', decodeFirebaseToken , googleLogin);
router.post('/googleRegister', decodeFirebaseToken , googleRegister);
router.post("/appleLogin", appleLogin);
router.post("/appleRegister", appleRegister);

router.delete("/me", decodeToken, deleteMyAccount);


router.get('/verifyFields', decodeToken, verifyTransportFields);
router.patch('/updateFields', decodeToken, updateFields);
router.patch('/updateReviews/:id', updateReviews);

router.get('/dataUser', decodeToken, getUser);
router.get('/all', decodeToken, adminRequiredValidation, getAllUsers);

router.get('/getImage/:userId/:imageType', getImage);

router.patch('/addCancelation/:userId',checkCancellations, addCancelled);
router.patch('/updateExpoPushToken/:userId',updateExpoPushToken);
router.patch('/generateNewValidationCode/:userId?',generateNewValidationCode);
router.patch('/validateMail/:userId',validateMail);
router.patch('/checkValidationCode/:userId?',checkValidationCode);
router.patch('/updatePass/:userId?',updatePass);

module.exports = router; 