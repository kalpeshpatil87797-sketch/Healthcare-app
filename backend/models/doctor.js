const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    clinicName: { type: String, required: true },
    degree: { type: String, required: true },
    specialist: { type: String, required: true },
    clinicLocation: { type: String, required: true },
    registeredBy: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    // Legacy doctor profiles have no approvalStatus: treat them as approved.
    // New registrations explicitly start as pending (see controllers/doctor.js).
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    rejectionReason: { type: String, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    reviewedAt: { type: Date },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true }
);

doctorSchema.index({ location: "2dsphere" });
doctorSchema.index({ approvalStatus: 1, isAvailable: 1 });

module.exports = mongoose.model("doctor", doctorSchema);