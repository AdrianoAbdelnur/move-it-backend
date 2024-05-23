const express = require("express");
const { addUser, registerUser, loginUser, getUser, getAllUsers } = require("../controllers/user");
const { validate } = require("../helpers/validate");
const { verifyRegisterFields, verifyLoginFields } = require("../middlewares/users");
const { decodeToken, adminRequiredValidation } = require("../middlewares/auth");
const router = express.Router();

router.post('/register', verifyRegisterFields(), validate, registerUser);
router.post('/login', verifyLoginFields(), validate, loginUser);

router.get('/dataUser', decodeToken, getUser);
router.get('/all', decodeToken, adminRequiredValidation, getAllUsers);

module.exports = router; 