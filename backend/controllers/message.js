const Message = require("../models/message");

async function handleSendMessage(req, res) {
  const { text } = req.body;
  const senderEmail = req.user.email;

  let fileUrl = null;
  let fileName = null;
  let fileType = null;

  if (req.file) {
    fileUrl = `/uploads/${req.file.filename}`;
    fileName = req.file.originalname;
    fileType = req.file.mimetype.startsWith("image/") ? "image" : "document";
  }

  if (!text && !fileUrl) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  const message = await Message.create({ senderEmail, text, fileUrl, fileName, fileType });
  return res.status(201).json(message);
}

async function handleGetMessages(req, res) {
  const messages = await Message.find().sort({ createdAt: 1 });
  return res.status(200).json(messages);
}

module.exports = { handleSendMessage, handleGetMessages };