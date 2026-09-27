const fs = require("fs");
const mongoose = require("mongoose");
const Message = require("../models/message");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");
const { getAIhealthResponse } = require("../utils/aiService");
const { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } = require("../middlewares/upload");

async function getRequesterRole(userEmail) {
  const user = await User.findOne({ email: userEmail }).select("role").lean();
  return user?.role ?? "patient";
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

async function handleSendMessage(req, res) {
  try {
    const { text, doctorId, type, medicine, medicines } = req.body;
    const senderEmail = req.user.email;
    const wantsMedicineCard = type === "medicine" || medicine !== undefined || medicines !== undefined;

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

    if (req.file) {
      const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);

      if (isImage && req.file.size > MAX_IMAGE_SIZE) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Image size must be under 5MB" });
      }

      fileUrl = `/uploads/${req.file.filename}`;
      fileName = req.file.originalname;
      fileType = isImage ? "image" : "document";
    }

    if (!text && !fileUrl && !wantsMedicineCard) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    if (doctorId) {
      const doctor = await Doctor.findById(doctorId).select("_id").lean();
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      const role = await getRequesterRole(senderEmail);
      if (role === "doctor") {
        const { patientId } = req.body;
        if (!patientId) {
          return res.status(400).json({ error: "patientId is required" });
        }
        const ownDoctor = await Doctor.findOne({ _id: doctorId, registeredBy: senderEmail }).select("_id").lean();
        if (!ownDoctor) {
          return res.status(403).json({ error: "Not authorized for this doctor conversation" });
        }
        const connection = await Connection.findOne({ patientId, doctorId: doctor._id }).lean();
        if (!connection) {
          return res.status(403).json({ error: "Patient is not connected to this doctor" });
        }
        const patient = await User.findById(patientId).select("email").lean();
        if (!patient) {
          return res.status(404).json({ error: "Patient not found" });
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
          doctorId,
        });
        return res.status(201).json({ userMessage });
      }
      if (wantsMedicineCard) {
        return res.status(403).json({ error: "Only doctors can share medicine cards" });
      }
      const userMessage = await Message.create({ senderEmail, text, fileUrl, fileName, fileType, doctorId });
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

    const userMessage = await Message.create({ senderEmail, text, fileUrl, fileName, fileType });
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
      const role = await getRequesterRole(req.user.email);
      if (role === "doctor") {
        const { patientId } = req.query;
        if (!patientId) {
          return res.status(400).json({ error: "patientId is required" });
        }
        const ownDoctor = await Doctor.findOne({ _id: req.query.doctorId, registeredBy: req.user.email }).select("_id").lean();
        if (!ownDoctor) {
          return res.status(403).json({ error: "Not authorized for this doctor conversation" });
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
          doctorId: req.query.doctorId,
          $or: [{ senderEmail: patient.email }, { recipientEmail: patient.email }],
        }).sort({ createdAt: 1 });
        return res.status(200).json(messages);
      }
      if (!mongoose.Types.ObjectId.isValid(req.query.doctorId)) {
        return res.status(404).json({ error: "Doctor not found" });
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
      return res.status(200).json(messages);
    }
    const messages = await Message.find({
      $or: [
        { senderEmail: req.user.email, doctorId: { $exists: false } },
        { recipientEmail: req.user.email, doctorId: { $exists: false } },
      ],
    }).sort({ createdAt: 1 });
    return res.status(200).json(messages);
  } catch (err) {
    console.error("Get messages failed:", err.message);
    return res.status(500).json({ error: "Failed to get messages" });
  }
}

module.exports = { handleSendMessage, handleGetMessages };
