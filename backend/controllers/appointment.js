const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const Message = require("../models/message");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");
const {
  getEffectiveRole,
  getAuthorizedDoctor,
  isDoctorApproved,
} = require("../utils/doctorAccess");
const { getAvailableAppointmentSlots } = require("../utils/appointmentAvailability");
const {
  acquireAppointmentSlotLock,
  releaseAppointmentSlotLock,
} = require("../utils/appointmentSlotLock");
const {
  DEFAULT_SLOT_DURATION_MINUTES,
  getBookableSlots,
  normalizeSlotTime: normalizeTime,
  validateAvailability,
} = require("../utils/appointmentAvailability");
const { isApprovedDoctorProfile } = require("../utils/doctorApplicationStatus");

// Fresh role lookup — the JWT role can go stale after doctor registration,
// so the database is the authority (same pattern as controllers/message.js).
async function getRequesterRole(userEmail) {
  const user = await User.findOne({ email: userEmail }).select("role").lean();
  if (!user) return null;
  if (user.role === "doctor") {
    const application = await Doctor.findOne({ registeredBy: userEmail })
      .select("approvalStatus isActive")
      .sort({ updatedAt: -1, _id: -1 })
      .lean();
    if (application) return isDoctorApproved(application) ? "doctor" : "patient";
    if (user.role === "doctor") return "doctor";
  }
  return user.role;
}

async function getOwnDoctor(userEmail) {
  return Doctor.findOne({ registeredBy: userEmail })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
}

function isDoctorApproved(doctor) {
  return isApprovedDoctorProfile(doctor);
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
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        alternateDate: appointment.alternateDate,
        alternateTime: appointment.alternateTime,
        appointmentReason: appointment.visitReason,
      },
    }
  );
}

async function syncAppointmentMessageSafely(appointment) {
  try {
    await syncAppointmentMessage(appointment);
    return null;
  } catch (err) {
    console.error("Appointment saved but linked chat message sync failed:", err.message);
    return "Appointment saved, but its linked chat message could not be refreshed.";
  }
}

async function populateAppointmentSafely(appointment, paths) {
  try {
    for (const [path, selection] of paths) {
      await appointment.populate(path, selection);
    }
    return null;
  } catch (err) {
    console.error("Appointment saved but participant details could not be loaded:", err.message);
    return "Appointment was saved, but participant details could not be loaded. Refresh to see the latest details.";
  }
}

function combineWarnings(...warnings) {
  return warnings.filter(Boolean).join(" ");
}

function localMinuteOfDay(value) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) return null;
  return ((Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0)) * 60 +
    Number(match[2]);
}

function appointmentHasStarted(appointment) {
  const today = serverTodayStr();
  if (appointment.appointmentDate < today) return true;
  if (appointment.appointmentDate > today) return false;
  const scheduledMinute = localMinuteOfDay(appointment.appointmentTime);
  return scheduledMinute !== null &&
    scheduledMinute <= new Date().getHours() * 60 + new Date().getMinutes();
}

async function getActiveDoctorForEmail(email) {
  const doctor = await getOwnDoctor(email);
  if (!isDoctorApproved(doctor)) return null;
  const user = await User.findOne({ email })
    .select("role accountStatus")
    .lean();
  if (!user || user.role !== "doctor" || user.accountStatus === "suspended") return null;
  return doctor;
}

async function getSlotsForDoctor(doctor, date, excludeAppointmentId) {
  const appointments = await Appointment.find({
    doctorId: doctor._id,
    status: { $in: ["pending", "accepted"] },
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
  })
    .select("appointmentDate appointmentTime alternateDate alternateTime status")
    .lean();
  const occupiedTimes = [];
  for (const appointment of appointments) {
    if (appointment.appointmentDate === date) {
      const time = normalizeTime(appointment.appointmentTime);
      if (time) occupiedTimes.push(time);
    }
    if (appointment.status === "accepted" && appointment.alternateDate === date) {
      const alternateTime = normalizeTime(appointment.alternateTime);
      if (alternateTime) occupiedTimes.push(alternateTime);
    }
  }
  return getBookableSlots(
    doctor.availability ?? { slotDurationMinutes: DEFAULT_SLOT_DURATION_MINUTES },
    date,
    occupiedTimes
  );
}

async function lockAppointmentSlots(doctorId, slots) {
  const uniqueSlots = [...new Map(
    slots.map((slot) => [`${slot.date} ${slot.time}`, slot])
  ).values()].sort((left, right) =>
    `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`)
  );
  const locks = [];
  for (const slot of uniqueSlots) {
    const lock = await acquireAppointmentSlotLock(
      doctorId,
      slot.date,
      slot.time
    );
    if (!lock) {
      for (const acquired of locks.reverse()) {
        await releaseAppointmentSlotLock(acquired);
      }
      return null;
    }
    locks.push(lock);
  }
  return locks;
}

function appointmentSlotConflictQuery(doctorId, date, time, excludeId) {
  return {
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    doctorId,
    status: { $in: ["pending", "accepted"] },
    $or: [
      { appointmentDate: date, appointmentTime: time },
      { status: "accepted", alternateDate: date, alternateTime: time },
    ],
  };
}

async function findAppointmentSlotConflict(doctorId, date, time, excludeId) {
  return Appointment.findOne(
    appointmentSlotConflictQuery(doctorId, date, time, excludeId)
  )
    .select("_id")
    .lean();
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
    visitReason: a.visitReason ?? "",
    history: (a.history ?? []).map(({ event, fromDate, fromTime, toDate, toTime, occurredAt }) => ({
      event,
      fromDate: fromDate ?? null,
      fromTime: fromTime ?? null,
      toDate: toDate ?? null,
      toTime: toTime ?? null,
      occurredAt,
    })),
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
    visitReason: a.visitReason ?? "",
    history: (a.history ?? []).map(({ event, fromDate, fromTime, toDate, toTime, occurredAt }) => ({
      event,
      fromDate: fromDate ?? null,
      fromTime: fromTime ?? null,
      toDate: toDate ?? null,
      toTime: toTime ?? null,
      occurredAt,
    })),
    requestedAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function handleGetDoctorAvailability(req, res) {
  const { id } = req.params;
  const date = normalizeDate(req.query.date);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: "Doctor not found" });
  }
  if (!date) {
    return res.status(400).json({ error: "A valid appointment date is required." });
  }

  try {
    const doctor = await Doctor.findById(id).lean();
    if (!doctor || !isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(404).json({ error: "Doctor is not currently bookable." });
    }
    const doctorUser = await User.findOne({ email: doctor.registeredBy })
      .select("accountStatus")
      .lean();
    if (!doctorUser || doctorUser.accountStatus === "suspended") {
      return res.status(404).json({ error: "Doctor is not currently bookable." });
    }
    return res.status(200).json({
      doctorId: doctor._id,
      date,
      slotDurationMinutes:
        doctor.availability?.slotDurationMinutes ?? DEFAULT_SLOT_DURATION_MINUTES,
      availableSlots: await getSlotsForDoctor(doctor, date),
    });
  } catch (err) {
    console.error("Get doctor availability failed:", err.message);
    return res.status(500).json({ error: "Failed to get doctor availability" });
  }
}

async function handleGetMyDoctorAvailability(req, res) {
  try {
    const doctor = await getActiveDoctorForEmail(req.user.email);
    if (!doctor) {
      return res.status(403).json({
        error: "Only an active, approved doctor can manage availability.",
      });
    }
    return res.status(200).json({
      availability: doctor.availability ?? {
        slotDurationMinutes: DEFAULT_SLOT_DURATION_MINUTES,
        workingHours: [],
        breaks: [],
        blockedDates: [],
        unavailablePeriods: [],
      },
    });
  } catch (err) {
    console.error("Get doctor availability settings failed:", err.message);
    return res.status(500).json({ error: "Failed to get availability settings" });
  }
}

async function handleUpdateDoctorAvailability(req, res) {
  const allowedFields = [
    "slotDurationMinutes",
    "workingHours",
    "breaks",
    "blockedDates",
    "unavailablePeriods",
  ];
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => !allowedFields.includes(key)) ||
    allowedFields.some((key) => !Object.prototype.hasOwnProperty.call(req.body, key))
  ) {
    return res.status(400).json({
      error: "Provide slot duration, working hours, breaks, blocked dates, and unavailable periods.",
      code: "INVALID_AVAILABILITY",
    });
  }
  const parsed = validateAvailability(req.body);
  if (parsed.error) {
    return res.status(400).json({
      error: parsed.error,
      code: "INVALID_AVAILABILITY",
    });
  }

  try {
    const doctor = await getActiveDoctorForEmail(req.user.email);
    if (!doctor) {
      return res.status(403).json({
        error: "Only an active, approved doctor can manage availability.",
      });
    }
    const updated = await Doctor.findOneAndUpdate(
      {
        _id: doctor._id,
        isActive: { $ne: false },
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
        ],
      },
      { $set: { availability: parsed.value } },
      { new: true, runValidators: true }
    )
      .select("_id availability")
      .lean();
    if (!updated) {
      return res.status(409).json({
        error: "The doctor profile changed. Refresh and try again.",
        code: "DOCTOR_PROFILE_CHANGED",
      });
    }
    return res.status(200).json({
      message: "Availability updated.",
      availability: updated.availability,
    });
  } catch (err) {
    if (err?.name === "ValidationError" || err?.name === "CastError") {
      return res.status(400).json({ error: "Please provide valid availability settings." });
    }
    console.error("Update doctor availability failed:", err.message);
    return res.status(500).json({ error: "Failed to update doctor availability" });
  }
}

// POST /appointment/book — creates an immediately confirmed booking.
async function handleBookAppointment(req, res) {
  try {
    const role = await getEffectiveRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can book appointments" });
    }

    const { doctorId, appointmentDate, appointmentTime, visitReason } = req.body ?? {};
    if (!doctorId || !appointmentDate || !appointmentTime || typeof visitReason !== "string") {
      return res.status(400).json({
        error: "doctorId, appointmentDate, appointmentTime, and visitReason are required",
      });
    }
    const reason = visitReason.trim();
    if (!reason || reason.length > 500) {
      return res.status(400).json({
        error: "Visit reason is required and must be 500 characters or fewer.",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const doctor = await Doctor.findById(doctorId)
      .select("_id registeredBy approvalStatus isActive isAvailable availability")
      .lean();
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Only approved doctors can receive new bookings.
    if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(403).json({ error: "This doctor is not currently available." });
    }

    // A suspended doctor must not receive new bookings.
    const doctorUser = await User.findOne({ email: doctor.registeredBy })
      .select("accountStatus")
      .lean();
    if (!doctorUser || doctorUser.accountStatus === "suspended") {
      return res.status(403).json({ error: "This doctor is currently unavailable." });
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
    if (!doctor.availability?.workingHours?.length) {
      return res.status(409).json({
        error: "This doctor has not configured appointment availability.",
        code: "DOCTOR_AVAILABILITY_NOT_CONFIGURED",
      });
    }

    const slotLock = await acquireAppointmentSlotLock(doctor._id, date, time);
    if (!slotLock) {
      res.set("Retry-After", "2");
      return res.status(503).json({
        error: "This appointment slot is being updated. Please try again.",
        code: "APPOINTMENT_SLOT_BUSY",
      });
    }
    try {
      const currentDoctor = await Doctor.findOne({
        _id: doctor._id,
        isActive: { $ne: false },
        isAvailable: { $ne: false },
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
        ],
      }).lean();
      const currentDoctorUser = currentDoctor
        ? await User.findOne({ email: currentDoctor.registeredBy })
            .select("accountStatus")
            .lean()
        : null;
      if (!currentDoctor || !currentDoctorUser || currentDoctorUser.accountStatus === "suspended") {
        return res.status(403).json({ error: "This doctor is currently unavailable." });
      }

      const availableSlots = await getSlotsForDoctor(currentDoctor, date);
      if (!availableSlots.includes(time)) {
        return res.status(409).json({
          error: "This time is outside the doctor's current availability or is no longer free.",
          code: "APPOINTMENT_SLOT_UNAVAILABLE",
        });
      }

      const occupied = await findAppointmentSlotConflict(doctor._id, date, time);
      if (occupied) {
        return res.status(409).json({
          error: "This time slot is no longer available. Please choose another time.",
          code: "APPOINTMENT_SLOT_TAKEN",
        });
      }

      const appointment = await Appointment.create({
        patientId: req.user._id,
        doctorId: doctor._id,
        appointmentDate: date,
        appointmentTime: time,
        status: "accepted",
        visitReason: reason,
        history: [{
          event: "booked",
          actorId: req.user._id,
          actorRole: "patient",
          toDate: date,
          toTime: time,
        }],
      });
      // One automatic chat message per appointment, created here on the
      // server inside the existing patient ↔ doctor conversation. The
      // appointmentId guard makes retries safe: a second message for the
      // same appointment is never created (no duplicates on refresh or
      // reopen — creation happens exactly once, right here).
      let notificationWarning = null;
      try {
        const alreadyMessaged = await Message.findOne({ appointmentId: appointment._id })
          .select("_id")
          .lean();
        if (!alreadyMessaged) {
          await Message.create({
            senderEmail: req.user.email,
            doctorId: String(doctor._id),
            text:
              `Appointment confirmed\nDate: ${prettyDate(date)}\nTime: ${time}`,
            type: "appointment",
            appointmentId: appointment._id,
            appointmentDate: date,
            appointmentTime: time,
            appointmentReason: reason,
            appointmentStatus: "accepted",
          });
        }
      } catch (err) {
        console.error("Appointment booked but confirmation message creation failed:", err.message);
        notificationWarning = "Appointment confirmed, but its chat confirmation could not be created.";
      }
      return res.status(201).json({
        message: "Appointment confirmed.",
        appointment: toPatientView({
          ...appointment.toObject(),
          doctorId: doctor,
        }),
        confirmationId: String(appointment._id),
        notificationWarning,
      });
    } catch (err) {
      // Partial unique index backstop for simultaneous bookings of one slot.
      if (err?.code === 11000) {
        return res.status(409).json({
          error: "This time slot is no longer available. Please choose another time.",
          code: "APPOINTMENT_SLOT_TAKEN",
        });
      }
      throw err;
    } finally {
      await releaseAppointmentSlotLock(slotLock);
    }
  } catch (err) {
    console.error("Book appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to book appointment" });
  }
}

// GET /appointment/availability — return free choices from the existing
// fixed schedule without exposing any other patient's appointment details.
async function handleAppointmentAvailability(req, res) {
  try {
    if ((await getEffectiveRole(req.user.email)) !== "patient") {
      return res.status(403).json({ error: "Only patients can view appointment availability" });
    }

    const { doctorId } = req.query;
    const date = normalizeDate(req.query.date);
    if (!doctorId || !date) {
      return res.status(400).json({ error: "doctorId and a valid date are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    if (date < serverTodayStr()) {
      return res.status(400).json({ error: "Appointment date cannot be in the past" });
    }

    const doctor = await Doctor.findById(doctorId)
      .select("_id registeredBy approvalStatus isAvailable")
      .lean();
    if (!doctor || !isDoctorApproved(doctor) || doctor.isAvailable !== true) {
      return res.status(404).json({ error: "Doctor is not available for appointments" });
    }
    const doctorUser = await User.findOne({
      email: doctor.registeredBy,
      role: "doctor",
      accountStatus: { $ne: "suspended" },
    }).select("_id").lean();
    if (!doctorUser) {
      return res.status(404).json({ error: "Doctor is not available for appointments" });
    }

    const appointments = await Appointment.find({
      doctorId: doctor._id,
      $or: [
        { appointmentDate: date, status: { $in: ["pending", "accepted"] } },
        { alternateDate: date, status: "accepted" },
      ],
    }).select("appointmentTime alternateTime status appointmentDate alternateDate").lean();
    return res.status(200).json({
      date,
      availableSlots: getAvailableAppointmentSlots(appointments, date),
    });
  } catch (err) {
    console.error("Get appointment availability failed:", err.message);
    return res.status(500).json({ error: "Failed to get appointment availability" });
  }
}

// GET /appointment/mine — logged-in patient's own appointments.
async function handleMyAppointments(req, res) {
  try {
    const role = await getEffectiveRole(req.user.email);
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
    const doctor = await getAuthorizedDoctor(req.user.email);
    if (!doctor) {
      return res.status(403).json({ error: "Only doctors can view appointment requests" });
    }
    if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(403).json({ error: "Your doctor profile is not approved for appointment access." });
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
    const doctor = await getAuthorizedDoctor(req.user.email);
    if (!doctor) {
      return res.status(403).json({ error: "Only doctors can respond to appointments" });
    }
    if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(403).json({ error: "Your doctor profile is not approved for appointment responses." });
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

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    const { action, alternateDate, alternateTime } = req.body;
    let update = {};
    let slotLock = null;
    if (action === "accept") {
      slotLock = await acquireAppointmentSlotLock(
        doctor._id,
        appointment.appointmentDate,
        appointment.appointmentTime
      );
      if (!slotLock) {
        res.set("Retry-After", "2");
        return res.status(503).json({
          error: "This appointment slot is being updated. Please try again.",
          code: "APPOINTMENT_SLOT_BUSY",
        });
      }
      update.status = "accepted";
    } else if (action === "reject") {
      update.status = "rejected";
    } else if (action === "alternate") {
      const date = normalizeDate(alternateDate);
      const time = normalizeTime(alternateTime);
      if (!date || !time) {
        return res.status(400).json({ error: "alternateDate and alternateTime are required" });
      }
      if (date < serverTodayStr()) {
        return res.status(400).json({ error: "Alternate date cannot be in the past" });
      }
      if (!(await getSlotsForDoctor(doctor, date, appointment._id)).includes(time)) {
        return res.status(409).json({
          error: "The suggested time is outside current availability or is no longer free.",
          code: "APPOINTMENT_SLOT_UNAVAILABLE",
        });
      }
      update = {
        status: "alternate_requested",
        alternateDate: date,
        alternateTime: time,
      };
    } else {
      return res.status(400).json({ error: "Invalid action. Use accept, reject or alternate" });
    }

    try {
      if (action === "accept") {
        const clash = await findAppointmentSlotConflict(
          doctor._id,
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment._id
        );
        if (clash) {
          return res.status(409).json({ error: "This time slot is no longer available." });
        }
      }

      const updated = await Appointment.findOneAndUpdate(
        { _id: appointment._id, doctorId: doctor._id, status: "pending" },
        {
          $set: update,
          $push: {
            history: {
              event: action === "alternate" ? "alternate_suggested" : action === "accept" ? "accepted" : "rejected",
              actorId: req.user._id,
              actorRole: "doctor",
              fromDate: appointment.appointmentDate,
              fromTime: appointment.appointmentTime,
              ...(action === "alternate"
                ? { toDate: update.alternateDate, toTime: update.alternateTime }
                : {}),
            },
          },
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(409).json({ error: "Appointment has already been decided" });
      }

      const notificationWarning = combineWarnings(
        await syncAppointmentMessageSafely(updated),
        await populateAppointmentSafely(updated, [["patientId", "name age"]])
      );
      return res.status(200).json({
        appointment: toDoctorView(updated.toObject()),
        notificationWarning,
      });
    } finally {
      await releaseAppointmentSlotLock(slotLock);
    }
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "This time slot is no longer available." });
    }
    console.error("Respond to appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to respond to appointment" });
  }
}

// PATCH /appointment/:id/cancel — either participant may cancel an upcoming booking.
async function handleCancelAppointment(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient" && role !== "doctor") {
      return res.status(403).json({ error: "Only patients and assigned doctors can cancel appointments" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const doctor = role === "doctor" ? await getActiveDoctorForEmail(req.user.email) : null;
    if (role === "doctor" && !doctor) {
      return res.status(403).json({ error: "An active doctor profile is required." });
    }
    const ownership = role === "patient"
      ? { patientId: req.user._id }
      : { doctorId: doctor._id };
    const appointment = await Appointment.findOne({ _id: id, ...ownership });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!["pending", "accepted"].includes(appointment.status)) {
      return res.status(409).json({ error: "Only upcoming appointments can be cancelled" });
    }
    if (appointmentHasStarted(appointment)) {
      return res.status(409).json({ error: "An appointment cannot be cancelled after it has started." });
    }
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointment._id, ...ownership, status: appointment.status },
      {
        $set: { status: "cancelled" },
        $push: {
          history: {
            event: "cancelled",
            actorId: req.user._id,
            actorRole: role,
            fromDate: appointment.appointmentDate,
            fromTime: appointment.appointmentTime,
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ error: "The appointment changed. Refresh and try again." });
    }
    let notificationWarning = await syncAppointmentMessageSafely(updated);
    if (role === "patient") {
      notificationWarning = combineWarnings(
        notificationWarning,
        await populateAppointmentSafely(updated, [["doctorId", "name specialist clinicName"]])
      );
      return res.status(200).json({
        appointment: toPatientView(updated.toObject()),
        notificationWarning,
      });
    }
    notificationWarning = combineWarnings(
      notificationWarning,
      await populateAppointmentSafely(updated, [["patientId", "name age"]])
    );
    return res.status(200).json({
      appointment: toDoctorView(updated.toObject()),
      notificationWarning,
    });
  } catch (err) {
    console.error("Cancel appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }
}

async function handleRescheduleAppointment(req, res) {
  const { id } = req.params;
  const { appointmentDate, appointmentTime } = req.body ?? {};
  const date = normalizeDate(appointmentDate);
  const time = normalizeTime(appointmentTime);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: "Appointment not found" });
  }
  if (!date || !time || date < serverTodayStr()) {
    return res.status(400).json({ error: "Choose a valid future date and available time." });
  }

  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient" && role !== "doctor") {
      return res.status(403).json({ error: "Only patients and assigned doctors can reschedule appointments." });
    }
    const doctorActor = role === "doctor"
      ? await getActiveDoctorForEmail(req.user.email)
      : null;
    if (role === "doctor" && !doctorActor) {
      return res.status(403).json({ error: "An active doctor profile is required." });
    }
    const ownership = role === "patient"
      ? { patientId: req.user._id }
      : { doctorId: doctorActor._id };
    const appointment = await Appointment.findOne({ _id: id, ...ownership });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!["pending", "accepted"].includes(appointment.status)) {
      return res.status(409).json({ error: "Only upcoming appointments can be rescheduled." });
    }
    if (appointmentHasStarted(appointment)) {
      return res.status(409).json({ error: "An appointment cannot be rescheduled after it has started." });
    }
    if (
      date === appointment.appointmentDate &&
      time === appointment.appointmentTime
    ) {
      return res.status(400).json({ error: "Choose a different appointment time." });
    }

    const doctor = role === "doctor"
      ? doctorActor
      : await Doctor.findById(appointment.doctorId).lean();
    if (!doctor || !isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(409).json({ error: "This doctor is no longer available for rescheduling." });
    }
    const doctorUser = await User.findOne({ email: doctor.registeredBy })
      .select("accountStatus")
      .lean();
    if (!doctorUser || doctorUser.accountStatus === "suspended") {
      return res.status(409).json({ error: "This doctor is no longer available for rescheduling." });
    }
    const locks = await lockAppointmentSlots(doctor._id, [
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      { date, time },
    ]);
    if (!locks) {
      res.set("Retry-After", "2");
      return res.status(503).json({
        error: "The appointment slots are being updated. Please try again.",
        code: "APPOINTMENT_SLOT_BUSY",
      });
    }

    try {
      const currentDoctor = await Doctor.findOne({
        _id: doctor._id,
        isActive: { $ne: false },
        isAvailable: { $ne: false },
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
        ],
      }).lean();
      if (!currentDoctor || !(await getSlotsForDoctor(currentDoctor, date, appointment._id)).includes(time)) {
        return res.status(409).json({
          error: "The selected time is outside current availability or is no longer free.",
          code: "APPOINTMENT_SLOT_UNAVAILABLE",
        });
      }

      const updated = await Appointment.findOneAndUpdate(
        {
          _id: appointment._id,
          ...ownership,
          status: appointment.status,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
        },
        {
          $set: {
            appointmentDate: date,
            appointmentTime: time,
            status: "accepted",
          },
          $unset: { alternateDate: 1, alternateTime: 1 },
          $push: {
            history: {
              event: "rescheduled",
              actorId: req.user._id,
              actorRole: role,
              fromDate: appointment.appointmentDate,
              fromTime: appointment.appointmentTime,
              toDate: date,
              toTime: time,
            },
          },
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(409).json({ error: "The appointment changed. Refresh and try again." });
      }
      let notificationWarning = await syncAppointmentMessageSafely(updated);
      if (role === "patient") {
        notificationWarning = combineWarnings(
          notificationWarning,
          await populateAppointmentSafely(updated, [["doctorId", "name specialist clinicName"]])
        );
        return res.status(200).json({
          appointment: toPatientView(updated.toObject()),
          notificationWarning,
        });
      }
      notificationWarning = combineWarnings(
        notificationWarning,
        await populateAppointmentSafely(updated, [["patientId", "name age"]])
      );
      return res.status(200).json({
        appointment: toDoctorView(updated.toObject()),
        notificationWarning,
      });
    } finally {
      for (const lock of locks.reverse()) await releaseAppointmentSlotLock(lock);
    }
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "This time slot is no longer available. Please choose another time.",
        code: "APPOINTMENT_SLOT_TAKEN",
      });
    }
    console.error("Reschedule appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to reschedule appointment" });
  }
}

async function handleCompleteAppointment(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "doctor") {
      return res.status(403).json({ error: "Only the assigned doctor can complete an appointment." });
    }
    const doctor = await getActiveDoctorForEmail(req.user.email);
    if (!doctor) {
      return res.status(403).json({ error: "An active doctor profile is required." });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const appointment = await Appointment.findOne({
      _id: id,
      doctorId: doctor._id,
    }).lean();
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment.status !== "accepted") {
      return res.status(409).json({ error: "Only confirmed appointments can be completed." });
    }
    if (!appointmentHasStarted(appointment)) {
      return res.status(409).json({ error: "An appointment cannot be completed before its scheduled time." });
    }
    const updated = await Appointment.findOneAndUpdate(
      { _id: id, doctorId: doctor._id, status: "accepted" },
      {
        $set: { status: "completed" },
        $push: {
          history: {
            event: "completed",
            actorId: req.user._id,
            actorRole: "doctor",
            fromDate: appointment.appointmentDate,
            fromTime: appointment.appointmentTime,
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ error: "The appointment changed. Refresh and try again." });
    }
    const notificationWarning = combineWarnings(
      await syncAppointmentMessageSafely(updated),
      await populateAppointmentSafely(updated, [["patientId", "name age"]])
    );
    return res.status(200).json({
      appointment: toDoctorView(updated.toObject()),
      notificationWarning,
    });
  } catch (err) {
    console.error("Complete appointment failed:", err.message);
    return res.status(500).json({ error: "Failed to complete appointment" });
  }
}

// PATCH /appointment/:id/accept-alternate — patient accepts the doctor's
// suggested time. Only the owning patient, only from alternate_requested.
// The original request is kept; the suggested slot becomes the accepted one.
async function handleAcceptAlternate(req, res) {
  try {
    const role = await getEffectiveRole(req.user.email);
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
    const alternateDate = normalizeDate(appointment.alternateDate);
    const alternateTime = normalizeTime(appointment.alternateTime);
    if (!alternateDate || !alternateTime) {
      return res.status(409).json({ error: "This appointment has no valid alternate time." });
    }
    // The suggested slot must still be free before it becomes accepted.
    const locks = await lockAppointmentSlots(appointment.doctorId, [
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      { date: alternateDate, time: alternateTime },
    ]);
    if (!locks) {
      res.set("Retry-After", "2");
      return res.status(503).json({
        error: "This appointment slot is being updated. Please try again.",
        code: "APPOINTMENT_SLOT_BUSY",
      });
    }
    try {
      const doctor = await Doctor.findOne({
        _id: appointment.doctorId,
        isActive: { $ne: false },
        isAvailable: { $ne: false },
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
        ],
      }).lean();
      if (!doctor || !(await getSlotsForDoctor(doctor, alternateDate, appointment._id)).includes(alternateTime)) {
        return res.status(409).json({
          error: "The alternate time is no longer available.",
          code: "APPOINTMENT_SLOT_UNAVAILABLE",
        });
      }
      const clash = await findAppointmentSlotConflict(
        appointment.doctorId,
        alternateDate,
        alternateTime,
        appointment._id
      );
      const originalClash = await findAppointmentSlotConflict(
        appointment.doctorId,
        appointment.appointmentDate,
        appointment.appointmentTime,
        appointment._id
      );
      if (clash || originalClash) {
        return res.status(409).json({ error: "This time slot is no longer available." });
      }

      const updated = await Appointment.findOneAndUpdate(
        {
          _id: appointment._id,
          patientId: req.user._id,
          status: "alternate_requested",
        },
        {
          $set: {
            status: "accepted",
            appointmentDate: alternateDate,
            appointmentTime: alternateTime,
          },
          $unset: { alternateDate: 1, alternateTime: 1 },
          $push: {
            history: {
              event: "accepted",
              actorId: req.user._id,
              actorRole: "patient",
              fromDate: appointment.appointmentDate,
              fromTime: appointment.appointmentTime,
              toDate: alternateDate,
              toTime: alternateTime,
            },
          },
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(409).json({ error: "No alternate time to accept" });
      }
      const notificationWarning = combineWarnings(
        await syncAppointmentMessageSafely(updated),
        await populateAppointmentSafely(updated, [["doctorId", "name specialist clinicName"]])
      );
      return res.status(200).json({
        appointment: toPatientView(updated.toObject()),
        notificationWarning,
      });
    } finally {
      for (const lock of locks.reverse()) await releaseAppointmentSlotLock(lock);
    }
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "This time slot is no longer available." });
    }
    console.error("Accept alternate time failed:", err.message);
    return res.status(500).json({ error: "Failed to accept alternate time" });
  }
}

module.exports = {
  handleGetDoctorAvailability,
  handleGetMyDoctorAvailability,
  handleUpdateDoctorAvailability,
  handleBookAppointment,
  handleAppointmentAvailability,
  handleMyAppointments,
  handleDoctorAppointments,
  handleRespondAppointment,
  handleCancelAppointment,
  handleRescheduleAppointment,
  handleCompleteAppointment,
  handleAcceptAlternate,
  syncAppointmentMessage,
  syncAppointmentMessageSafely,
  populateAppointmentSafely,
};
