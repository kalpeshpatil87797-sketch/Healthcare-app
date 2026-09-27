const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const Message = require("../models/message");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");

// Fresh role lookup — the JWT role can go stale after doctor registration,
// so the database is the authority (same pattern as controllers/message.js).
async function getRequesterRole(userEmail) {
  const user = await User.findOne({ email: userEmail }).select("role").lean();
  return user?.role ?? "patient";
}

async function getOwnDoctor(userEmail) {
  return Doctor.findOne({ registeredBy: userEmail }).lean();
}

// Strict YYYY-MM-DD calendar date. Returns the normalized string, or null
// when malformed/impossible. No timezone conversion: the picked calendar
// day is stored exactly as picked (same convention as the frontend picker).
function normalizeDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return trimmed;
}

function serverTodayStr() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Human-readable date for the predefined chat message text, built from
// the YYYY-MM-DD parts directly so no timezone shift can alter the day.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function prettyDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

// Mirror the appointment status onto its chat message(s) so cards update
// through the existing message loading mechanism. The appointmentId link
// is the source of truth; this snapshot only drives card rendering.
async function syncAppointmentMessage(appointment) {
  await Message.updateMany(
    { appointmentId: appointment._id },
    {
      $set: {
        appointmentStatus: appointment.status,
        alternateDate: appointment.alternateDate,
        alternateTime: appointment.alternateTime,
      },
    }
  );
}

// Slot labels as produced by the booking UI (e.g. "09:00 AM", "02:30 PM").
function normalizeTime(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(trimmed)) return null;
  return trimmed.length > 10 ? null : trimmed;
}

function toPatientView(a) {
  const doctor = a.doctorId && typeof a.doctorId === "object" ? a.doctorId : {};
  return {
    _id: a._id,
    doctorId: doctor._id ?? a.doctorId,
    doctorName: doctor.name,
    specialist: doctor.specialist,
    clinicName: doctor.clinicName,
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime,
    status: a.status,
    alternateDate: a.alternateDate,
    alternateTime: a.alternateTime,
    requestedAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function toDoctorView(a) {
  const patient = a.patientId && typeof a.patientId === "object" ? a.patientId : {};
  return {
    _id: a._id,
    patientId: patient._id ?? a.patientId,
    patientName: patient.name,
    patientAge: patient.age,
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime,
    status: a.status,
    alternateDate: a.alternateDate,
    alternateTime: a.alternateTime,
    requestedAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// POST /appointment/book — logged-in patient requests a slot with a
// connected doctor. Patient identity always comes from the JWT.
async function handleBookAppointment(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can book appointments" });
    }

    const { doctorId, appointmentDate, appointmentTime } = req.body;
    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: "doctorId, appointmentDate and appointmentTime are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const doctor = await Doctor.findById(doctorId).select("_id").lean();
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Booking is only allowed inside an existing patient ↔ doctor connection.
    const connection = await Connection.findOne({
      patientId: req.user._id,
      doctorId: doctor._id,
    }).lean();
    if (!connection) {
      return res.status(403).json({ error: "Not connected to this doctor" });
    }

    const date = normalizeDate(appointmentDate);
    if (!date) {
      return res.status(400).json({ error: "Invalid appointment date" });
    }
    if (date < serverTodayStr()) {
      return res.status(400).json({ error: "Appointment date cannot be in the past" });
    }
    const time = normalizeTime(appointmentTime);
    if (!time) {
      return res.status(400).json({ error: "Invalid appointment time" });
    }

    // Slot conflict: pending/accepted occupy the slot, everything else does not.
    const occupied = await Appointment.findOne({
      doctorId: doctor._id,
      appointmentDate: date,
      appointmentTime: time,
      status: { $in: ["pending", "accepted"] },
    }).select("_id").lean();
    if (occupied) {
      return res.status(409).json({ error: "This time slot is no longer available." });
    }

    try {
      const appointment = await Appointment.create({
        patientId: req.user._id,
        doctorId: doctor._id,
        appointmentDate: date,
        appointmentTime: time,
        status: "pending",
      });
      // One automatic chat message per appointment, created here on the
      // server inside the existing patient ↔ doctor conversation. The
      // appointmentId guard makes retries safe: a second message for the
      // same appointment is never created (no duplicates on refresh or
      // reopen — creation happens exactly once, right here).
      const alreadyMessaged = await Message.findOne({ appointmentId: appointment._id })
        .select("_id")
        .lean();
      if (!alreadyMessaged) {
        await Message.create({
          senderEmail: req.user.email,
          doctorId: String(doctor._id),
          text:
            `📅 Appointment Request\nPatient requested an appointment\n` +
            `Date: ${prettyDate(date)}\nTime: ${time}\nStatus: Pending Doctor Approval`,
          type: "appointment",
          appointmentId: appointment._id,
          appointmentDate: date,
          appointmentTime: time,
          appointmentStatus: "pending",
        });
      }
      return res.status(201).json({ appointment: toPatientView(appointment) });
    } catch (err) {
      // Partial unique index backstop for simultaneous bookings of one slot.
      if (err?.code === 11000) {
        return res.status(409).json({ error: "This time slot is no longer available." });
      }
      throw err;
    }
  } catch (err) {
    console.error("Book appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to book appointment" });
  }
}

// GET /appointment/mine — logged-in patient's own appointments.
async function handleMyAppointments(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can view their appointments" });
    }
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate("doctorId", "name specialist clinicName")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .lean();
    return res.status(200).json({ count: appointments.length, appointments: appointments.map(toPatientView) });
  } catch (err) {
    console.error("Get appointments failed:", err.message);
    return res.status(500).json({ error: "Failed to get appointments" });
  }
}

// GET /appointment/doctor — logged-in doctor's own appointment requests.
async function handleDoctorAppointments(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can view appointment requests" });
    }
    const doctor = await getOwnDoctor(req.user.email);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate("patientId", "name age")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .lean();
    return res.status(200).json({
      count: appointments.length,
      doctorId: doctor._id,
      appointments: appointments.map(toDoctorView),
    });
  } catch (err) {
    console.error("Get doctor appointments failed:", err.message);
    return res.status(500).json({ error: "Failed to get appointment requests" });
  }
}

// PATCH /appointment/:id/respond — accept / reject / alternate_requested.
// Doctor can only respond to their own pending appointments.
async function handleRespondAppointment(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can respond to appointments" });
    }
    const doctor = await getOwnDoctor(req.user.email);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const appointment = await Appointment.findOne({ _id: id, doctorId: doctor._id });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment.status !== "pending") {
      return res.status(409).json({ error: "Appointment has already been decided" });
    }

    const { action, alternateDate, alternateTime } = req.body;
    if (action === "accept") {
      // Defensive re-check: the slot must still be free for acceptance.
      const clash = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctorId: appointment.doctorId,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: "accepted",
      }).select("_id").lean();
      if (clash) {
        return res.status(409).json({ error: "This time slot is no longer available." });
      }
      appointment.status = "accepted";
    } else if (action === "reject") {
      appointment.status = "rejected";
    } else if (action === "alternate") {
      const date = normalizeDate(alternateDate);
      const time = normalizeTime(alternateTime);
      if (!date || !time) {
        return res.status(400).json({ error: "alternateDate and alternateTime are required" });
      }
      if (date < serverTodayStr()) {
        return res.status(400).json({ error: "Alternate date cannot be in the past" });
      }
      appointment.status = "alternate_requested";
      appointment.alternateDate = date;
      appointment.alternateTime = time;
    } else {
      return res.status(400).json({ error: "Invalid action. Use accept, reject or alternate" });
    }

    await appointment.save();
    await syncAppointmentMessage(appointment);
    await appointment.populate("patientId", "name age");
    return res.status(200).json({ appointment: toDoctorView(appointment.toObject()) });
  } catch (err) {
    console.error("Respond to appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to respond to appointment" });
  }
}

// PATCH /appointment/:id/cancel — patient cancels their own pending request.
async function handleCancelAppointment(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can cancel appointments" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const appointment = await Appointment.findOne({ _id: id, patientId: req.user._id });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment.status !== "pending") {
      return res.status(409).json({ error: "Only pending appointments can be cancelled" });
    }
    appointment.status = "cancelled";
    await appointment.save();
    await syncAppointmentMessage(appointment);
    await appointment.populate("doctorId", "name specialist clinicName");
    return res.status(200).json({ appointment: toPatientView(appointment.toObject()) });
  } catch (err) {
    console.error("Cancel appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }
}

// PATCH /appointment/:id/accept-alternate — patient accepts the doctor's
// suggested time. Only the owning patient, only from alternate_requested.
// The original request is kept; the suggested slot becomes the accepted one.
async function handleAcceptAlternate(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can accept alternate times" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const appointment = await Appointment.findOne({ _id: id, patientId: req.user._id });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment.status !== "alternate_requested") {
      return res.status(409).json({ error: "No alternate time to accept" });
    }
    // The suggested slot must still be free before it becomes accepted.
    const clash = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: appointment.doctorId,
      appointmentDate: appointment.alternateDate,
      appointmentTime: appointment.alternateTime,
      status: { $in: ["pending", "accepted"] },
    }).select("_id").lean();
    if (clash) {
      return res.status(409).json({ error: "This time slot is no longer available." });
    }
    appointment.status = "accepted";
    await appointment.save();
    await syncAppointmentMessage(appointment);
    await appointment.populate("doctorId", "name specialist clinicName");
    return res.status(200).json({ appointment: toPatientView(appointment.toObject()) });
  } catch (err) {
    console.error("Accept alternate time failed:", err.message);
    return res.status(500).json({ error: "Failed to accept alternate time" });
  }
}

module.exports = {
  handleBookAppointment,
  handleMyAppointments,
  handleDoctorAppointments,
  handleRespondAppointment,
  handleCancelAppointment,
  handleAcceptAlternate,
};
