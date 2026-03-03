const crypto = require("crypto");

const resolveFolderByFileKind = (fileKind, userId) => {
  const base = `cac/${userId}`;
  const map = {
    transport_profile_photo: `${base}/transport/profile`,
    transport_license_front: `${base}/transport/license`,
    transport_license_back: `${base}/transport/license`,
    transport_police_check_pdf: `${base}/transport/police-check`,
    transport_vehicle_general: `${base}/transport/vehicle`,
    transport_vehicle_cargo: `${base}/transport/vehicle`,
    post_item_photo: `${base}/posts`,
  };

  return map[fileKind];
};

const signParams = (params, apiSecret) => {
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  return crypto
    .createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
};

const buildUploadSignature = ({ fileKind, resourceType = "auto", userId }) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || null;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are missing in environment.");
  }

  const folder = resolveFolderByFileKind(fileKind, userId);
  if (!folder) throw new Error("Invalid file kind.");

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder,
    timestamp,
  };
  if (uploadPreset) {
    paramsToSign.upload_preset = uploadPreset;
  }

  const signature = signParams(paramsToSign, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    resourceType,
    uploadPreset,
  };
};

module.exports = {
  buildUploadSignature,
};
