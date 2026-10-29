const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const sendEmail = require("../utils/sendEmail");

const JWT_SECRET = process.env.JWT_SECRET;

function getEffectiveRole(role, application) {
  if (role !== "doctor") return role;
  return application.doctorApprovalStatus === "approved" &&
    application.doctorProfileActive !== false
    ? "doctor"
    : "patient";
}

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

async function getDoctorApplicationStatus(email, role) {
  if (!["patient", "doctor"].includes(role)) {
    return {
      doctorApprovalStatus: null,
      doctorProfileActive: null,
      rejectionReason: null,
      doctorApplicationSubmittedAt: null,
    };
  }

  const doctor = await Doctor.findOne({ registeredBy: email })
    .select("approvalStatus isActive isAvailable rejectionReason submittedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .lean();

  return {
    doctorApprovalStatus: doctor
      ? doctor.approvalStatus ?? "approved"
      : role === "doctor"
        ? "approved"
        : null,
    doctorProfileActive: doctor ? doctor.isActive !== false : role === "doctor",
    doctorAvailability: doctor?.isAvailable ?? false,
    rejectionReason: doctor?.rejectionReason ?? null,
    doctorApplicationSubmittedAt: doctor?.submittedAt ?? null,
  };
}

async function handleUserSignup(req, res) {
  const { name, email, password, age, phone, address, latitude, longitude } = req.body;
  try {
    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);
    if (lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid location coordinates" });
    }
    const location = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : undefined;
    const user = await User.create({ name, email, password, age, phone, address, location });
    return res.status(201).json({ message: "User created successfully", userId: user._id });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (err?.name === "ValidationError" || err?.name === "CastError") {
      return res.status(400).json({ error: "Please provide valid registration details" });
    }
    console.error("User signup failed:", err.message);
    return res.status(500).json({ error: "Failed to create account" });
  }
}

async function handleUserLogin(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: "Invalid Username Or Password" });
  }

  if (user.accountStatus === "suspended") {
    return res.status(403).json({
      error: "This account has been suspended. Please contact the Root Owner.",
      code: "ACCOUNT_SUSPENDED",
    });
  }

  const application = await getDoctorApplicationStatus(user.email, user.role);
  const activeRole = getEffectiveRole(user.role, application);

  const token = jwt.sign(
    { _id: user._id, tv: user.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: activeRole,
      ...application,
    },
  });
}

async function handleLeaveDoctorRole(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .select("_id email role accountStatus tokenVersion")
      .lean();
    if (!user || user.role !== "doctor") {
      return res.status(409).json({
        error: "Only an active doctor account can leave doctor privileges.",
        code: "DOCTOR_PROFILE_NOT_ACTIVE",
      });
    }
    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended. Please contact the Root Owner.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const doctor = await Doctor.findOne({ registeredBy: user.email })
      .sort({ updatedAt: -1, _id: -1 })
      .lean();
    if (
      !doctor ||
      doctor.isActive === false ||
      (doctor.approvalStatus != null && doctor.approvalStatus !== "approved")
    ) {
      return res.status(409).json({
        error: "Only an active, approved doctor profile can be deactivated.",
        code: "DOCTOR_PROFILE_NOT_ACTIVE",
      });
    }

    const deactivated = await Doctor.findOneAndUpdate(
      {
        _id: doctor._id,
        isActive: { $ne: false },
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
        ],
      },
      { $set: { isActive: false, isAvailable: false } },
      { new: true, runValidators: true }
    )
      .select("_id")
      .lean();

    if (!deactivated) {
      return res.status(409).json({
        error: "The doctor profile changed before it could be deactivated. Refresh and try again.",
        code: "DOCTOR_PROFILE_CHANGED",
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        role: "doctor",
        accountStatus: { $ne: "suspended" },
      },
      {
        $set: { role: "patient" },
        $inc: { tokenVersion: 1 },
      },
      { new: true, runValidators: true }
    )
      .select("_id tokenVersion")
      .lean();

    if (!updatedUser) {
      console.warn(
        `[user-audit] action=doctor.self_remove actor=${user._id} target=${doctor._id} profile=inactive account_state_changed at=${new Date().toISOString()}`
      );
      return res.status(409).json({
        error: "Doctor access was disabled, but your account state changed. Sign in again to continue.",
        code: "ACCOUNT_STATE_CHANGED",
      });
    }

    const token = jwt.sign(
      { _id: updatedUser._id, tv: updatedUser.tokenVersion ?? 0 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.info(
      `[user-audit] action=doctor.self_remove actor=${user._id} target=${doctor._id} approved->inactive role=doctor->patient at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: "Doctor privileges removed. You can continue using the app as a patient.",
      token,
      role: "patient",
    });
  } catch (err) {
    console.error("Voluntary doctor removal failed:", err.message);
    return res.status(500).json({ error: "Failed to remove doctor privileges" });
  }
}

async function handleForgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "No account found with this email" });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  await user.save();

  const resetLink = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendEmail(
      user.email,
      "Password Reset Request",
      `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><a href="${resetLink}">${resetLink}</a>`
    );
    return res.status(200).json({ message: "Reset link sent to your email" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send email" });
  }
}

async function handleResetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ error: "Token is invalid or has expired" });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return res.status(200).json({ message: "Password reset successful" });
}

module.exports = {
  handleUserSignup,
  handleUserLogin,
  handleLeaveDoctorRole,
  handleForgotPassword,
  handleResetPassword,
  handleGetProfile,
  handleUpdateLocation,
};

async function handleGetProfile(req, res) {
  try {
    const user = await User.findOne({ email: req.user.email })
      .select("_id name email role age phone address location accountStatus createdAt updatedAt")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    let speciality = null;
    const application = await getDoctorApplicationStatus(user.email, user.role);
    const activeRole = getEffectiveRole(user.role, application);
    if (user.role === "doctor") {
      const doctor = await Doctor.findOne({ registeredBy: req.user.email })
        .select("specialist")
        .sort({ updatedAt: -1, _id: -1 })
        .lean();
      speciality = doctor?.specialist ?? null;
    }
    return res.status(200).json({
      ...user,
      role: activeRole,
      effectiveRole: activeRole,
      doctorAvailability: application.doctorAvailability,
      speciality,
      ...application,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get profile" });
  }
}

async function handleUpdateLocation(req, res) {
  try {
    const lat = parseCoordinate(req.body.latitude, -90, 90);
    const lng = parseCoordinate(req.body.longitude, -180, 180);
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }
    if (lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid location coordinates" });
    }
    const user = await User.findOneAndUpdate(
      { email: req.user.email },
      { location: { latitude: lat, longitude: lng } },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordExpires");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ message: "Location saved successfully", location: user.location });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save location" });
  }
}