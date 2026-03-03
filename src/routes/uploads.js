const express = require("express");
const { signUpload } = require("../controllers/uploads");
const { decodeToken } = require("../middlewares/auth");
const { verifyUploadSignFields } = require("../middlewares/uploads");
const { validate } = require("../helpers/validate");

const router = express.Router();

router.post('/sign', decodeToken, verifyUploadSignFields(), validate, signUpload)

module.exports = router;
