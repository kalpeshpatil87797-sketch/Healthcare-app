const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctor", required: true },
    status: { type: String, enum: ["active"], default: "active" },
  },
  { timestamps: true }
);

connectionSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model("connection", connectionSchema);
