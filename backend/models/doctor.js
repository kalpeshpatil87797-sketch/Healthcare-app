const mongoose = require("mongoose");

const weeklyTimeRangeSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const unavailablePeriodSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    clinicName: { type: String, required: true },
    degree: { type: String, required: true },
    specialist: { type: String, required: true },
    clinicLocation: { type: String, required: true },
    registeredBy: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    locationVerified: { type: Boolean, default: false },
    availability: {
      slotDurationMinutes: { type: Number, min: 15, max: 120, default: 30 },
      workingHours: { type: [weeklyTimeRangeSchema], default: [] },
      breaks: { type: [weeklyTimeRangeSchema], default: [] },
      blockedDates: {
        type: [{ type: String, match: /^\d{4}-\d{2}-\d{2}$/ }],
        default: [],
      },
      unavailablePeriods: { type: [unavailablePeriodSchema], default: [] },
    },
    // Legacy doctor profiles have no approvalStatus: treat them as approved.
    // New registrations explicitly start as pending (see controllers/doctor.js).
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    submittedAt: { type: Date },
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