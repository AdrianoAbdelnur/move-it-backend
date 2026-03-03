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

const RESOURCE_TYPES = ["image", "raw", "auto"];

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

module.exports = {
  verifyUploadSignFields,
  FILE_KINDS,
};
