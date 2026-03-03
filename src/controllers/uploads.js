const { buildUploadSignature } = require("../services/cloudinary");

const signUpload = async (req, res) => {
  try {
    const { fileKind, resourceType = "auto" } = req.body;

    const signedPayload = buildUploadSignature({
      fileKind,
      resourceType,
      userId: req.userId,
    });

    return res.status(200).json({
      message: "Upload signature generated successfully.",
      ...signedPayload,
    });
  } catch (error) {
    return res.status(error.code || 500).json({ message: error.message });
  }
};

module.exports = {
  signUpload,
};
