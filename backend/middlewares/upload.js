const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

function fileFilter(req, file, cb) {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.mimetype);

  if (!isImage && !isDocument) {
    return cb(new Error("Unsupported file type"), false);
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE, // sabse bada allowed limit — per-type check controller mein
  },
});

module.exports = upload;
module.exports.MAX_IMAGE_SIZE = MAX_IMAGE_SIZE;
module.exports.MAX_DOCUMENT_SIZE = MAX_DOCUMENT_SIZE;
module.exports.ALLOWED_IMAGE_TYPES = ALLOWED_IMAGE_TYPES;
module.exports.ALLOWED_DOCUMENT_TYPES = ALLOWED_DOCUMENT_TYPES;