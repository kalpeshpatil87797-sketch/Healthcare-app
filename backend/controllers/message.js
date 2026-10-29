const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Message = require("../models/message");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");
const Appointment = require("../models/appointment");
const { getAIhealthResponse } = require("../utils/aiService");
const { isApprovedDoctorProfile } = require("../utils/doctorApplicationStatus");
const {
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_EXTS,
  ALLOWED_DOCUMENT_EXTS,
} = require("../middlewares/upload");

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

// Missing approvalStatus is legacy data and stays approved.
function isDoctorApproved(doctor) {
  return isApprovedDoctorProfile(doctor);
}

function isValidObjectId(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

// Whitelist for structured medicine cards. Only the display fields needed
// to render the card are kept; dosage/frequency instructions are never
// accepted or stored. Values are trimmed + length-capped, unknown fields
// are dropped — medicine details from the frontend are not trusted as-is.
const MEDICINE_LIMITS = {
  id: 200,
  activeIngredient: 100,
  brandName: 100,
  companyName: 100,
  strength: 50,
  dosageForm: 50,
  category: 100,
  condition: 100,
};

function pickMedicineField(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeMedicine(input) {
  let obj = input;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const medicine = {
    id: pickMedicineField(obj.id, MEDICINE_LIMITS.id),
    activeIngredient: pickMedicineField(obj.activeIngredient, MEDICINE_LIMITS.activeIngredient),
    brandName: pickMedicineField(obj.brandName, MEDICINE_LIMITS.brandName),
    companyName: pickMedicineField(obj.companyName, MEDICINE_LIMITS.companyName),
    strength: pickMedicineField(obj.strength, MEDICINE_LIMITS.strength),
    dosageForm: pickMedicineField(obj.dosageForm, MEDICINE_LIMITS.dosageForm),
    category: pickMedicineField(obj.category, MEDICINE_LIMITS.category),
    condition: pickMedicineField(obj.condition, MEDICINE_LIMITS.condition),
  };
  // Must carry the stable product reference "ingredient | brand | strength | form".
  if (!medicine.id || medicine.id.split("|").length < 2) return null;
  if (!medicine.activeIngredient || !medicine.brandName) return null;
  // Hide placeholder values instead of displaying them.
  if (medicine.companyName.toLowerCase() === "not specified") medicine.companyName = "";
  if (medicine.strength.toLowerCase() === "not specified") medicine.strength = "";
  if (medicine.dosageForm.toLowerCase() === "not specified") medicine.dosageForm = "";
  return medicine;
}

async function withCurrentAppointmentStatus(messages) {
  const appointmentIds = [
    ...new Set(
      messages
        .map((message) => message.appointmentId)
        .filter(Boolean)
        .map(String)
    ),
  ];
  if (appointmentIds.length === 0) return messages;

  const appointments = await Appointment.find({ _id: { $in: appointmentIds } })
    .select("_id status appointmentDate appointmentTime alternateDate alternateTime visitReason")
    .lean();
  const appointmentsById = new Map(
    appointments.map((appointment) => [String(appointment._id), appointment])
  );

  return messages.map((message) => {
    const appointment = appointmentsById.get(String(message.appointmentId));
    if (!appointment) return message;

    return {
      ...(typeof message.toObject === "function" ? message.toObject() : message),
      appointmentStatus: appointment.status,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      alternateDate: appointment.alternateDate ?? null,
      alternateTime: appointment.alternateTime ?? null,
      appointmentReason:
        appointment.visitReason ?? message.appointmentReason ?? null,
    };
  });
}

async function handleSendMessage(req, res) {
  try {
    const { text, doctorId, type, medicine, medicines } = req.body;
    const senderEmail = req.user.email;
    // Appointment cards are created automatically by the server when a
    // booking succeeds (see controllers/appointment.js) — clients cannot
    // forge them or smuggle appointment references through chat.
    if (type === "appointment" || req.body.appointmentId !== undefined) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Appointment messages are created automatically when booking." });
    }
    const wantsMedicineCard = type === "medicine" || medicine !== undefined || medicines !== undefined;

    let fileUrl = null;
    let fileName = null;
    let fileType = null;
    let fileSize = null;
    let mimeType = null;

    if (req.file) {
      const ext = path.extname(req.file.originalname || "").toLowerCase();
      const isImage =
        ALLOWED_IMAGE_TYPES.includes(req.file.mimetype) &&
        (ALLOWED_IMAGE_EXTS || []).includes(ext);
      const isDocument =
        ALLOWED_DOCUMENT_TYPES.includes(req.file.mimetype) &&
        (ALLOWED_DOCUMENT_EXTS || []).includes(ext);

      if (!isImage && !isDocument) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "This file type is not supported." });
      }

      const limit = isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
      if (req.file.size > limit) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File is too large." });
      }

      fileUrl = `/uploads/${req.file.filename}`;
      fileName = req.file.originalname;
      fileType = isImage ? "image" : "document";
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    }

    if (!text && !fileUrl && !wantsMedicineCard) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Medicine cards never carry file attachments — fail loudly instead of
    // leaving an orphan file on disk or silently dropping the attachment.
    if (wantsMedicineCard && req.file) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Attachments cannot be combined with medicine cards." });
    }

    if (doctorId) {
      if (!isValidObjectId(doctorId)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid doctor id" });
      }
      const doctor = await Doctor.findById(doctorId)
        .select("_id registeredBy approvalStatus isActive isAvailable")
        .lean();
      if (!doctor) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Doctor not found" });
      }
      const role = await getRequesterRole(senderEmail);
      if (role !== "patient" && role !== "doctor") {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Only patients and doctors can message doctors." });
      }
      if (role === "doctor") {
        const { patientId } = req.body;
        if (!patientId) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "patientId is required" });
        }
        if (!isValidObjectId(patientId)) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Invalid patient id" });
        }
        const ownDoctor = await Doctor.findOne({ _id: doctorId, registeredBy: senderEmail }).select("_id").lean();
        if (!ownDoctor) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "Not authorized for this doctor conversation" });
        }
        if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "Your doctor profile is not approved for messaging." });
        }
        const connection = await Connection.findOne({ patientId, doctorId: doctor._id }).lean();
        if (!connection) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "Patient is not connected to this doctor" });
        }
        const patient = await User.findById(patientId).select("email accountStatus").lean();
        if (!patient) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Patient not found" });
        }
        // A suspended patient must not receive new messages.
        if (patient.accountStatus === "suspended") {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "This patient account is suspended." });
        }
        if (wantsMedicineCard) {
          // Accept one snapshot (legacy `medicine`) or a list (newer
          // `medicines`). Every entry is re-validated; no entry is trusted
          // as-is and an invalid entry rejects the whole message so no
          // selection is silently dropped.
          const rawList = Array.isArray(medicines)
            ? medicines
            : medicine !== undefined
              ? [medicine]
              : [];
          if (rawList.length === 0 || rawList.length > 10) {
            return res.status(400).json({ error: "Invalid medicine reference" });
          }
          const cleanList = [];
          for (const raw of rawList) {
            const clean = sanitizeMedicine(raw);
            if (!clean) {
              return res.status(400).json({ error: "Invalid medicine reference" });
            }
            cleanList.push(clean);
          }
          const note = typeof text === "string" ? text.trim().slice(0, 500) : "";
          if (note.startsWith("/med")) {
            return res.status(400).json({ error: "Select a medicine from the suggestions to share it." });
          }
          const userMessage = await Message.create({
            senderEmail,
            recipientEmail: patient.email,
            text: note,
            type: "medicine",
            medicine: cleanList[cleanList.length - 1],
            medicines: cleanList,
            doctorId,
          });
          return res.status(201).json({ userMessage });
        }
        if (typeof text === "string" && text.trim().startsWith("/med")) {
          return res.status(400).json({ error: "Select a medicine from the suggestions to share it." });
        }
        const userMessage = await Message.create({
          senderEmail,
          recipientEmail: patient.email,
          text,
          fileUrl,
          fileName,
          fileType,
          fileSize,
          mimeType,
          doctorId,
        });
        return res.status(201).json({ userMessage });
      }
      // Only approved doctors can receive new messages.
      if (!isDoctorApproved(doctor)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "This doctor is not currently available." });
      }
      // A suspended doctor must not receive new messages.
      if (doctor.registeredBy) {
        const doctorUser = await User.findOne({ email: doctor.registeredBy })
          .select("accountStatus")
          .lean();
        if (doctorUser?.accountStatus === "suspended") {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "This doctor is currently unavailable." });
        }
      }
      if (wantsMedicineCard) {
        return res.status(403).json({ error: "Only doctors can share medicine cards" });
      }
      const userMessage = await Message.create({ senderEmail, text, fileUrl, fileName, fileType, fileSize, mimeType, doctorId });
      await Connection.findOneAndUpdate(
        { patientId: req.user._id, doctorId: doctor._id },
        { $setOnInsert: { status: "active" } },
        { upsert: true }
      );
      return res.status(201).json({ userMessage });
    }

    if (wantsMedicineCard) {
      return res.status(403).json({ error: "Only doctors can share medicine cards" });
    }

    const userMessage = await Message.create({ senderEmail, text, fileUrl, fileName, fileType, fileSize, mimeType });
    let aiMessage = null;
    let aiError = null;

    if (text?.trim()) {
      try {
        const aiText = await getAIhealthResponse(text.trim());
        aiMessage = await Message.create({
          senderEmail: "AI Assistant",
          recipientEmail: senderEmail,
          text: aiText,
        });
      } catch (err) {
        aiError = "AI reply is temporarily unavailable. Please try again.";
        console.error("AI response failed:", err.status ? `HTTP ${err.status}` : "", err.message);
      }
    }

    return res.status(201).json({ userMessage, aiMessage, aiError });
  } catch (err) {
    console.error("Send message failed:", err.message);
    return res.status(500).json({ error: "Failed to send message" });
  }
}

async function handleGetMessages(req, res) {
  try {
    if (req.query.doctorId) {
      if (!isValidObjectId(req.query.doctorId)) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      const role = await getRequesterRole(req.user.email);
      if (role === "doctor") {
        const { patientId } = req.query;
        if (!patientId) {
          return res.status(400).json({ error: "patientId is required" });
        }
        if (!isValidObjectId(patientId)) {
          return res.status(400).json({ error: "Invalid patient id" });
        }
        const ownDoctor = await Doctor.findOne({ _id: req.query.doctorId, registeredBy: req.user.email })
          .select("_id approvalStatus isActive")
          .lean();
        if (!ownDoctor) {
          return res.status(403).json({ error: "Not authorized for this doctor conversation" });
        }
        if (!isDoctorApproved(ownDoctor)) {
          return res.status(403).json({ error: "Your doctor profile is not approved for messaging." });
        }
        const connection = await Connection.findOne({ patientId, doctorId: ownDoctor._id }).lean();
        if (!connection) {
          return res.status(403).json({ error: "Patient is not connected to this doctor" });
        }
        const patient = await User.findById(patientId).select("email").lean();
        if (!patient) {
          return res.status(404).json({ error: "Patient not found" });
        }
        const messages = await Message.find({
          doctorId: ownDoctor._id,
          $or: [{ senderEmail: patient.email }, { recipientEmail: patient.email }],
        }).sort({ createdAt: 1 });
        return res.status(200).json(await withCurrentAppointmentStatus(messages));
      }
      if (role !== "patient") {
        return res.status(403).json({ error: "Only patients and doctors can access doctor messages." });
      }
      const doctor = await Doctor.findById(req.query.doctorId)
        .select("_id approvalStatus isActive isAvailable registeredBy")
        .lean();
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
        return res.status(403).json({ error: "This doctor is not currently available." });
      }
      if (doctor.registeredBy) {
        const doctorUser = await User.findOne({ email: doctor.registeredBy }).select("accountStatus").lean();
        if (doctorUser?.accountStatus === "suspended") {
          return res.status(403).json({ error: "This doctor is currently unavailable." });
        }
      }
      const patientConnection = await Connection.findOne({ patientId: req.user._id, doctorId: req.query.doctorId }).lean();
      if (!patientConnection) {
        return res.status(403).json({ error: "Not connected to this doctor" });
      }
      const messages = await Message.find({
        $or: [
          { senderEmail: req.user.email, doctorId: req.query.doctorId },
          { recipientEmail: req.user.email, doctorId: req.query.doctorId },
        ],
      }).sort({ createdAt: 1 });
      return res.status(200).json(await withCurrentAppointmentStatus(messages));
    }
    const messages = await Message.find({
      $or: [
        { senderEmail: req.user.email, doctorId: { $exists: false } },
        { recipientEmail: req.user.email, doctorId: { $exists: false } },
      ],
    }).sort({ createdAt: 1 });
    return res.status(200).json(await withCurrentAppointmentStatus(messages));
  } catch (err) {
    console.error("Get messages failed:", err.message);
    return res.status(500).json({ error: "Failed to get messages" });
  }
}

module.exports = { handleSendMessage, handleGetMessages };
