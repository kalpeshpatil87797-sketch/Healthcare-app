"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectToMongoDB } = require("../connect");
const User = require("../models/user");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();

  if (!email) {
    fail("SUPER_ADMIN_EMAIL is required. No changes were made.");
    return;
  }

  if (!EMAIL_PATTERN.test(email)) {
    fail("SUPER_ADMIN_EMAIL must be a valid email address. No changes were made.");
    return;
  }

  try {
    await connectToMongoDB(process.env.MONGODB ?? "mongodb://localhost:27017/Signup_data");

    // Existing login uses an exact email match, so this lookup does too.
    const user = await User.findOne({ email });
    if (!user) {
      fail("No account found for that email. Create a normal account first. No changes were made.");
      return;
    }

    if (user.role === "super_admin") {
      console.log(`Account already has super_admin role: ${maskEmail(email)}. No changes made.`);
      return;
    }

    const previousRole = user.role;
    user.role = "super_admin";
    await user.save();

    console.log(`Promoted: ${maskEmail(email)} (${previousRole} -> super_admin)`);
  } catch (err) {
    fail("Bootstrap failed. No further changes were attempted.");
  } finally {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (err) {
        // Ignore disconnect errors so they cannot mask the operation result.
      }
    }
  }
}

main().catch(() => {
  fail("Bootstrap failed unexpectedly.");
});
