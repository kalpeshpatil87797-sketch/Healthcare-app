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
    type: { type: String, enum: ["text", "medicine", "appointment"], default: "text" },
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
    // Optional attachment metadata. Older text-only messages simply omit
    // these fields and keep rendering as before.
    fileSize: { type: Number },
    mimeType: { type: String },
    // Appointment request card (see controllers/appointment.js). Created
    // automatically by the server when a booking succeeds — never from
    // client input. appointmentId is the source of truth; the date/time
    // snapshot the immutable request, and appointmentStatus/alternate*
    // are synced by the server whenever the appointment status changes.
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "appointment" },
    appointmentDate: { type: String },
    appointmentTime: { type: String },
    appointmentStatus: {
      type: String,
      enum: ["pending", "accepted", "alternate_requested", "rejected", "cancelled", "completed"],
    },
    alternateDate: { type: String },
    alternateTime: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("message", messageSchema);
