const crypto = require("crypto");
const AdminActionLock = require("../models/adminActionLock");

const LOCK_TTL_MS = 30 * 1000;
const LOCK_RETRIES = 4;
const LOCK_RETRY_MS = 75;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireDoctorApplicationLock(userId) {
  const lockId = `doctor-application:${userId}`;
  const owner = crypto.randomUUID();

  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
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
            expiresAt: new Date(Date.now() + LOCK_TTL_MS),
          },
        },
        { new: true, upsert: true }
      ).lean();

      if (lock?.owner === owner) return { lockId, owner };
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }

    if (attempt < LOCK_RETRIES - 1) await sleep(LOCK_RETRY_MS);
  }

  return null;
}

async function releaseDoctorApplicationLock(lock) {
  if (!lock) return;
  try {
    await AdminActionLock.deleteOne({ _id: lock.lockId, owner: lock.owner });
  } catch (err) {
    console.error("Doctor application lock release failed:", err.message);
  }
}

module.exports = {
  acquireDoctorApplicationLock,
  releaseDoctorApplicationLock,
};
