const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderEmail: { type: String, required: true },
    recipientEmail: { type:String},
    text: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileType: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("message", messageSchema);