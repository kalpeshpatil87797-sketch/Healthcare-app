const express = require("express");
const { handleSendMessage, handleGetMessages } = require("../controllers/message");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const router = express.Router();

router.post("/send", restrictToLoggedinUserOnly, upload.single("file"), handleSendMessage);
router.get("/all", restrictToLoggedinUserOnly, handleGetMessages);

module.exports = router;