const crypto = require("crypto");
const https = require("https");

const getCurrentYearMonth = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
};

const resolveFolderByFileKind = (fileKind, userId) => {
  const transportUserBase = `cac/profile/${userId}`;
  const postOwnerBase = `cac/posts/${getCurrentYearMonth()}`;

  const map = {
    transport_profile_photo: `${transportUserBase}/profile`,
    transport_license_front: `${transportUserBase}/license`,
    transport_license_back: `${transportUserBase}/license`,
    transport_police_check_pdf: `${transportUserBase}/police-check`,
    transport_vehicle_general: `${transportUserBase}/vehicle`,
    transport_vehicle_cargo: `${transportUserBase}/vehicle`,
    post_item_photo: `${postOwnerBase}`,
  };

  return map[fileKind];
};

const buildPostPublicId = (userId) => {
  const safeUserId = String(userId || "").trim();
  const nonce = crypto.randomBytes(4).toString("hex");
  return `${safeUserId}_${Date.now()}_${nonce}`;
};

const buildDescriptivePublicId = (prefix) => {
  const nonce = crypto.randomBytes(4).toString("hex");
  return `${prefix}__${Date.now()}_${nonce}`;
};

const buildPublicIdByFileKind = (fileKind, userId) => {
  const map = {
    transport_profile_photo: "profile",
    transport_license_front: "license_front",
    transport_license_back: "license_back",
    transport_police_check_pdf: "police_check",
    transport_vehicle_general: "vehicle_general",
    transport_vehicle_cargo: "vehicle_cargo",
  };

  if (fileKind === "post_item_photo") {
    return buildPostPublicId(userId);
  }

  const prefix = map[fileKind];
  if (!prefix) return null;
  return buildDescriptivePublicId(prefix);
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
  const assetFolder = folder;
  const publicId = buildPublicIdByFileKind(fileKind, userId);

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    asset_folder: assetFolder,
    folder,
    timestamp,
  };
  if (publicId) {
    paramsToSign.public_id = publicId;
  }
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
    assetFolder,
    publicId,
    resourceType,
    uploadPreset,
  };
};

const parseCloudinaryUrl = (secureUrl, expectedCloudName) => {
  if (!secureUrl || typeof secureUrl !== "string") return null;

  let parsed;
  try {
    parsed = new URL(secureUrl);
  } catch (_error) {
    return null;
  }

  const host = parsed.hostname || "";
  if (!host.includes("cloudinary.com")) return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  const uploadIdx = parts.indexOf("upload");
  if (uploadIdx < 2) return null;

  const cloudName = parts[0];
  if (expectedCloudName && cloudName !== expectedCloudName) return null;

  const resourceType = parts[uploadIdx - 1];
  const allowedResourceTypes = ["image", "raw", "video"];
  if (!allowedResourceTypes.includes(resourceType)) return null;

  const versionIdx = parts.findIndex((segment) => /^v\d+$/.test(segment));
  const publicPathStart = versionIdx > uploadIdx ? versionIdx + 1 : uploadIdx + 1;
  const publicPath = parts.slice(publicPathStart).join("/");
  if (!publicPath) return null;

  const publicId = publicPath.replace(/\.[^/.]+$/, "");
  if (!publicId) return null;

  return {
    publicId,
    resourceType,
  };
};

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertUserOwnsPublicId = (publicId, userId) => {
  const legacyPrefix = `cac/${userId}/`;
  const transportUserPrefix = `cac/profile/${userId}/`;
  const escapedUserId = escapeRegExp(String(userId));
  const postsLegacyPattern = new RegExp(`^cac/posts/\\d{6}/${escapedUserId}(/|$)`);
  const postsFlatPattern = new RegExp(`^cac/posts/\\d{6}/${escapedUserId}_`);

  const matchesOwnerFolder =
    publicId.startsWith(legacyPrefix) ||
    publicId.startsWith(transportUserPrefix) ||
    postsLegacyPattern.test(publicId) ||
    postsFlatPattern.test(publicId);

  if (!matchesOwnerFolder) {
    const error = new Error("Asset does not belong to current user.");
    error.code = 403;
    throw error;
  }
};

const postFormUrlEncoded = (url, bodyParams) =>
  new Promise((resolve, reject) => {
    const payload = new URLSearchParams(bodyParams).toString();
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Cloudinary destroy failed with status ${res.statusCode}.`));
          }
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (_error) {
            resolve({});
          }
        });
      },
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });

const deleteCloudinaryAsset = async ({ publicId, secureUrl, resourceType = "image", userId }) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are missing in environment.");
  }

  let resolvedPublicId = (publicId || "").trim();
  let resolvedResourceType = resourceType;

  if (!resolvedPublicId && secureUrl) {
    const parsed = parseCloudinaryUrl(secureUrl, cloudName);
    if (!parsed?.publicId) {
      const error = new Error("Invalid Cloudinary URL.");
      error.code = 400;
      throw error;
    }
    resolvedPublicId = parsed.publicId;
    resolvedResourceType = parsed.resourceType || resolvedResourceType;
  }

  if (!resolvedPublicId) {
    const error = new Error("Missing publicId or secureUrl.");
    error.code = 400;
    throw error;
  }

  assertUserOwnsPublicId(resolvedPublicId, userId);

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: resolvedPublicId,
    timestamp,
    invalidate: "true",
  };

  const signature = signParams(paramsToSign, apiSecret);
  const destroyUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resolvedResourceType}/destroy`;
  const result = await postFormUrlEncoded(destroyUrl, {
    public_id: resolvedPublicId,
    timestamp: String(timestamp),
    invalidate: "true",
    api_key: String(apiKey),
    signature,
  });

  return {
    publicId: resolvedPublicId,
    resourceType: resolvedResourceType,
    result: result?.result || "unknown",
  };
};

module.exports = {
  buildUploadSignature,
  deleteCloudinaryAsset,
};

