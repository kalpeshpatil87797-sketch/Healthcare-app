const express = require("express");
const multer = require("multer");
const { handleSendMessage, handleGetMessages } = require("../controllers/message");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const router = express.Router();

function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large (max 10MB)" });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

router.post("/send", restrictToLoggedinUserOnly, handleUpload, handleSendMessage);
router.get("/all", restrictToLoggedinUserOnly, handleGetMessages);

module.exports = router;