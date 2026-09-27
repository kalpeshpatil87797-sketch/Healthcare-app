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
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true }
);

doctorSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("doctor", doctorSchema);