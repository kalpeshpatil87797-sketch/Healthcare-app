const mongoose = require("mongoose");

// Doctor appointment requests. Only IDs are stored — patient/doctor details
// are populated from the user/doctor collections when reading, never
// duplicated here.
//
// appointmentDate is the calendar day exactly as picked by the patient
// (YYYY-MM-DD string, no timezone conversion). appointmentTime is the slot
// label (e.g. "09:00 AM"). createdAt serves as requestedAt.
const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctor", required: true },
    appointmentDate: { type: String, required: true },
    appointmentTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "alternate_requested", "rejected", "cancelled", "completed"],
      default: "pending",
    },
    // Doctor-proposed alternative when status is "alternate_requested".
    // The patient's original appointmentDate/appointmentTime never change.
    alternateDate: { type: String },
    alternateTime: { type: String },
  },
  { timestamps: true }
);

// One active booking per doctor slot. Only pending/accepted occupy a slot —
// cancelled/rejected/completed/alternate_requested fall outside the partial
// filter, so they never block re-booking. This is the race-safe backstop
// behind the application-level conflict check in controllers/appointment.js.
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "accepted"] } },
  }
);

module.exports = mongoose.model("appointment", appointmentSchema);
