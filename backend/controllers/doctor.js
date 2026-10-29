const mongoose = require("mongoose");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Connection = require("../models/connection");
const {
  acquireDoctorApplicationLock,
  releaseDoctorApplicationLock,
} = require("../utils/doctorApplicationLock");
const {
  buildDoctorReapplicationUpdate,
  canReapplyForDoctorProfile,
  isApprovedDoctorProfile,
  isBlockingDoctorApplication,
} = require("../utils/doctorApplicationStatus");

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

// Missing approvalStatus is legacy data and stays approved.
const APPROVED_DOCTOR_FILTER = {
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
};

function isDoctorApproved(doctor) {
  return isApprovedDoctorProfile(doctor);
}

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
    const user = await User.findById(req.user._id).select("_id email role accountStatus").lean();
    if (!user || !["patient", "doctor"].includes(user.role)) {
      return res.status(403).json({ error: "Only patient accounts can submit a doctor application." });
    }
    if (user.accountStatus === "suspended") {
      return res.status(403).json({ error: "Suspended accounts cannot submit doctor applications." });
    }
    if (typeof isAvailable !== "undefined" && typeof isAvailable !== "boolean") {
      return res.status(400).json({ error: "Invalid availability setting" });
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

    const applicationLock = await acquireDoctorApplicationLock(user._id);
    if (!applicationLock) {
      res.set("Retry-After", "2");
      return res.status(503).json({
        error: "Your doctor application is being updated. Please try again.",
        code: "DOCTOR_APPLICATION_BUSY",
      });
    }

    try {
      const existingApplications = await Doctor.find({ registeredBy: user.email })
        .select("_id approvalStatus isActive")
        .sort({ updatedAt: -1, _id: -1 })
        .lean();
      if (existingApplications.some(isBlockingDoctorApplication)) {
        return res.status(409).json({
          error: "A doctor application is already pending or approved.",
          code: "DOCTOR_APPLICATION_EXISTS",
        });
      }

      const existingApplication = existingApplications[0];
      if (existingApplication && !canReapplyForDoctorProfile(existingApplication)) {
        return res.status(409).json({
          error: "The existing doctor profile cannot be resubmitted. Contact an administrator.",
          code: "DOCTOR_APPLICATION_NOT_RESUBMITTABLE",
        });
      }
      const submittedAt = new Date();
      const fields = {
        name,
        clinicName,
        degree,
        specialist: specialistValue,
        clinicLocation,
        registeredBy: user.email,
        isAvailable: isAvailable ?? true,
        approvalStatus: "pending",
        submittedAt,
      };
      if (location) fields.location = location;

      let doctor;
      if (existingApplication) {
        const expectedState = existingApplication.approvalStatus === "rejected"
          ? { approvalStatus: "rejected" }
          : {
              isActive: false,
              $or: [
                { approvalStatus: "approved" },
                { approvalStatus: { $exists: false } },
              ],
            };
        const update = buildDoctorReapplicationUpdate(fields, submittedAt);
        if (!location) update.$unset.location = "";
        doctor = await Doctor.findOneAndUpdate(
          { _id: existingApplication._id, ...expectedState },
          update,
          { new: true, runValidators: true }
        );
        if (!doctor) {
          return res.status(409).json({
            error: "This application changed while you were resubmitting it. Please refresh.",
            code: "DOCTOR_APPLICATION_CHANGED",
          });
        }
      } else {
        doctor = await Doctor.create(fields);
      }

      if (user.role === "doctor") {
        await User.updateOne(
          { _id: user._id, role: "doctor", accountStatus: { $ne: "suspended" } },
          { $set: { role: "patient" } }
        );
      }

      return res.status(201).json({
        message: existingApplication
          ? "Doctor application resubmitted. An administrator must approve it before your profile is visible."
          : "Doctor registration submitted. An administrator must approve it before your profile is visible.",
        doctorId: doctor._id,
        role: "patient",
        approvalStatus: "pending",
        doctorProfileActive: doctor.isActive !== false,
        submittedAt: doctor.submittedAt,
        rejectionReason: null,
      });
    } finally {
      await releaseDoctorApplicationLock(applicationLock);
    }
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

    const matchQuery = {
      isAvailable: true,
      isActive: { $ne: false },
      ...APPROVED_DOCTOR_FILTER,
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

module.exports = { handleDoctorRegistration, handleNearbyDoctors, handleConnect, handleMyPatients, handleMyDoctors, SPECIALTIES };

async function getOwnDoctor(userEmail) {
  return Doctor.findOne({ registeredBy: userEmail })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
}

async function handleConnect(req, res) {
  try {
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
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
    if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(403).json({ error: "This doctor is not currently available." });
    }
    // A suspended doctor must not receive new connections.
    if (doctor.registeredBy) {
      const doctorUser = await User.findOne({ email: doctor.registeredBy })
        .select("accountStatus")
        .lean();
      if (doctorUser?.accountStatus === "suspended") {
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
    const role = await getRequesterRole(req.user.email);
    if (role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can access patient connections" });
    }
    const doctor = await getOwnDoctor(req.user.email);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    if (!isDoctorApproved(doctor) || doctor.isAvailable === false) {
      return res.status(403).json({ error: "Your doctor profile is not approved for patient access." });
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
    const role = await getRequesterRole(req.user.email);
    if (role !== "patient") {
      return res.status(403).json({ error: "Only patients can access doctor connections" });
    }

    const connections = await Connection.find({ patientId: req.user._id })
      .populate("doctorId", "name specialist clinicName clinicLocation degree isActive isAvailable approvalStatus registeredBy")
      .sort({ createdAt: -1 })
      .lean();
    const doctors = connections
      .filter((c) => c.doctorId && isDoctorApproved(c.doctorId))
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