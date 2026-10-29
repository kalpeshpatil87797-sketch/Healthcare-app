const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const Appointment = require("../models/appointment");
const Connection = require("../models/connection");
const AdminActionLock = require("../models/adminActionLock");
const {
  populateAppointmentSafely,
  syncAppointmentMessageSafely,
} = require("./appointment");
const {
  acquireAppointmentSlotLock,
  releaseAppointmentSlotLock,
} = require("../utils/appointmentSlotLock");
const { buildClinicLocationVerificationUpdate } = require("../utils/clinicLocationVerification");

const USER_ROLES = User.schema.path("role").enumValues;
const ACCOUNT_STATUSES = User.schema.path("accountStatus").enumValues;
const DOCTOR_APPROVAL_STATUSES = Doctor.schema.path("approvalStatus").enumValues;
const APPOINTMENT_STATUSES = Appointment.schema.path("status").enumValues;
const NORMAL_USER_ROLES = ["patient", "doctor"];
const ASSIGNABLE_USER_ROLES = ["patient", "doctor", "admin"];

const STATUS_LOCK_ID = "user-account-status";
const STATUS_LOCK_TTL_MS = 30 * 1000;
const STATUS_LOCK_RETRIES = 4;
const STATUS_LOCK_RETRY_MS = 75;

const USER_SORT_FIELDS = ["createdAt", "name", "email", "role"];
const DOCTOR_SORT_FIELDS = ["createdAt", "submittedAt", "name", "specialist", "isAvailable"];
const APPOINTMENT_SORT_FIELDS = [
  "appointmentDate",
  "status",
  "createdAt",
  "updatedAt",
];

// Terminal states stay terminal; confirmed appointments can be cancelled or completed.
const APPOINTMENT_TRANSITIONS = Object.freeze({
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["cancelled", "completed"],
  alternate_requested: ["accepted", "cancelled"],
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

function getEffectiveUserRole(user, doctorProfile) {
  return user.role === "doctor" &&
    (
      doctorProfile?.isActive === false ||
      doctorProfile?.approvalStatus === "pending" ||
      doctorProfile?.approvalStatus === "rejected"
    )
    ? "patient"
    : user.role;
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
    visitReason: appointment.visitReason ?? "",
    history: (appointment.history ?? []).map(
      ({ event, fromDate, fromTime, toDate, toTime, occurredAt }) => ({
        event,
        fromDate: fromDate ?? null,
        fromTime: fromTime ?? null,
        toDate: toDate ?? null,
        toTime: toTime ?? null,
        occurredAt,
      })
    ),
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

    const conditions = [];
    let removedDoctorEmails = [];
    if (role === "patient" || role === "doctor") {
      const latestInactiveProfiles = await Doctor.aggregate([
        { $match: { registeredBy: { $type: "string" } } },
        { $sort: { updatedAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$registeredBy",
            isActive: { $first: "$isActive" },
          },
        },
        { $match: { isActive: false } },
        { $project: { _id: 1 } },
      ]);
      removedDoctorEmails = latestInactiveProfiles.map((profile) => profile._id);
    }

    if (role === "patient") {
      conditions.push({
        $or: [
          { role: "patient" },
          { role: "doctor", email: { $in: removedDoctorEmails } },
        ],
      });
    } else if (role === "doctor") {
      conditions.push({ role: "doctor" });
      if (removedDoctorEmails.length) {
        conditions.push({ email: { $nin: removedDoctorEmails } });
      }
    } else if (role) {
      conditions.push({ role });
    }
    if (accountStatus === "active") {
      // Legacy users without the field are active.
      conditions.push({ accountStatus: { $ne: "suspended" } });
    } else if (accountStatus === "suspended") {
      conditions.push({ accountStatus: "suspended" });
    }
    if (search) {
      const regex = new RegExp(escapeRegExp(search), "i");
      conditions.push({ $or: [{ name: regex }, { email: regex }] });
    }
    const query = conditions.length ? { $and: conditions } : {};

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

    const emails = users.map((user) => user.email).filter(Boolean);
    const doctorProfiles = emails.length
      ? await Doctor.find({ registeredBy: { $in: emails } })
          .select("_id registeredBy approvalStatus isActive isAvailable submittedAt createdAt")
          .sort({ updatedAt: -1, _id: -1 })
          .lean()
      : [];
    const doctorProfilesByEmail = new Map();
    doctorProfiles.forEach((doctor) => {
      if (!doctorProfilesByEmail.has(doctor.registeredBy)) {
        doctorProfilesByEmail.set(doctor.registeredBy, doctor);
      }
    });

    const data = users.map((user) => {
      const doctorProfile = doctorProfilesByEmail.get(user.email);

      return {
        ...user,
        role: getEffectiveUserRole(user, doctorProfile),
        accountStatus: normalizeAccountStatus(user.accountStatus),
        doctorProfile: doctorProfile
          ? {
              _id: doctorProfile._id,
              approvalStatus: normalizeDoctorApproval(doctorProfile.approvalStatus),
              isActive: doctorProfile.isActive !== false,
              isAvailable: doctorProfile.isAvailable !== false,
              submittedAt: doctorProfile.submittedAt ?? doctorProfile.createdAt ?? null,
            }
          : null,
      };
    });

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

    const sortOptions = parseSort(req.query, DOCTOR_SORT_FIELDS, "submittedAt");
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
        { isActive: { $ne: false } },
        { isAvailable: true }
      );
    } else if (isAvailable === false) {
      conditions.push({
        $or: [
          { approvalStatus: { $in: ["pending", "rejected"] } },
          { isActive: false },
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
          "_id name clinicName degree specialist clinicLocation registeredBy isActive isAvailable approvalStatus locationVerified submittedAt rejectionReason reviewedAt location createdAt updatedAt"
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
        isActive: doctor.isActive !== false,
        submittedAt: doctor.submittedAt ?? doctor.createdAt ?? null,
        rejectionReason: doctor.rejectionReason || "",
        reviewedAt: doctor.reviewedAt ?? null,
        isAvailable:
          doctorApprovalStatus === "approved" &&
            doctor.isActive !== false &&
            doctor.isAvailable !== false,
        latitude: doctor.location?.coordinates?.[1] ?? null,
        longitude: doctor.location?.coordinates?.[0] ?? null,
        locationVerified: doctor.locationVerified === true,
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
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, "status")
  ) {
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

    const acceptingAlternate =
      status === "accepted" && appointment.status === "alternate_requested";
    const updated = await Appointment.findOneAndUpdate(
      { _id: id, status: appointment.status },
      {
        $set: {
          status,
          ...(acceptingAlternate
            ? {
                appointmentDate: appointment.alternateDate,
                appointmentTime: appointment.alternateTime,
              }
            : {}),
        },
        ...(acceptingAlternate
          ? { $unset: { alternateDate: 1, alternateTime: 1 } }
          : {}),
        $push: {
          history: {
            event: status,
            actorId,
            actorRole: req.currentUser?.role ?? "admin",
            fromDate: appointment.appointmentDate,
            fromTime: appointment.appointmentTime,
            ...(acceptingAlternate
              ? {
                  toDate: appointment.alternateDate,
                  toTime: appointment.alternateTime,
                }
              : {}),
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: "This appointment changed while you were updating it. Please refresh.",
        code: "APPOINTMENT_STATUS_CHANGED",
      });
    }

    const notificationWarning = [
      await syncAppointmentMessageSafely(updated),
      await populateAppointmentSafely(updated, [
        ["patientId", "name email age"],
        ["doctorId", "name specialist clinicName registeredBy"],
      ]),
    ].filter(Boolean).join(" ");

    console.info(
      `[admin-audit] action=appointment.change_status actor=${actorId} target=${appointment._id} ${appointment.status}->${status} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: `Appointment marked ${status.replace(/_/g, " ")}`,
      changed: true,
      appointment: toAdminAppointmentView(updated.toObject()),
      notificationWarning,
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
      "_id name clinicName degree specialist clinicLocation registeredBy isActive isAvailable approvalStatus locationVerified submittedAt rejectionReason reviewedBy reviewedAt location createdAt updatedAt"
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
        isActive: doctor.isActive !== false,
        submittedAt: doctor.submittedAt ?? doctor.createdAt ?? null,
        rejectionReason: doctor.rejectionReason || "",
        reviewedBy: doctor.reviewedBy ?? null,
        reviewedAt: doctor.reviewedAt ?? null,
        isAvailable:
          approvalStatus === "approved" &&
          doctor.isActive !== false &&
          doctor.isAvailable !== false,
        latitude: doctor.location?.coordinates?.[1] ?? null,
        longitude: doctor.location?.coordinates?.[0] ?? null,
        locationVerified: doctor.locationVerified === true,
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

async function handleUpdateClinicLocationVerification(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid doctor id", code: "INVALID_DOCTOR_ID" });
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.isVerified !== "boolean"
  ) {
    return res.status(400).json({
      error: "Provide only a boolean isVerified value.",
      code: "INVALID_LOCATION_VERIFICATION",
    });
  }

  try {
    const doctor = await Doctor.findById(id)
      .select("_id name location locationVerified")
      .lean();
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found", code: "DOCTOR_NOT_FOUND" });
    }

    const result = buildClinicLocationVerificationUpdate(
      req.currentUser?.role,
      body.isVerified,
      doctor.location
    );
    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
    }

    const filter = { _id: doctor._id };
    if (body.isVerified) {
      filter["location.type"] = doctor.location.type;
      filter["location.coordinates"] = doctor.location.coordinates;
    }
    const updated = await Doctor.findOneAndUpdate(
      filter,
      result.update,
      { new: true, runValidators: true }
    )
      .select("_id location locationVerified")
      .lean();

    if (!updated) {
      return res.status(409).json({
        error: "Clinic coordinates changed while verification was in progress. Refresh and review again.",
        code: "CLINIC_LOCATION_CHANGED",
      });
    }

    console.info(
      `[admin-audit] action=doctor.location_${body.isVerified ? "verify" : "revoke"} actor=${req.currentUser._id} target=${doctor._id} at=${new Date().toISOString()}`
    );
    return res.status(200).json({
      message: body.isVerified ? "Clinic location verified." : "Clinic location verification revoked.",
      doctor: {
        _id: updated._id,
        locationVerified: updated.locationVerified === true,
        latitude: updated.location?.coordinates?.[1] ?? null,
        longitude: updated.location?.coordinates?.[0] ?? null,
      },
    });
  } catch (err) {
    console.error("Admin clinic location verification failed:", err.message);
    return res.status(500).json({ error: "Failed to update clinic location verification" });
  }
}

async function handleUpdateDoctorApproval(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid doctor id", code: "INVALID_DOCTOR_ID" });
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !Object.prototype.hasOwnProperty.call(body, "status")
  ) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }

  const { status } = body;
  const allowedBodyKeys = status === "rejected" ? ["status", "reason"] : ["status"];
  if (Object.keys(body).some((key) => !allowedBodyKeys.includes(key))) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }
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
              isActive: true,
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

    let linkedUser = null;
    let userRoleTransition = "";
    if (target.registeredBy) {
      if (status === "approved") {
        linkedUser = await User.findOneAndUpdate(
          { email: target.registeredBy, role: "patient" },
          { $set: { role: "doctor" } },
          { new: true, runValidators: true }
        )
          .select("_id name email role accountStatus")
          .lean();
        if (linkedUser) userRoleTransition = " user_role=patient->doctor";
      } else {
        linkedUser = await User.findOneAndUpdate(
          { email: target.registeredBy, role: "doctor" },
          {
            $set: { role: "patient" },
            $inc: { tokenVersion: 1 },
          },
          { new: true, runValidators: true }
        )
          .select("_id name email role accountStatus")
          .lean();
        if (linkedUser) userRoleTransition = " user_role=doctor->patient";
      }
    }

    console.info(
      `[admin-audit] action=doctor.${status === "approved" ? "approve" : "reject"} actor=${actorId} target=${target._id} pending->${status}${userRoleTransition} at=${new Date().toISOString()}`
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
      ...(linkedUser ? { user: linkedUser } : {}),
    });
  } catch (err) {
    console.error("Admin doctor approval failed:", err.message);
    return res.status(500).json({ error: "Failed to update doctor approval" });
  }
}

async function handleRemoveDoctor(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid doctor id", code: "INVALID_DOCTOR_ID" });
  }

  try {
    const actor = await User.findById(req.currentUser?._id ?? req.user?._id)
      .select("_id role accountStatus")
      .lean();
    if (!actor || !["admin", "root_owner"].includes(actor.role)) {
      return res.status(403).json({ error: "Only Admins and the Root Owner can remove doctor profiles.", code: "FORBIDDEN" });
    }
    if (normalizeAccountStatus(actor.accountStatus) === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended. Contact the Root Owner.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const removed = await Doctor.findOneAndUpdate(
      {
        _id: id,
        approvalStatus: { $nin: ["pending", "rejected"] },
        isActive: { $ne: false },
      },
      { $set: { isActive: false, isAvailable: false } },
      { new: true, runValidators: true }
    )
      .select("_id name registeredBy approvalStatus isActive isAvailable")
      .lean();

    if (!removed) {
      const current = await Doctor.findById(id).select("_id").lean();
      if (!current) {
        return res.status(404).json({ error: "Doctor not found", code: "DOCTOR_NOT_FOUND" });
      }
      return res.status(409).json({
        error: "Only an active, approved doctor profile can be removed.",
        code: "DOCTOR_NOT_ACTIVE",
      });
    }

    let linkedUser = null;
    let userRoleChanged = false;
    let savedRoleChanged = false;
    if (removed.registeredBy) {
      const linkedAccount = await User.findOne({ email: removed.registeredBy })
        .select("_id name email role accountStatus +roleBeforeAdmin")
        .lean();

      if (linkedAccount?.role === "doctor") {
        linkedUser = await User.findOneAndUpdate(
          { _id: linkedAccount._id, role: "doctor" },
          {
            $set: { role: "patient" },
            $inc: { tokenVersion: 1 },
          },
          { new: true, runValidators: true }
        )
          .select("_id name email role accountStatus")
          .lean();
        userRoleChanged = Boolean(linkedUser);
      } else if (
        linkedAccount?.role === "admin" &&
        linkedAccount.roleBeforeAdmin === "doctor"
      ) {
        await User.updateOne(
          { _id: linkedAccount._id, role: "admin", roleBeforeAdmin: "doctor" },
          { $set: { roleBeforeAdmin: "patient" } },
          { runValidators: true }
        );
        savedRoleChanged = true;
      }

      if (!linkedUser && linkedAccount) {
        linkedUser = await User.findById(linkedAccount._id)
          .select("_id name email role accountStatus")
          .lean();
      }
    }

    console.info(
      `[admin-audit] action=doctor.remove actor=${actor._id} target=${removed._id} approved->inactive${userRoleChanged ? " user_role=doctor->patient" : ""}${savedRoleChanged ? " admin_saved_role=doctor->patient" : ""} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: "Doctor profile removed. Patient access and existing records were preserved.",
      doctor: removed,
      user: linkedUser
        ? {
            _id: linkedUser._id,
            name: linkedUser.name,
            email: linkedUser.email,
            role: getEffectiveUserRole(linkedUser, removed),
            accountStatus: normalizeAccountStatus(linkedUser.accountStatus),
          }
        : null,
    });
  } catch (err) {
    console.error("Admin doctor removal failed:", err.message);
    return res.status(500).json({ error: "Failed to remove doctor profile" });
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
      .select("_id name email role age phone address location accountStatus createdAt updatedAt +roleBeforeAdmin +roleBeforeSuperAdmin")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const { roleBeforeAdmin, roleBeforeSuperAdmin, ...safeUser } = user;
    const normalizedUser = {
      ...safeUser,
      accountStatus: normalizeAccountStatus(user.accountStatus),
    };

    const [doctorProfile, appointmentsAsPatient, patientConnections] = await Promise.all([
      Doctor.findOne({ registeredBy: user.email })
        .select("_id name clinicName degree specialist clinicLocation location locationVerified isActive isAvailable approvalStatus submittedAt rejectionReason reviewedAt createdAt")
        .sort({ updatedAt: -1, _id: -1 })
        .lean(),
      Appointment.countDocuments({ patientId: user._id }),
      Connection.countDocuments({ patientId: user._id }),
    ]);

    const [appointmentsAsDoctor, doctorConnections] = await Promise.all([
      doctorProfile ? Appointment.countDocuments({ doctorId: doctorProfile._id }) : 0,
      doctorProfile ? Connection.countDocuments({ doctorId: doctorProfile._id }) : 0,
    ]);

    const effectiveRole = getEffectiveUserRole(user, doctorProfile);
    const savedRole =
      roleBeforeAdmin === "doctor" &&
        (
          doctorProfile?.isActive === false ||
          doctorProfile?.approvalStatus === "pending" ||
          doctorProfile?.approvalStatus === "rejected"
        )
        ? "patient"
        : roleBeforeAdmin;
    const currentUserId = String(req.currentUser?._id ?? req.user?._id ?? "");
    const isRootOwner = req.currentUser?.role === "root_owner";
    let statusChange = {
      allowed:
        (isRootOwner && ["patient", "doctor", "admin"].includes(user.role)) ||
        (!isRootOwner &&
          ["patient", "doctor"].includes(user.role)),
      reason:
        user.role === "root_owner" || user.role === "super_admin"
          ? "privileged_account"
          : user.role === "admin" && !isRootOwner
            ? "admin_account"
            : null,
    };
    let roleChange = {
      allowed:
        isRootOwner &&
        ["patient", "doctor", "admin"].includes(effectiveRole) &&
        normalizedUser.accountStatus !== "suspended" &&
        (effectiveRole !== "admin" || NORMAL_USER_ROLES.includes(savedRole)),
      reason: !isRootOwner
        ? "root_owner_only"
        : effectiveRole === "root_owner" || effectiveRole === "super_admin"
          ? "privileged_account"
          : normalizedUser.accountStatus === "suspended"
            ? "suspended_account"
            : effectiveRole === "admin" && !NORMAL_USER_ROLES.includes(savedRole)
              ? "saved_role_missing"
          : null,
      targetRole: null,
    };

    if (effectiveRole === "admin") {
      roleChange.targetRole = NORMAL_USER_ROLES.includes(savedRole)
        ? savedRole
        : null;
    } else if (NORMAL_USER_ROLES.includes(effectiveRole)) {
      roleChange.targetRole = "admin";
    }

    if (String(user._id) === currentUserId) {
      statusChange = { allowed: false, reason: "self" };
      roleChange = { ...roleChange, allowed: false, reason: "self" };
    }

    return res.status(200).json({
      data: {
        ...normalizedUser,
        role: effectiveRole,
        doctorProfile: doctorProfile
          ? {
              ...doctorProfile,
              approvalStatus: normalizeDoctorApproval(doctorProfile.approvalStatus),
              isActive: doctorProfile.isActive !== false,
            }
          : null,
        activity: {
          appointmentsAsPatient,
          appointmentsAsDoctor,
          patientConnections,
          doctorConnections,
        },
        statusChange,
        roleChange,
      },
    });
  } catch (err) {
    console.error("Admin user detail failed:", err.message);
    return res.status(500).json({ error: "Failed to load user details" });
  }
}

async function handleUpdateUserRole(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id", code: "INVALID_USER_ID" });
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, "role")
  ) {
    return res.status(400).json({ error: "Invalid request body", code: "INVALID_BODY" });
  }

  const { role } = body;
  if (typeof role !== "string" || !ASSIGNABLE_USER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid user role", code: "INVALID_USER_ROLE" });
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

    const actor = await User.findById(req.currentUser?._id ?? req.user?._id)
      .select("_id role accountStatus tokenVersion")
      .lean();
    if (!actor || actor.role !== "root_owner") {
      return res.status(403).json({
        error: "Only the Root Owner can manage admin roles.",
        code: "ROOT_OWNER_REQUIRED",
      });
    }
    if (normalizeAccountStatus(actor.accountStatus) === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended. Contact the Root Owner.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const target = await User.findById(id)
      .select("_id name email role accountStatus tokenVersion +roleBeforeAdmin +roleBeforeSuperAdmin")
      .lean();
    if (!target) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }
    if (String(target._id) === String(actor._id)) {
      return res.status(403).json({
        error: "The Root Owner cannot change their own role.",
        code: "SELF_ROLE_CHANGE_FORBIDDEN",
      });
    }

    const storedRole = target.role;
    const hasInactiveDoctorPrivileges =
      storedRole === "doctor" || target.roleBeforeAdmin === "doctor"
        ? (await Doctor.findOne({ registeredBy: target.email })
            .select("isActive approvalStatus")
            .sort({ updatedAt: -1, _id: -1 })
            .lean())
        : false;
    const doctorProfileBlocksRole = Boolean(
      hasInactiveDoctorPrivileges &&
      (
        hasInactiveDoctorPrivileges.isActive === false ||
        hasInactiveDoctorPrivileges.approvalStatus === "pending" ||
        hasInactiveDoctorPrivileges.approvalStatus === "rejected"
      )
    );
    const currentRole =
      storedRole === "doctor" && doctorProfileBlocksRole ? "patient" : storedRole;
    const savedRole =
      target.roleBeforeAdmin === "doctor" && doctorProfileBlocksRole
        ? "patient"
        : target.roleBeforeAdmin;
    if (currentRole === "root_owner") {
      return res.status(403).json({
        error: "The Root Owner role cannot be changed through dashboard APIs.",
        code: "ROOT_OWNER_PROTECTED",
      });
    }
    if (currentRole === "super_admin") {
      return res.status(409).json({
        error: "Legacy Super Admin accounts must be migrated through the explicit bootstrap process.",
        code: "LEGACY_ROLE_REQUIRES_MIGRATION",
      });
    }
    if (normalizeAccountStatus(target.accountStatus) === "suspended") {
      return res.status(409).json({
        error: "Reactivate this account before changing its role.",
        code: "ACCOUNT_SUSPENDED",
      });
    }
    if (currentRole === role) {
      return res.status(200).json({
        message: `Account already has the ${role} role`,
        changed: false,
        user: {
          _id: target._id,
          name: target.name,
          email: target.email,
          role: currentRole,
        },
      });
    }

    let nextRole;
    let update;
    if (NORMAL_USER_ROLES.includes(currentRole) && role === "admin") {
      nextRole = "admin";
      update = {
        $set: { role: nextRole, roleBeforeAdmin: currentRole },
        $unset: { roleBeforeSuperAdmin: 1 },
        $inc: { tokenVersion: 1 },
      };
    } else if (currentRole === "admin" && NORMAL_USER_ROLES.includes(role)) {
      if (!NORMAL_USER_ROLES.includes(savedRole)) {
        return res.status(409).json({
          error: "This Admin has no verified saved patient/doctor role. Repair it through the reviewed migration process.",
          code: "ADMIN_ROLE_MISSING",
        });
      }
      if (role !== savedRole) {
        return res.status(409).json({
          error: `This account must be restored to its saved ${savedRole} role.`,
          code: "USER_ROLE_MISMATCH",
          targetRole: savedRole,
        });
      }
      nextRole = savedRole;
      update = {
        $set: { role: nextRole },
        $unset: { roleBeforeAdmin: 1, roleBeforeSuperAdmin: 1 },
        $inc: { tokenVersion: 1 },
      };
    } else {
      return res.status(409).json({
        error: "Only normal accounts can be promoted to Admin, and Admins can only be restored to their saved normal role.",
        code: "ROLE_CHANGE_NOT_ALLOWED",
      });
    }

    const updated = await User.findOneAndUpdate(
      {
        _id: target._id,
        role: storedRole,
        accountStatus: { $ne: "suspended" },
      },
      update,
      { new: true, runValidators: true }
    )
      .select("_id name email role accountStatus updatedAt")
      .lean();
    if (!updated) {
      return res.status(409).json({
        error: "This account role changed while you were updating it. Please refresh.",
        code: "USER_ROLE_CHANGED",
      });
    }

    console.info(
      `[admin-audit] action=user.change_role actor=${actor._id} target=${target._id} oldRole=${currentRole} newRole=${nextRole} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message:
        nextRole === "admin"
          ? "Admin access granted"
          : `Admin access removed; ${nextRole} role restored`,
      changed: true,
      user: {
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
      },
    });
  } catch (err) {
    console.error("Admin user role update failed:", err.message);
    return res.status(500).json({ error: "Failed to update account role" });
  } finally {
    if (locked) await releaseStatusLock(owner);
  }
}

async function handleUpdateUserStatus(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id", code: "INVALID_USER_ID" });
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, "status")
  ) {
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

    if (!actor || !["root_owner", "admin"].includes(actor.role)) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    if (normalizeAccountStatus(actor.accountStatus) === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended. Contact the Root Owner.",
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
    if (target.role === "root_owner") {
      return res.status(403).json({
        error: "The Root Owner account status cannot be changed through dashboard APIs.",
        code: "ROOT_OWNER_PROTECTED",
      });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({
        error: "Legacy Super Admin accounts must be migrated through the explicit bootstrap process.",
        code: "LEGACY_ROLE_REQUIRES_MIGRATION",
      });
    }
    if (actor.role === "admin" && target.role === "admin") {
      return res.status(403).json({
        error: "Admins cannot change another Admin account's status.",
        code: "PRIVILEGED_ACCOUNT_PROTECTED",
      });
    }
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

    const filter =
      status === "suspended"
        ? { _id: id, role: target.role, accountStatus: { $ne: "suspended" } }
        : { _id: id, role: target.role, accountStatus: "suspended" };

    const update = {
      $set: { accountStatus: status },
      $inc: { tokenVersion: 1 },
    };

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
  handleUpdateClinicLocationVerification,
  handleUpdateDoctorApproval,
  handleRemoveDoctor,
  handleGetAdminUser,
  handleUpdateUserStatus,
  handleUpdateUserRole,
};
