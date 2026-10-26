const mongoose = require("mongoose");

// Single-document lease used to serialize account-status changes. A short TTL
// lets a crashed request's lock expire instead of blocking admin actions
// forever; release only matches the owner so a takeover cannot be released by
// the previous holder.
const adminActionLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("adminActionLock", adminActionLockSchema);
