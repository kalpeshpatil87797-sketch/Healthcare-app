const path = require("path");

const MAX_REPORT_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REPORT_PDF_SIZE = 10 * 1024 * 1024;

const REPORT_TYPES = {
  ".jpg": { mimeType: "image/jpeg", fileType: "image" },
  ".jpeg": { mimeType: "image/jpeg", fileType: "image" },
  ".png": { mimeType: "image/png", fileType: "image" },
  ".pdf": { mimeType: "application/pdf", fileType: "document" },
};

function getMedicalReportType(file) {
  const extension = path.extname(file?.originalname ?? "").toLowerCase();
  const type = REPORT_TYPES[extension];
  return type && type.mimeType === file?.mimetype ? type : null;
}

function validateMedicalReport(file) {
  const type = getMedicalReportType(file);
  if (!type) return { error: "Upload a JPG, PNG, or PDF medical report." };
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { error: "The uploaded report is empty or invalid." };
  }

  const maxSize = type.fileType === "image" ? MAX_REPORT_IMAGE_SIZE : MAX_REPORT_PDF_SIZE;
  if (file.size > maxSize || file.buffer.length > maxSize) {
    return { error: type.fileType === "image"
      ? "Images must be 5 MB or smaller."
      : "PDF files must be 10 MB or smaller." };
  }

  const isJpeg = type.mimeType === "image/jpeg" &&
    file.buffer.length >= 3 &&
    file.buffer[0] === 0xff &&
    file.buffer[1] === 0xd8 &&
    file.buffer[2] === 0xff;
  const isPng = type.mimeType === "image/png" &&
    file.buffer.length >= 8 &&
    file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isPdf = type.mimeType === "application/pdf" &&
    file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!isJpeg && !isPng && !isPdf) {
    return { error: "The file content does not match its reported JPG, PNG, or PDF type." };
  }

  return { type };
}

module.exports = {
  MAX_REPORT_IMAGE_SIZE,
  MAX_REPORT_PDF_SIZE,
  getMedicalReportType,
  validateMedicalReport,
};
