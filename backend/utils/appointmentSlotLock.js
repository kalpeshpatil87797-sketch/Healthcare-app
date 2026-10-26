const crypto = require("crypto");
const AdminActionLock = require("../models/adminActionLock");

const SLOT_LOCK_TTL_MS = 30 * 1000;
const SLOT_LOCK_RETRIES = 4;
const SLOT_LOCK_RETRY_MS = 75;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAppointmentSlotLock(doctorId, date, time) {
  const lockId = `appointment-slot:${doctorId}:${date}:${time}`;
  const owner = crypto.randomUUID();

  for (let attempt = 0; attempt < SLOT_LOCK_RETRIES; attempt += 1) {
    try {
      const lock = await AdminActionLock.findOneAndUpdate(
        {
          _id: lockId,
          $or: [
            { expiresAt: { $lte: new Date() } },
            { expiresAt: null },
            { expiresAt: { $exists: false } },
          ],
        },
        {
          $set: {
            owner,
            expiresAt: new Date(Date.now() + SLOT_LOCK_TTL_MS),
          },
        },
        { new: true, upsert: true }
      ).lean();

      if (lock?.owner === owner) return { lockId, owner };
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }

    if (attempt < SLOT_LOCK_RETRIES - 1) {
      await sleep(SLOT_LOCK_RETRY_MS);
    }
  }

  return null;
}

async function releaseAppointmentSlotLock(lock) {
  if (!lock) return;

  try {
    await AdminActionLock.deleteOne({ _id: lock.lockId, owner: lock.owner });
  } catch (err) {
    console.error("Appointment slot lock release failed:", err.message);
  }
}

module.exports = {
  acquireAppointmentSlotLock,
  releaseAppointmentSlotLock,
};
