const PERSONAL_FIELDS = ["name", "age", "phone", "address"];
const DOCTOR_FIELDS = [
  "clinicName",
  "degree",
  "specialist",
  "clinicLocation",
  "clinicLatitude",
  "clinicLongitude",
  "clearClinicCoordinates",
];
const ALLOWED_FIELDS = new Set([...PERSONAL_FIELDS, ...DOCTOR_FIELDS]);

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function normalizeApprovalStatus(doctor) {
  return doctor?.approvalStatus ?? "approved";
}

function parseCoordinate(value, minimum, maximum) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

function buildProfileUpdate(body, user, doctor) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, error: "Profile details must be an object." };
  }
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => !ALLOWED_FIELDS.has(key))) {
    return { status: 400, error: "The profile contains unsupported fields." };
  }

  const doctorProfileEditable = Boolean(
    ["patient", "doctor"].includes(user?.role) &&
    doctor &&
    doctor.isActive !== false &&
    ["approved", "pending"].includes(normalizeApprovalStatus(doctor))
  );
  const doctorFieldsSubmitted = keys.some((key) => DOCTOR_FIELDS.includes(key));
  if (doctorFieldsSubmitted && !doctorProfileEditable) {
    return { status: 403, error: "Doctor profile fields are not editable for this account." };
  }

  const userSet = {};
  const doctorSet = {};
  const doctorUnset = {};

  if (Object.hasOwn(body, "name")) {
    if (!isNonEmptyString(body.name, 100)) {
      return { status: 400, error: "Name must be between 1 and 100 characters." };
    }
    userSet.name = body.name.trim();
    if (doctorProfileEditable) doctorSet.name = body.name.trim();
  }
  if (Object.hasOwn(body, "age")) {
    const age = typeof body.age === "number" ? body.age : Number(body.age);
    if (!Number.isInteger(age) || age < 1 || age > 130) {
      return { status: 400, error: "Age must be a whole number between 1 and 130." };
    }
    userSet.age = age;
  }
  if (Object.hasOwn(body, "phone")) {
    if (
      !isNonEmptyString(body.phone, 25) ||
      !/^[+()\d .-]{7,25}$/.test(body.phone.trim()) ||
      !/\d{7,}/.test(body.phone)
    ) {
      return { status: 400, error: "Enter a valid phone number." };
    }
    userSet.phone = body.phone.trim();
  }
  if (Object.hasOwn(body, "address")) {
    if (!isNonEmptyString(body.address, 300)) {
      return { status: 400, error: "Address must be between 1 and 300 characters." };
    }
    userSet.address = body.address.trim();
  }

  if (doctorProfileEditable) {
    for (const [field, maxLength] of [
      ["clinicName", 150],
      ["degree", 120],
      ["specialist", 100],
      ["clinicLocation", 300],
    ]) {
      if (Object.hasOwn(body, field)) {
        if (!isNonEmptyString(body[field], maxLength)) {
          return {
            status: 400,
            error: `${field} must be between 1 and ${maxLength} characters.`,
          };
        }
        doctorSet[field] = body[field].trim();
      }
    }

    if (Object.hasOwn(body, "clearClinicCoordinates") && typeof body.clearClinicCoordinates !== "boolean") {
      return { status: 400, error: "clearClinicCoordinates must be a boolean." };
    }

    const hasLatitude = Object.hasOwn(body, "clinicLatitude");
    const hasLongitude = Object.hasOwn(body, "clinicLongitude");
    if (hasLatitude !== hasLongitude) {
      return { status: 400, error: "Both clinic coordinates are required." };
    }
    if (hasLatitude) {
      const latitude = parseCoordinate(body.clinicLatitude, -90, 90);
      const longitude = parseCoordinate(body.clinicLongitude, -180, 180);
      if (latitude === null || longitude === null) {
        return { status: 400, error: "Clinic coordinates are invalid." };
      }
      doctorSet.location = { type: "Point", coordinates: [longitude, latitude] };
    } else if (body.clearClinicCoordinates === true) {
      doctorUnset.location = "";
    }

    const currentAddress = doctor.clinicLocation?.trim() ?? "";
    const addressChanged =
      Object.hasOwn(body, "clinicLocation") &&
      body.clinicLocation.trim() !== currentAddress;
    const currentCoordinates = doctor.location?.coordinates;
    const coordinatesChanged =
      hasLatitude &&
      (
        !Array.isArray(currentCoordinates) ||
        currentCoordinates[0] !== doctorSet.location.coordinates[0] ||
        currentCoordinates[1] !== doctorSet.location.coordinates[1]
      );
    const coordinatesCleared =
      body.clearClinicCoordinates === true && Array.isArray(currentCoordinates);

    if (addressChanged && !hasLatitude && !coordinatesCleared && Array.isArray(currentCoordinates)) {
      doctorUnset.location = "";
    }
    if (addressChanged || coordinatesChanged || coordinatesCleared) {
      doctorSet.locationVerified = false;
    }
  }

  if (Object.keys(userSet).length === 0 && Object.keys(doctorSet).length === 0 && Object.keys(doctorUnset).length === 0) {
    return { status: 400, error: "No editable profile details were provided." };
  }

  return {
    userUpdate: Object.keys(userSet).length ? { $set: userSet } : null,
    doctorUpdate: Object.keys(doctorSet).length || Object.keys(doctorUnset).length
      ? {
          ...(Object.keys(doctorSet).length ? { $set: doctorSet } : {}),
          ...(Object.keys(doctorUnset).length ? { $unset: doctorUnset } : {}),
        }
      : null,
    doctorProfileEditable,
  };
}

module.exports = { buildProfileUpdate };
