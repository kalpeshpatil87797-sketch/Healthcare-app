const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const Appointment = require("../models/appointment");
const Connection = require("../models/connection");
const AdminActionLock = require("../models/adminActionLock");
const { syncAppointmentMessage } = require("./appointment");
const {
  acquireAppointmentSlotLock,
  releaseAppointmentSlotLock,
} = require("../utils/appointmentSlotLock");

const USER_ROLES = User.schema.path("role").enumValues;
const ACCOUNT_STATUSES = User.schema.path("accountStatus").enumValues;
const DOCTOR_APPROVAL_STATUSES = Doctor.schema.path("approvalStatus").enumValues;
const APPOINTMENT_STATUSES = Appointment.schema.path("status").enumValues;

const STATUS_LOCK_ID = "user-account-status";
const STATUS_LOCK_TTL_MS = 30 * 1000;
const STATUS_LOCK_RETRIES = 4;
const STATUS_LOCK_RETRY_MS = 75;

const USER_SORT_FIELDS = ["createdAt", "name", "email", "role"];
const DOCTOR_SORT_FIELDS = ["createdAt", "name", "specialist", "isAvailable"];
const APPOINTMENT_SORT_FIELDS = [
  "appointmentDate",
  "status",
  "createdAt",
  "updatedAt",
];

// These are the only status changes already supported by the patient/doctor
// workflows. Terminal states stay terminal, and completion has no workflow yet.
const APPOINTMENT_TRANSITIONS = Object.freeze({
  pending: ["accepted", "rejected", "cancelled"],
  alternate_requested: ["accepted"],
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_REJECTION_REASON_LENGTH = 500;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePagination(query) {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE);
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);

  if (page === null || limit === null) return null;
  return { page, limit };
}

function parsePositiveInt(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  if (max !== undefined && parsed > max) return null;

  return parsed;
}

function parseSort(query, allowedFields, defaultField) {
  const sort = query.sort === undefined ? defaultField : query.sort;
  if (typeof sort !== "string" || !allowedFields.includes(sort)) return null;

  const order = query.order === undefined ? "desc" : query.order;
  if (order !== "asc" && order !== "desc") return null;

  return { sort, order };
}

function parseSearch(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length > MAX_SEARCH_LENGTH) return null;

  return trimmed;
}

function parseRole(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const role = value.trim();
  if (!role || !USER_ROLES.includes(role)) return null;

  return role;
}

function normalizeAccountStatus(value) {
  return value === "suspended" ? "suspended" : "active";
}

function parseAccountStatus(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const status = value.trim();
  if (!status || !ACCOUNT_STATUSES.includes(status)) return null;

  return status;
}

function normalizeDoctorApproval(value) {
  return value === "pending" || value === "rejected" ? value : "approved";
}

function parseDoctorApproval(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const status = value.trim();
  if (!status || !DOCTOR_APPROVAL_STATUSES.includes(status)) return null;

  return status;
}

function parseRejectionReason(value) {
  if (typeof value !== "string") return null;

  const reason = value.trim();
  if (!reason || reason.length > MAX_REJECTION_REASON_LENGTH) return null;

  return reason;
}

function parseAppointmentStatus(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const status = value.trim();
  if (!status || !APPOINTMENT_STATUSES.includes(status)) return null;

  return status;
}

function getAllowedAppointmentTransitions(status) {
  return [...(APPOINTMENT_TRANSITIONS[status] ?? [])];
}

function toAdminAppointmentView(appointment) {
  const patient =
    appointment.patientId &&
    typeof appointment.patientId === "object" &&
    "name" in appointment.patientId
      ? appointment.patientId
      : null;
  const doctor =
    appointment.doctorId &&
    typeof appointment.doctorId === "object" &&
    "name" in appointment.doctorId
      ? appointment.doctorId
      : null;

  return {
    _id: appointment._id,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status,
    alternateDate: appointment.alternateDate ?? null,
    alternateTime: appointment.alternateTime ?? null,
    requestedAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    patient: patient
      ? {
          _id: patient._id,
          name: patient.name || "",
          email: patient.email || "",
          age: patient.age ?? null,
        }
      : null,
    doctor: doctor
      ? {
          _id: doctor._id,
          name: doctor.name || "",
          specialist: doctor.specialist || "",
          clinicName: doctor.clinicName || "",
          registeredBy: doctor.registeredBy || "",
        }
      : null,
    allowedTransitions: getAllowedAppointmentTransitions(appointment.status),
  };
}

function parseSpecialty(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const specialty = value.trim();
  if (!specialty || specialty.length > MAX_SEARCH_LENGTH) return null;

  return specialty;
}

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function buildPaginationMeta(total, page, limit, sort, order) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1 && total > 0,
    sort,
    order,
  };
}

async function handleGetAdminStats(req, res) {
  try {
    const [
      totalUsers,
      userRoleCounts,
      totalDoctorProfiles,
      availableDoctorProfiles,
      totalAppointments,
      appointmentStatusCounts,
    ] = await Promise.all([
      User.countDocuments({}),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Doctor.countDocuments({}),
      Doctor.countDocuments({
        isAvailable: true,
        approvalStatus: { $nin: ["pending", "rejected"] },
      }),
      Appointment.countDocuments({}),
      Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const usersByRole = Object.fromEntries(USER_ROLES.map((role) => [role, 0]));
    for (const item of userRoleCounts) {
      if (item._id && Object.prototype.hasOwnProperty.call(usersByRole, item._id)) {
        usersByRole[item._id] = item.count;
      }
    }

    const appointmentsByStatus = Object.fromEntries(
      APPOINTMENT_STATUSES.map((status) => [status, 0])
    );
    for (const item of appointmentStatusCounts) {
      if (item._id && Object.prototype.hasOwnProperty.call(appointmentsByStatus, item._id)) {
        appointmentsByStatus[item._id] = item.count;
      }
    }

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        byRole: usersByRole,
      },
      doctors: {
        totalProfiles: totalDoctorProfiles,
        available: availableDoctorProfiles,
        unavailable: totalDoctorProfiles - availableDoctorProfiles,
      },
      appointments: {
        total: totalAppointments,
        byStatus: appointmentsByStatus,
      },
    });
  } catch (err) {
    console.error("Admin stats failed:", err.message);
    return res.status(500).json({ error: "Failed to load dashboard statistics" });
  }
}

async function handleListUsers(req, res) {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const sortOptions = parseSort(req.query, USER_SORT_FIELDS, "createdAt");
    if (!sortOptions) {
      return res.status(400).json({ error: "Invalid sort parameters" });
    }

    const role = parseRole(req.query.role);
    if (role === null) {
      return res.status(400).json({ error: "Invalid role filter" });
    }

    const search = parseSearch(req.query.search);
    if (search === null) {
      return res.status(400).json({ error: "Invalid search parameter" });
    }

    const accountStatus = parseAccountStatus(req.query.accountStatus);
    if (accountStatus === null) {
      return res.status(400).json({ error: "Invalid account status filter" });
    }

    const query = {};
    if (role) query.role = role;
    if (accountStatus === "active") {
      // Legacy users without the field are active.
      query.accountStatus = { $ne: "suspended" };
    } else if (accountStatus === "suspended") {
      query.accountStatus = "suspended";
    }
    if (search) {
      const regex = new RegExp(escapeRegExp(search), "i");
      query.$or = [{ name: regex }, { email: regex }];
    }

    const { page, limit } = pagination;
    const { sort, order } = sortOptions;
    const sortSpec = { [sort]: order === "asc" ? 1 : -1, _id: order === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .select("_id name email role age phone accountStatus createdAt updatedAt")
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const data = users.map((user) => ({
      ...user,
      accountStatus: normalizeAccountStatus(user.accountStatus),
    }));

    return res.status(200).json({
      data,
      meta: buildPaginationMeta(total, page, limit, sort, order),
    });
  } catch (err) {
    console.error("Admin users list failed:", err.message);
    return res.status(500).json({ error: "Failed to load users" });
  }
}

async function handleListDoctors(req, res) {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const sortOptions = parseSort(req.query, DOCTOR_SORT_FIELDS, "createdAt");
    if (!sortOptions) {
      return res.status(400).json({ error: "Invalid sort parameters" });
    }

    const search = parseSearch(req.query.search);
    if (search === null) {
      return res.status(400).json({ error: "Invalid search parameter" });
    }

    const specialty = parseSpecialty(req.query.specialist);
    if (specialty === null) {
      return res.status(400).json({ error: "Invalid specialty filter" });
    }

    const isAvailable = parseBoolean(req.query.isAvailable);
    if (isAvailable === null) {
      return res.status(400).json({ error: "Invalid availability filter" });
    }

    const approvalStatus = parseDoctorApproval(req.query.approvalStatus);
    if (approvalStatus === null) {
      return res.status(400).json({ error: "Invalid approval status filter" });
    }

    const conditions = [];
    if (search) {
      const regex = new RegExp(escapeRegExp(search), "i");
      conditions.push({
        $or: [
          { name: regex },
          { clinicName: regex },
          { specialist: regex },
          { registeredBy: regex },
        ],
      });
    }
    if (specialty) {
      conditions.push({ specialist: new RegExp(`^${escapeRegExp(specialty)}$`, "i") });
    }
    if (approvalStatus === "approved") {
      // Legacy doctor profiles without the field remain approved.
      conditions.push({ approvalStatus: { $nin: ["pending", "rejected"] } });
    } else if (approvalStatus) {
      conditions.push({ approvalStatus });
    }
    if (isAvailable === true) {
      conditions.push(
        { approvalStatus: { $nin: ["pending", "rejected"] } },
        { isAvailable: true }
      );
    } else if (isAvailable === false) {
      conditions.push({
        $or: [
          { approvalStatus: { $in: ["pending", "rejected"] } },
          { isAvailable: false },
        ],
      });
    }
    const query = conditions.length ? { $and: conditions } : {};

    const { page, limit } = pagination;
    const { sort, order } = sortOptions;
    const sortSpec = { [sort]: order === "asc" ? 1 : -1, _id: order === "asc" ? 1 : -1 };

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .select(
          "_id name clinicName degree specialist clinicLocation registeredBy isAvailable approvalStatus rejectionReason reviewedAt location createdAt updatedAt"
        )
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Doctor.countDocuments(query),
    ]);

    const emails = [...new Set(doctors.map((doctor) => doctor.registeredBy).filter(Boolean))];
    const linkedUsers = emails.length
      ? await User.find({ email: { $in: emails } })
          .select("_id name email role accountStatus")
          .lean()
      : [];
    const usersByEmail = new Map(linkedUsers.map((user) => [user.email, user]));

    const data = doctors.map((doctor) => {
      const doctorApprovalStatus = normalizeDoctorApproval(doctor.approvalStatus);

      return {
        _id: doctor._id,
        name: doctor.name,
        clinicName: doctor.clinicName,
        degree: doctor.degree,
        specialist: doctor.specialist,
        clinicLocation: doctor.clinicLocation,
        registeredBy: doctor.registeredBy,
        approvalStatus: doctorApprovalStatus,
        rejectionReason: doctor.rejectionReason || "",
        reviewedAt: doctor.reviewedAt ?? null,
        isAvailable:
          doctorApprovalStatus === "approved" && doctor.isAvailable !== false,
        latitude: doctor.location?.coordinates?.[1] ?? null,
        longitude: doctor.location?.coordinates?.[0] ?? null,
        linkedUser: usersByEmail.get(doctor.registeredBy) ?? null,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
      };
    });

    return res.status(200).json({
      data,
      meta: buildPaginationMeta(total, page, limit, sort, order),
    });
  } catch (err) {
    console.error("Admin doctors list failed:", err.message);
    return res.status(500).json({ error: "Failed to load doctors" });
  }
}

async function findAppointmentSlotConflict(appointmentId, doctorId, date, time) {
  return Appointment.findOne({
    _id: { $ne: appointmentId },
    doctorId,
    status: { $in: ["pending", "accepted"] },
    $or: [
      { appointmentDate: date, appointmentTime: time },
      { status: "accepted", alternateDate: date, alternateTime: time },
    ],
  })
    .select("_id")
    .lean();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleListAppointments(req, res) {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const sortOptions = parseSort(req.query, APPOINTMENT_SORT_FIELDS, "createdAt");
    if (!sortOptions) {
      return res.status(400).json({ error: "Invalid sort parameters" });
    }

    const search = parseSearch(req.query.search);
    if (search === null) {
      return res.status(400).json({ error: "Invalid search parameter" });
    }

    const status = parseAppointmentStatus(req.query.status);
    if (status === null) {
      return res.status(400).json({ error: "Invalid appointment status filter" });
    }

    const conditions = [];
    if (status) conditions.push({ status });

    if (search) {
      const regex = new RegExp(escapeRegExp(search), "i");
      const [patients, doctors] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }] })
          .select("_id")
          .lean(),
        Doctor.find({
          $or: [
            { name: regex },
            { clinicName: regex },
            { specialist: regex },
            { registeredBy: regex },
          ],
        })
          .select("_id")
          .lean(),
      ]);

      const searchConditions = [{ appointmentDate: regex }];
      if (patients.length) {
        searchConditions.push({ patientId: { $in: patients.map((item) => item._id) } });
      }
      if (doctors.length) {
        searchConditions.push({ doctorId: { $in: doctors.map((item) => item._id) } });
      }
      conditions.push({ $or: searchConditions });
    }

    const query = conditions.length ? { $and: conditions } : {};
    const { page, limit } = pagination;
    const { sort, order } = sortOptions;
    const sortSpec = { [sort]: order === "asc" ? 1 : -1, _id: order === "asc" ? 1 : -1 };

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate("patientId", "name email age")
        .populate("doctorId", "name specialist clinicName registeredBy")
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(query),
    ]);

    return res.status(200).json({
      data: appointments.map(toAdminAppointmentView),
      meta: buildPaginationMeta(total, page, limit, sort, order),
    });
  } catch (err) {
    console.error("Admin appointments list failed:", err.message);
    return res.status(500).json({ error: "Failed to load appointments" });
  }
}

async function handleUpdateAppointmentStatus(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ error: "Invalid appointment id", code: "INVALID_APPOINTMENT_ID" });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }

  const { status } = body;
  if (typeof status !== "string" || !APPOINTMENT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: "Invalid appointment status",
      code: "INVALID_APPOINTMENT_STATUS",
    });
  }

  const actorId = req.currentUser?._id ?? req.user?._id;
  if (!actorId) {
    return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
  }

  let slotLock = null;
  try {
    const appointment = await Appointment.findById(id)
      .select(
        "_id patientId doctorId appointmentDate appointmentTime alternateDate alternateTime status"
      )
      .lean();

    if (!appointment) {
      return res.status(404).json({
        error: "Appointment not found",
        code: "APPOINTMENT_NOT_FOUND",
      });
    }

    const allowedTransitions = getAllowedAppointmentTransitions(appointment.status);
    if (!allowedTransitions.includes(status)) {
      return res.status(409).json({
        error: "That status change is not supported from the appointment's current status.",
        code: "INVALID_APPOINTMENT_TRANSITION",
        allowedTransitions,
      });
    }

    if (status === "accepted") {
      const acceptingAlternate = appointment.status === "alternate_requested";
      const slotDate = acceptingAlternate
        ? appointment.alternateDate
        : appointment.appointmentDate;
      const slotTime = acceptingAlternate
        ? appointment.alternateTime
        : appointment.appointmentTime;

      if (!slotDate || !slotTime) {
        return res.status(409).json({
          error: "This appointment has no valid alternate time to accept.",
          code: "INVALID_APPOINTMENT_STATE",
        });
      }

      slotLock = await acquireAppointmentSlotLock(
        appointment.doctorId,
        slotDate,
        slotTime
      );
      if (!slotLock) {
        res.set("Retry-After", "2");
        return res.status(503).json({
          error: "This appointment slot is being updated. Please try again.",
          code: "APPOINTMENT_SLOT_BUSY",
        });
      }

      const clash = await findAppointmentSlotConflict(
        appointment._id,
        appointment.doctorId,
        slotDate,
        slotTime
      );
      if (clash) {
        return res.status(409).json({
          error: "That time slot is already occupied.",
          code: "APPOINTMENT_SLOT_TAKEN",
        });
      }

      // The current schema's unique index still reserves the original request
      // slot after an alternate is accepted, so guard that index as well.
      if (acceptingAlternate) {
        const originalClash = await findAppointmentSlotConflict(
          appointment._id,
          appointment.doctorId,
          appointment.appointmentDate,
          appointment.appointmentTime
        );
        if (originalClash) {
          return res.status(409).json({
            error: "The original requested slot is no longer available.",
            code: "APPOINTMENT_SLOT_TAKEN",
          });
        }
      }
    }

    const updated = await Appointment.findOneAndUpdate(
      { _id: id, status: appointment.status },
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate("patientId", "name email age")
      .populate("doctorId", "name specialist clinicName registeredBy");

    if (!updated) {
      return res.status(409).json({
        error: "This appointment changed while you were updating it. Please refresh.",
        code: "APPOINTMENT_STATUS_CHANGED",
      });
    }

    await syncAppointmentMessage(updated);

    console.info(
      `[admin-audit] action=appointment.change_status actor=${actorId} target=${appointment._id} ${appointment.status}->${status} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: `Appointment marked ${status.replace(/_/g, " ")}`,
      changed: true,
      appointment: toAdminAppointmentView(updated.toObject()),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "That time slot is already occupied.",
        code: "APPOINTMENT_SLOT_TAKEN",
      });
    }
    console.error("Admin appointment status update failed:", err.message);
    return res.status(500).json({ error: "Failed to update appointment status" });
  } finally {
    await releaseAppointmentSlotLock(slotLock);
  }
}

async function handleGetAdminDoctor(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid doctor id", code: "INVALID_DOCTOR_ID" });
    }

    const doctor = await Doctor.findById(id)
      .select(
        "_id name clinicName degree specialist clinicLocation registeredBy isAvailable approvalStatus rejectionReason reviewedBy reviewedAt location createdAt updatedAt"
      )
      .lean();

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found", code: "DOCTOR_NOT_FOUND" });
    }

    const [linkedUser, appointments, connections] = await Promise.all([
      doctor.registeredBy
        ? User.findOne({ email: doctor.registeredBy })
            .select("_id name email role accountStatus")
            .lean()
        : null,
      Appointment.countDocuments({ doctorId: doctor._id }),
      Connection.countDocuments({ doctorId: doctor._id }),
    ]);

    const approvalStatus = normalizeDoctorApproval(doctor.approvalStatus);

    return res.status(200).json({
      data: {
        _id: doctor._id,
        name: doctor.name,
        clinicName: doctor.clinicName,
        degree: doctor.degree,
        specialist: doctor.specialist,
        clinicLocation: doctor.clinicLocation,
        registeredBy: doctor.registeredBy,
        approvalStatus,
        rejectionReason: doctor.rejectionReason || "",
        reviewedBy: doctor.reviewedBy ?? null,
        reviewedAt: doctor.reviewedAt ?? null,
        isAvailable:
          approvalStatus === "approved" && doctor.isAvailable !== false,
        latitude: doctor.location?.coordinates?.[1] ?? null,
        longitude: doctor.location?.coordinates?.[0] ?? null,
        linkedUser: linkedUser ?? null,
        activity: { appointments, connections },
        approval: { canReview: approvalStatus === "pending" },
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
      },
    });
  } catch (err) {
    console.error("Admin doctor detail failed:", err.message);
    return res.status(500).json({ error: "Failed to load doctor details" });
  }
}

async function handleUpdateDoctorApproval(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid doctor id", code: "INVALID_DOCTOR_ID" });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }

  const { status } = body;
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({
      error: "Approval status must be approved or rejected",
      code: "INVALID_APPROVAL_STATUS",
    });
  }

  let reason = "";
  if (status === "rejected") {
    reason = parseRejectionReason(body.reason);
    if (reason === null) {
      return res.status(400).json({
        error: `A rejection reason is required (maximum ${MAX_REJECTION_REASON_LENGTH} characters).`,
        code: "INVALID_REJECTION_REASON",
      });
    }
  }

  const actorId = req.currentUser?._id ?? req.user?._id;
  if (!actorId) {
    return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
  }

  try {
    const target = await Doctor.findById(id)
      .select("_id name clinicName registeredBy approvalStatus")
      .lean();

    if (!target) {
      return res.status(404).json({ error: "Doctor not found", code: "DOCTOR_NOT_FOUND" });
    }

    if (normalizeDoctorApproval(target.approvalStatus) !== "pending") {
      return res.status(409).json({
        error: "Only pending doctor applications can be reviewed.",
        code: "DOCTOR_NOT_PENDING",
      });
    }

    const update =
      status === "approved"
        ? {
            $set: {
              approvalStatus: "approved",
              rejectionReason: "",
              reviewedBy: actorId,
              reviewedAt: new Date(),
            },
          }
        : {
            $set: {
              approvalStatus: "rejected",
              rejectionReason: reason,
              reviewedBy: actorId,
              reviewedAt: new Date(),
              isAvailable: false,
            },
          };

    // Atomic transition: only one reviewer can resolve a pending application.
    const updated = await Doctor.findOneAndUpdate(
      { _id: id, approvalStatus: "pending" },
      update,
      { new: true, runValidators: true }
    )
      .select("_id name clinicName specialist approvalStatus rejectionReason reviewedBy reviewedAt updatedAt")
      .lean();

    if (!updated) {
      return res.status(409).json({
        error: "This application changed while you were reviewing it. Please refresh.",
        code: "DOCTOR_APPROVAL_CHANGED",
      });
    }

    console.info(
      `[admin-audit] action=doctor.${status === "approved" ? "approve" : "reject"} actor=${actorId} target=${target._id} pending->${status} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message:
        status === "approved"
          ? "Doctor application approved"
          : "Doctor application rejected",
      changed: true,
      doctor: {
        ...updated,
        approvalStatus: normalizeDoctorApproval(updated.approvalStatus),
      },
    });
  } catch (err) {
    console.error("Admin doctor approval failed:", err.message);
    return res.status(500).json({ error: "Failed to update doctor approval" });
  }
}

async function acquireStatusLock(owner) {
  for (let attempt = 0; attempt < STATUS_LOCK_RETRIES; attempt += 1) {
    try {
      const now = new Date();
      const lock = await AdminActionLock.findOneAndUpdate(
        {
          _id: STATUS_LOCK_ID,
          $or: [
            { expiresAt: { $lte: now } },
            { expiresAt: null },
            { expiresAt: { $exists: false } },
          ],
        },
        {
          $set: {
            owner,
            expiresAt: new Date(Date.now() + STATUS_LOCK_TTL_MS),
          },
        },
        { new: true, upsert: true }
      ).lean();

      if (lock?.owner === owner) return true;
    } catch (err) {
      // Two first-time acquisitions can race on the upsert. Treat that as
      // contention and retry rather than failing the request.
      if (err?.code !== 11000) throw err;
    }

    if (attempt < STATUS_LOCK_RETRIES - 1) {
      await sleep(STATUS_LOCK_RETRY_MS);
    }
  }

  return false;
}

async function releaseStatusLock(owner) {
  try {
    await AdminActionLock.updateOne(
      { _id: STATUS_LOCK_ID, owner },
      { $set: { expiresAt: new Date(0) } }
    );
  } catch (err) {
    console.error("Admin status lock release failed:", err.message);
  }
}

async function handleGetAdminUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id", code: "INVALID_USER_ID" });
    }

    const user = await User.findById(id)
      .select("_id name email role age phone address location accountStatus createdAt updatedAt")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const normalizedUser = {
      ...user,
      accountStatus: normalizeAccountStatus(user.accountStatus),
    };

    const [doctorProfile, appointmentsAsPatient, patientConnections] = await Promise.all([
      Doctor.findOne({ registeredBy: user.email })
        .select("_id name clinicName degree specialist clinicLocation isAvailable createdAt")
        .lean(),
      Appointment.countDocuments({ patientId: user._id }),
      Connection.countDocuments({ patientId: user._id }),
    ]);

    const [appointmentsAsDoctor, doctorConnections] = await Promise.all([
      doctorProfile ? Appointment.countDocuments({ doctorId: doctorProfile._id }) : 0,
      doctorProfile ? Connection.countDocuments({ doctorId: doctorProfile._id }) : 0,
    ]);

    const currentUserId = String(req.currentUser?._id ?? req.user?._id ?? "");
    let statusChange = { allowed: true, reason: null };

    if (String(user._id) === currentUserId) {
      statusChange = { allowed: false, reason: "self" };
    } else if (
      user.role === "super_admin" &&
      normalizedUser.accountStatus !== "suspended"
    ) {
      const activeSuperAdmins = await User.countDocuments({
        role: "super_admin",
        accountStatus: { $ne: "suspended" },
      });
      if (activeSuperAdmins <= 1) {
        statusChange = { allowed: false, reason: "last_active_super_admin" };
      }
    }

    return res.status(200).json({
      data: {
        ...normalizedUser,
        doctorProfile: doctorProfile ?? null,
        activity: {
          appointmentsAsPatient,
          appointmentsAsDoctor,
          patientConnections,
          doctorConnections,
        },
        statusChange,
      },
    });
  } catch (err) {
    console.error("Admin user detail failed:", err.message);
    return res.status(500).json({ error: "Failed to load user details" });
  }
}

async function handleUpdateUserStatus(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id", code: "INVALID_USER_ID" });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }

  const { status } = body;
  if (typeof status !== "string" || !ACCOUNT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: "Invalid account status",
      code: "INVALID_ACCOUNT_STATUS",
    });
  }

  const owner = crypto.randomUUID();
  let locked = false;

  try {
    locked = await acquireStatusLock(owner);
    if (!locked) {
      res.set("Retry-After", "2");
      return res.status(503).json({
        error: "Another account update is in progress. Please try again.",
        code: "ADMIN_ACTION_BUSY",
      });
    }

    // Recheck the actor inside the critical section; they may have been
    // suspended while their request was in flight.
    const actor = await User.findById(req.currentUser?._id ?? req.user?._id)
      .select("_id role accountStatus")
      .lean();

    if (!actor || actor.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    if (normalizeAccountStatus(actor.accountStatus) === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended. Please contact a Super Admin.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const target = await User.findById(id)
      .select("_id name email role accountStatus")
      .lean();

    if (!target) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    if (String(target._id) === String(actor._id)) {
      return res.status(403).json({
        error: "You cannot change your own account status.",
        code: "SELF_STATUS_CHANGE_FORBIDDEN",
      });
    }

    const currentStatus = normalizeAccountStatus(target.accountStatus);
    const safeUser = {
      _id: target._id,
      name: target.name,
      email: target.email,
      role: target.role,
      accountStatus: currentStatus,
    };

    if (currentStatus === status) {
      return res.status(200).json({
        message: `Account is already ${currentStatus}`,
        changed: false,
        user: safeUser,
      });
    }

    if (status === "suspended" && target.role === "super_admin") {
      const activeSuperAdmins = await User.countDocuments({
        role: "super_admin",
        accountStatus: { $ne: "suspended" },
      });

      if (activeSuperAdmins <= 1) {
        return res.status(409).json({
          error: "The last active Super Admin cannot be suspended.",
          code: "LAST_ACTIVE_SUPER_ADMIN",
        });
      }
    }

    const filter =
      status === "suspended"
        ? { _id: id, accountStatus: { $ne: "suspended" } }
        : { _id: id, accountStatus: "suspended" };

    const update =
      status === "suspended"
        ? { $set: { accountStatus: "suspended" }, $inc: { tokenVersion: 1 } }
        : { $set: { accountStatus: "active" } };

    const updated = await User.findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
    })
      .select("_id name email role accountStatus updatedAt")
      .lean();

    if (!updated) {
      return res.status(409).json({
        error: "This account changed while you were updating it. Please refresh.",
        code: "ACCOUNT_STATUS_CHANGED",
      });
    }

    console.info(
      `[admin-audit] action=user.${status === "suspended" ? "suspend" : "reactivate"} actor=${actor._id} target=${target._id} ${currentStatus}->${status} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: status === "suspended" ? "Account suspended" : "Account reactivated",
      changed: true,
      user: {
        ...updated,
        accountStatus: normalizeAccountStatus(updated.accountStatus),
      },
    });
  } catch (err) {
    console.error("Admin user status update failed:", err.message);
    return res.status(500).json({ error: "Failed to update account status" });
  } finally {
    if (locked) await releaseStatusLock(owner);
  }
}

module.exports = {
  handleGetAdminStats,
  handleListUsers,
  handleListDoctors,
  handleListAppointments,
  handleUpdateAppointmentStatus,
  handleGetAdminDoctor,
  handleUpdateDoctorApproval,
  handleGetAdminUser,
  handleUpdateUserStatus,
};
