const fs = require("fs");
const Message = require("../models/message");
const { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } = require("../middlewares/upload");
const { getAIhealthResponse } = require("../utils/aiService");

async function handleSendMessage(req, res) {
  const { text } = req.body;
  const senderEmail = req.user.email;

  let fileUrl = null;
  let fileName = null;
  let fileType = null;

  if (req.file) {
    const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);

    if (isImage && req.file.size > MAX_IMAGE_SIZE) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Image size must be under 5MB" });
    }

    fileUrl = `/uploads/${req.file.filename}`;
    fileName = req.file.originalname;
    fileType = isImage ? "image" : "document";
  }

  if (!text && !fileUrl) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  const message = await Message.create({ senderEmail, text, fileUrl, fileName, fileType });
  if(text && text.trim()){
    try {
      const aiReplyText = await getAIhealthResponse(text.trim());
      await Message.create({
        senderEmail: "AI Assistant",
        text: aiReplyText,
        recipientEmail: senderEmail,
      });
    }catch(err){
      console.log("AI response failed", err.message);
    }
  }
  return res.status(201).json(message);
}

async function handleGetMessages(req, res) {
  const messages = await Message.find({
    $or:[{ senderEmail: req.user.email },{recipientEmail:req.user.email}],
  }).sort({ createdAt: 1 });
  return res.status(200).json(messages);
}

module.exports = { handleSendMessage, handleGetMessages };
