const express = require("express");
const { signUpload, deleteUploadAsset } = require("../controllers/uploads");
const { decodeToken } = require("../middlewares/auth");
const { verifyUploadSignFields, verifyUploadDeleteFields } = require("../middlewares/uploads");
const { validate } = require("../helpers/validate");

const router = express.Router();

router.post('/sign', decodeToken, verifyUploadSignFields(), validate, signUpload)
router.delete('/asset', decodeToken, verifyUploadDeleteFields(), validate, deleteUploadAsset)

module.exports = router;
