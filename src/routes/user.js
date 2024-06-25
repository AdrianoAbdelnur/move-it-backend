const express = require("express");
const { addUser, registerUser, loginUser, getUser, getAllUsers, verifyTransportFields, updateField } = require("../controllers/user");
const { validate } = require("../helpers/validate");
const { verifyRegisterFields, verifyLoginFields } = require("../middlewares/users");
const { decodeToken, adminRequiredValidation } = require("../middlewares/auth");
const router = express.Router();

router.post('/register', verifyRegisterFields(), validate, registerUser);
router.post('/login', verifyLoginFields(), validate, loginUser);

router.get('/verifyFields', decodeToken, verifyTransportFields);
router.patch('/updateOwnUser', decodeToken, updateField);

router.get('/dataUser', decodeToken, getUser);
router.get('/all', decodeToken, adminRequiredValidation, getAllUsers);

module.exports = router; 