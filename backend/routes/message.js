const express = require("express");
const multer = require("multer");
const {
  handleSendMessage,
  handleAnalyzeReport,
  handleGetMessages,
} = require("../controllers/message");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const router = express.Router();

function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large." });
      }
      return res.status(400).json({ error: "File upload failed. Please try again." });
    } else if (err) {
      if (err.code === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({ error: "This file type is not supported." });
      }
      return res.status(400).json({ error: "File upload failed. Please try again." });
    }
    next();
  });
}

function handleReportUpload(req, res, next) {
  upload.reportUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Report file must be 10 MB or smaller." });
      }
      return res.status(400).json({ error: "Report upload failed. Please try again." });
    }
    if (err) {
      return res.status(400).json({
        error: err.code === "UNSUPPORTED_FILE_TYPE"
          ? err.message
          : "Report upload failed. Please try again.",
      });
    }
    next();
  });
}

router.post("/send", restrictToLoggedinUserOnly, handleUpload, handleSendMessage);
router.post("/analyze", restrictToLoggedinUserOnly, handleReportUpload, handleAnalyzeReport);
router.get("/all", restrictToLoggedinUserOnly, handleGetMessages);

module.exports = router;