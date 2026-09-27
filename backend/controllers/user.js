const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user");
const sendEmail = require("../utils/sendEmail");

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-this";

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
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
    return res.status(400).json({ error: err.message });
  }
}

async function handleUserLogin(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: "Invalid Username Or Password" });
  }

  const token = jwt.sign({ _id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  return res.status(200).json({
    message: "Login successful",
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role },
  });
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
  handleForgotPassword,
  handleResetPassword,
  handleGetProfile,
  handleUpdateLocation,
};

async function handleGetProfile(req, res) {
  try {
    const user = await User.findOne({ email: req.user.email }).select("-password -resetPasswordToken -resetPasswordExpires").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    let speciality = null;
    if (user.role === "doctor") {
      const Doctor = require("../models/doctor");
      const doctor = await Doctor.findOne({ registeredBy: req.user.email }).select("specialist").lean();
      speciality = doctor?.specialist ?? null;
    }
    return res.status(200).json({ ...user, speciality });
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