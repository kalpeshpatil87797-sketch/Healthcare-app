const mongoose = require("mongoose");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");
const {
  getEffectiveRole,
  getAuthorizedDoctor,
  isDoctorApproved,
  canSubmitDoctorApplication,
  DOCTOR_APPLICATION_ROLES,
} = require("../utils/doctorAccess");

const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Neurologist",
  "Dermatologist",
  "Pediatrician",
  "Orthopedic",
  "Gynecologist",
  "ENT Specialist",
  "Psychiatrist",
  "Dentist",
  "Ophthalmologist",
  "Pulmonologist",
  "Gastroenterologist",
  "Urologist",
  "Endocrinologist",
];

function resolveSpecialty(value) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const match = SPECIALTIES.find((s) => s.toLowerCase() === String(value).trim().toLowerCase());
  return match ?? null;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

async function handleDoctorRegistration(req, res) {
  const { name, clinicName, degree, specialist, specialistType, clinicLocation, latitude, longitude, isAvailable } = req.body;
  const specialistValue = specialist ?? specialistType;

  try {
    if (!canSubmitDoctorApplication(req.user.role)) {
      return res.status(403).json({ error: "This account cannot apply for doctor privileges." });
    }

    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);
    if (lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid location coordinates" });
    }
    const location =
      lat !== undefined && lng !== undefined
        ? { type: "Point", coordinates: [lng, lat] }
        : undefined;

    const doctor = await Doctor.create({
      name,
      clinicName,
      degree,
      specialist: specialistValue,
      clinicLocation,
      registeredBy: req.user.email,
      isAvailable: isAvailable ?? true,
      approvalStatus: "pending",
      location,
    });

    await User.updateOne(
      {
        email: req.user.email,
        role: { $in: DOCTOR_APPLICATION_ROLES },
      },
      { $set: { role: "doctor" } }
    );

    return res.status(201).json({
      message: "Doctor registration submitted. A Super Admin must approve it before your profile is visible.",
      doctorId: doctor._id,
      approvalStatus: "pending",
    });
  } catch (err) {
    if (err?.name === "ValidationError" || err?.name === "CastError") {
      return res.status(400).json({ error: "Please provide valid doctor registration details" });
    }
    console.error("Doctor registration failed:", err.message);
    return res.status(500).json({ error: "Failed to submit doctor registration" });
  }
}

async function handleNearbyDoctors(req, res) {
  try {
    const lat = parseCoordinate(req.query.latitude ?? req.query.lat, -90, 90);
    const lng = parseCoordinate(req.query.longitude ?? req.query.lng, -180, 180);
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }
    if (lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid location coordinates" });
    }
    const radiusKm = Number(req.query.radiusKm ?? req.query.radius ?? 10);
    const safeRadiusKm = Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 0.5), 100) : 10;

    const specialty = resolveSpecialty(req.query.specialty);
    if (specialty === null) {
      return res.status(400).json({ error: "Invalid specialty" });
    }

    const activeDoctors = await User.find({
      role: "doctor",
      accountStatus: { $ne: "suspended" },
    }).select("email").lean();
    const matchQuery = {
      isAvailable: true,
      approvalStatus: { $in: ["approved", null] },
      registeredBy: { $in: activeDoctors.map((user) => user.email) },
    };
    if (specialty !== undefined) {
      matchQuery.specialist = { $regex: `^${escapeRegExp(specialty)}$`, $options: "i" };
    }

    const doctors = await Doctor.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distKm",
          distanceMultiplier: 0.001,
          maxDistance: safeRadiusKm * 1000,
          spherical: true,
          query: matchQuery,
        },
      },
      { $limit: 50 },
      {
        $project: {
          name: 1,
          clinicName: 1,
          degree: 1,
          specialist: 1,
          clinicLocation: 1,
          isAvailable: 1,
          location: 1,
          distKm: 1,
        },
      },
    ]);

    const result = doctors.map((d) => ({
      _id: d._id,
      name: d.name,
      specialist: d.specialist,
      clinicName: d.clinicName,
      degree: d.degree,
      clinicLocation: d.clinicLocation,
      isAvailable: d.isAvailable,
      latitude: d.location?.coordinates?.[1],
      longitude: d.location?.coordinates?.[0],
      distanceKm: d.distKm !== undefined ? Math.round(d.distKm * 10) / 10 : undefined,
    }));

    return res.status(200).json({ count: result.length, radiusKm: safeRadiusKm, specialty, doctors: result });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch nearby doctors" });
  }
}

async function handleSearchDoctors(req, res) {
  try {
    const specialty = resolveSpecialty(req.query.specialty);
    if (specialty === null) {
      return res.status(400).json({ error: "Invalid specialty" });
    }

    const location =
      typeof req.query.location === "string" ? req.query.location.trim().slice(0, 100) : "";
    const activeDoctors = await User.find({
      role: "doctor",
      accountStatus: { $ne: "suspended" },
    }).select("email").lean();
    const query = {
      isAvailable: true,
      approvalStatus: { $in: ["approved", null] },
      registeredBy: { $in: activeDoctors.map((user) => user.email) },
    };
    if (specialty !== undefined) {
      query.specialist = { $regex: `^${escapeRegExp(specialty)}$`, $options: "i" };
    }
    if (location) {
      query.clinicLocation = { $regex: escapeRegExp(location), $options: "i" };
    }

    const doctors = await Doctor.find(query)
      .select("_id name clinicName degree specialist clinicLocation isAvailable")
      .sort({ name: 1 })
      .limit(50)
      .lean();
    return res.status(200).json({ count: doctors.length, doctors });
  } catch (err) {
    console.error("Search doctors failed:", err.message);
    return res.status(500).json({ error: "Failed to search doctors" });
  }
}

async function handleUpdateAvailability(req, res) {
  try {
    if (typeof req.body?.isAvailable !== "boolean") {
      return res.status(400).json({ error: "isAvailable must be a boolean" });
    }
    const doctor = await getAuthorizedDoctor(req.user.email);
    if (!doctor) {
      return res.status(403).json({ error: "Only approved doctors can manage availability" });
    }

    const updated = await Doctor.findOneAndUpdate(
      { _id: doctor._id, registeredBy: req.user.email },
      { $set: { isAvailable: req.body.isAvailable } },
      { new: true, runValidators: true }
    ).select("_id isAvailable").lean();
    if (!updated) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    return res.status(200).json({ isAvailable: updated.isAvailable });
  } catch (err) {
    console.error("Update doctor availability failed:", err.message);
    return res.status(500).json({ error: "Failed to update doctor availability" });
  }
}

module.exports = {
  handleDoctorRegistration,
  handleNearbyDoctors,
  handleSearchDoctors,
  handleUpdateAvailability,
  handleConnect,
  handleMyPatients,
  handleMyDoctors,
  SPECIALTIES,
};

async function getOwnDoctor(userEmail) {
  return getAuthorizedDoctor(userEmail);
}

async function handleConnect(req, res) {
  try {
    if ((await getEffectiveRole(req.user.email)) !== "patient") {
      return res.status(403).json({ error: "Only patients can connect with doctors" });
    }

    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ error: "doctorId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const doctor = await Doctor.findById(doctorId)
      .select("_id registeredBy approvalStatus isAvailable")
      .lean();
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    // Only approved doctors can receive new connections.
    if (!isDoctorApproved(doctor) || doctor.isAvailable !== true) {
      return res.status(403).json({ error: "This doctor is not currently available." });
    }
    // A suspended doctor must not receive new connections.
    if (doctor.registeredBy) {
      const doctorUser = await User.findOne({
        email: doctor.registeredBy,
        role: "doctor",
        accountStatus: { $ne: "suspended" },
      })
        .select("_id")
        .lean();
      if (!doctorUser) {
        return res.status(403).json({ error: "This doctor is currently unavailable." });
      }
    }
    const connection = await Connection.findOneAndUpdate(
      { patientId: req.user._id, doctorId: doctor._id },
      { $setOnInsert: { status: "active" } },
      { new: true, upsert: true }
    ).lean();
    return res.status(201).json({ message: "Connected with doctor successfully", connectionId: connection._id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to connect with doctor" });
  }
}

async function handleMyPatients(req, res) {
  try {
    const doctor = await getOwnDoctor(req.user.email);
    if (!doctor) {
      return res.status(403).json({ error: "Only doctors can access patient connections" });
    }
    const connections = await Connection.find({ doctorId: doctor._id })
      .populate("patientId", "name age")
      .sort({ createdAt: -1 })
      .lean();
    const patients = connections
      .filter((c) => c.patientId)
      .map((c) => ({
        patientId: c.patientId._id,
        name: c.patientId.name,
        age: c.patientId.age,
        status: c.status,
        connectedAt: c.createdAt,
      }));
    return res.status(200).json({ count: patients.length, doctorId: doctor._id, patients });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch connected patients" });
  }
}

async function handleMyDoctors(req, res) {
  try {
    if ((await getEffectiveRole(req.user.email)) !== "patient") {
      return res.status(403).json({ error: "Only patients can access doctor connections" });
    }

    const connections = await Connection.find({ patientId: req.user._id })
      .populate("doctorId", "name specialist clinicName clinicLocation degree isAvailable")
      .sort({ createdAt: -1 })
      .lean();
    const doctors = connections
      .filter((c) => c.doctorId)
      .map((c) => ({
        _id: c.doctorId._id,
        name: c.doctorId.name,
        specialist: c.doctorId.specialist,
        clinicName: c.doctorId.clinicName,
        clinicLocation: c.doctorId.clinicLocation,
        degree: c.doctorId.degree,
        isAvailable: c.doctorId.isAvailable,
        status: c.status,
        connectedAt: c.createdAt,
      }));
    return res.status(200).json({ count: doctors.length, doctors });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch connected doctors" });
  }
}