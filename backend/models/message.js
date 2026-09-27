const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderEmail: { type: String, required: true },
    recipientEmail: { type: String },
    doctorId: { type: String },
    text: { type: String },
    // Optional structured medicine card. Only doctors can create these
    // (see controllers/message.js). Stores a whitelisted snapshot of the
    // flat product shape from frontend/src/data/medicines.js — info only,
    // never dosage instructions.
    type: { type: String, enum: ["text", "medicine"], default: "text" },
    // Single snapshot kept for backward compatibility with older
    // single-medicine messages/clients (mirrors the last entry of
    // `medicines` for newer multi-medicine messages).
    medicine: {
      id: { type: String },
      activeIngredient: { type: String },
      brandName: { type: String },
      companyName: { type: String },
      strength: { type: String },
      dosageForm: { type: String },
      category: { type: String },
      condition: { type: String },
    },
    // Every selected medicine in a multi-medicine message, in selection
    // order. Each entry uses the same whitelisted snapshot shape as above.
    medicines: [
      {
        id: { type: String },
        activeIngredient: { type: String },
        brandName: { type: String },
        companyName: { type: String },
        strength: { type: String },
        dosageForm: { type: String },
        category: { type: String },
        condition: { type: String },
      },
    ],
    fileUrl: { type: String },
    fileName: { type: String },
    fileType: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("message", messageSchema);
