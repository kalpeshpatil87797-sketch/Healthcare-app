const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
// Patient ↔ Doctor chat attachments: images + PDF only. Executables and
// other document types (doc/docx/txt/...) are intentionally rejected.
const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];
const ALLOWED_DOCUMENT_EXTS = [".pdf"];

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
  const ext = path.extname(file.originalname || "").toLowerCase();
  const isImage =
    ALLOWED_IMAGE_TYPES.includes(file.mimetype) && ALLOWED_IMAGE_EXTS.includes(ext);
  const isDocument =
    ALLOWED_DOCUMENT_TYPES.includes(file.mimetype) && ALLOWED_DOCUMENT_EXTS.includes(ext);

  if (!isImage && !isDocument) {
    const err = new Error("This file type is not supported.");
    err.code = "UNSUPPORTED_FILE_TYPE";
    return cb(err, false);
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
module.exports.ALLOWED_IMAGE_EXTS = ALLOWED_IMAGE_EXTS;
module.exports.ALLOWED_DOCUMENT_EXTS = ALLOWED_DOCUMENT_EXTS;