const { body } = require("express-validator");

const FILE_KINDS = [
  "transport_profile_photo",
  "transport_license_front",
  "transport_license_back",
  "transport_police_check_pdf",
  "transport_vehicle_general",
  "transport_vehicle_cargo",
  "post_item_photo",
];

const RESOURCE_TYPES = ["image", "raw", "auto", "video"];

const verifyUploadSignFields = () => {
  return [
    body("fileKind")
      .isString()
      .notEmpty()
      .isIn(FILE_KINDS)
      .withMessage("Invalid file kind."),
    body("resourceType")
      .optional()
      .isString()
      .isIn(RESOURCE_TYPES)
      .withMessage("Invalid resource type."),
  ];
};

const verifyUploadDeleteFields = () => {
  return [
    body("publicId")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Invalid publicId."),
    body("secureUrl")
      .optional()
      .isString()
      .trim()
      .isURL({ require_protocol: true })
      .withMessage("Invalid secureUrl."),
    body("resourceType")
      .optional()
      .isString()
      .isIn(RESOURCE_TYPES)
      .withMessage("Invalid resource type."),
    body().custom((value, { req }) => {
      if (!req.body?.publicId && !req.body?.secureUrl) {
        throw new Error("publicId or secureUrl is required.");
      }
      return true;
    }),
  ];
};

module.exports = {
  verifyUploadSignFields,
  verifyUploadDeleteFields,
  FILE_KINDS,
};
