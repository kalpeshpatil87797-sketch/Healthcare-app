"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
const { connectToMongoDB } = require("../connect");
const User = require("../models/user");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NORMAL_ROLES = ["patient", "doctor"];
const OWNER_CONFIRMATION = (email) => `DESIGNATE ROOT OWNER ${email}`;
const LEGACY_MIGRATION_CONFIRMATION = "MIGRATE ALL LEGACY SUPER ADMINS TO ADMIN";
const ROOT_OWNER_INDEX_NAME = "unique_root_owner_role";
const ROOT_OWNER_INDEX_KEY = { role: 1 };
const ROOT_OWNER_INDEX_FILTER = { role: "root_owner" };

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function hasExactObjectValues(actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) =>
        key === expectedKeys[index] && actual[key] === expected[key]
    )
  );
}

async function ensureRootOwnerIndex() {
  const indexes = await User.collection.indexes();
  const roleIndexes = indexes.filter((index) =>
    hasExactObjectValues(index.key, ROOT_OWNER_INDEX_KEY)
  );
  const equivalent = roleIndexes.find(
    (index) =>
      index.unique === true &&
      hasExactObjectValues(
        index.partialFilterExpression,
        ROOT_OWNER_INDEX_FILTER
      )
  );

  if (roleIndexes.some((index) => index !== equivalent)) {
    throw new Error(
      "An existing role index does not match the required Root Owner uniqueness constraint."
    );
  }
  if (equivalent) return;

  if (indexes.some((index) => index.name === ROOT_OWNER_INDEX_NAME)) {
    throw new Error(
      `Index ${ROOT_OWNER_INDEX_NAME} exists but is incompatible with the required Root Owner constraint.`
    );
  }

  await User.collection.createIndex(ROOT_OWNER_INDEX_KEY, {
    unique: true,
    partialFilterExpression: ROOT_OWNER_INDEX_FILTER,
    name: ROOT_OWNER_INDEX_NAME,
  });
}

function safeErrorDetails(err) {
  const message =
    typeof err?.message === "string"
      ? err.message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, "[REDACTED_MONGODB_URI]")
      : "Unknown error";

  return {
    name: typeof err?.name === "string" ? err.name : "Error",
    code: typeof err?.code === "string" || typeof err?.code === "number"
      ? err.code
      : undefined,
    message,
  };
}

async function main() {
  const email = process.env.ROOT_OWNER_EMAIL?.trim();
  const confirmation = process.env.ROOT_OWNER_CONFIRM;
  const migrateLegacy = process.env.MIGRATE_SUPER_ADMINS === "true";
  const migrationConfirmation = process.env.MIGRATE_SUPER_ADMINS_CONFIRM;

  if (!email || !EMAIL_PATTERN.test(email)) {
    fail("Set ROOT_OWNER_EMAIL to the exact, verified account email. No changes were made.");
    return;
  }
  if (migrateLegacy && migrationConfirmation !== LEGACY_MIGRATION_CONFIRMATION) {
    fail("Explicit legacy migration confirmation is required. No changes were made.");
    return;
  }

  try {
    await connectToMongoDB(process.env.MONGODB ?? "mongodb://localhost:27017/Signup_data");

    const [target, rootOwners, legacyUsers] = await Promise.all([
      User.findOne({ email }).select("_id email role accountStatus +roleBeforeAdmin +roleBeforeSuperAdmin"),
      User.find({ role: "root_owner" }).select("_id email"),
      User.find({ role: "super_admin" }).select("_id email roleBeforeSuperAdmin"),
    ]);

    if (!target) {
      fail("No account found for ROOT_OWNER_EMAIL. Verify the account manually first. No changes were made.");
      return;
    }
    if (target.accountStatus === "suspended") {
      fail("The selected owner account is suspended. Reactivate and verify it manually first. No changes were made.");
      return;
    }
    if (!["patient", "doctor", "admin", "root_owner", "super_admin"].includes(target.role)) {
      fail("The selected account has an unsupported role. No changes were made.");
      return;
    }
    if (rootOwners.length > 1 || (rootOwners.length === 1 && String(rootOwners[0]._id) !== String(target._id))) {
      fail("A different or multiple Root Owner records already exist. Reconcile them manually; no changes were made.");
      return;
    }

    const otherLegacyUsers = legacyUsers.filter(
      (user) => String(user._id) !== String(target._id)
    );
    if (
      migrateLegacy &&
      otherLegacyUsers.some((user) => !NORMAL_ROLES.includes(user.roleBeforeSuperAdmin))
    ) {
      fail("At least one legacy account has no saved patient/doctor role. Review and repair it manually; no changes were made.");
      return;
    }

    console.log(`Selected owner account: ${maskEmail(email)} (${target.role} -> root_owner)`);
    console.log(`Legacy Super Admin accounts found: ${legacyUsers.length}.`);
    for (const legacyUser of legacyUsers) {
      console.log(
        `Legacy account: ${maskEmail(legacyUser.email)} savedRole=${NORMAL_ROLES.includes(legacyUser.roleBeforeSuperAdmin) ? legacyUser.roleBeforeSuperAdmin : "REVIEW_REQUIRED"}`
      );
    }
    if (otherLegacyUsers.length && !migrateLegacy) {
      console.log("Legacy accounts will remain unchanged and cannot use the new admin dashboard.");
    }
    if (confirmation !== OWNER_CONFIRMATION(email)) {
      console.log(`Preview only. To apply, set ROOT_OWNER_CONFIRM exactly to: ${OWNER_CONFIRMATION(email)}`);
      console.log("No database roles were changed.");
      return;
    }

    await ensureRootOwnerIndex();
    const currentOwners = await User.find({ role: "root_owner" }).select("_id");
    if (
      currentOwners.length > 1 ||
      (currentOwners.length === 1 && String(currentOwners[0]._id) !== String(target._id))
    ) {
      fail("A different Root Owner appeared during verification. No role changes were made.");
      return;
    }

    if (target.role !== "root_owner") {
      const designated = await User.findOneAndUpdate(
        { _id: target._id, role: target.role, accountStatus: { $ne: "suspended" } },
        {
          $set: { role: "root_owner" },
          $unset: { roleBeforeAdmin: 1, roleBeforeSuperAdmin: 1 },
          $inc: { tokenVersion: 1 },
        },
        { new: true, runValidators: true }
      )
        .select("_id role")
        .lean();

      if (!designated) {
        fail("The selected account changed during bootstrap. No legacy accounts were migrated.");
        return;
      }

      console.info(
        `[admin-audit] action=user.change_role actor=bootstrap target=${target._id} oldRole=${target.role} newRole=root_owner at=${new Date().toISOString()}`
      );
    }

    console.log(`Root Owner designated: ${maskEmail(email)}.`);

    if (!migrateLegacy) return;

    for (const legacyUser of otherLegacyUsers) {
      const migrated = await User.updateOne(
        { _id: legacyUser._id, role: "super_admin" },
        {
          $set: {
            role: "admin",
            roleBeforeAdmin: legacyUser.roleBeforeSuperAdmin,
          },
          $unset: { roleBeforeSuperAdmin: 1 },
          $inc: { tokenVersion: 1 },
        },
        { runValidators: true }
      );
      if (migrated.modifiedCount !== 1) {
        fail(`Legacy migration stopped at ${maskEmail(legacyUser.email)}. Review remaining accounts manually.`);
        return;
      }
      console.info(
        `[admin-audit] action=user.change_role actor=bootstrap target=${legacyUser._id} oldRole=super_admin newRole=admin at=${new Date().toISOString()}`
      );
    }

    console.log(`Migrated ${otherLegacyUsers.length} verified legacy account(s) to Admin.`);
  } catch (err) {
    const details = safeErrorDetails(err);
    if (err?.code === 11000) {
      fail("A Root Owner already exists or was designated concurrently. Verify the database; no further changes were attempted.");
      console.error("Bootstrap diagnostic:", details);
      return;
    }
    console.error("Root Owner bootstrap failed. Verify configuration and inspect database availability.");
    console.error("Bootstrap diagnostic:", details);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (err) {
        console.error("MongoDB disconnect failed after bootstrap.");
        console.error("Bootstrap diagnostic:", safeErrorDetails(err));
        process.exitCode = 1;
      }
    }
  }
}

main().catch((err) => {
  console.error("Root Owner bootstrap failed unexpectedly.");
  console.error("Bootstrap diagnostic:", safeErrorDetails(err));
  process.exitCode = 1;
});
