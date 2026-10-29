const CLINIC_LOCATION_VERIFICATION_ROLES = ["admin", "root_owner"];

function hasValidClinicCoordinates(location) {
  const coordinates = location?.coordinates;
  if (
    location?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return false;
  }

  const [longitude, latitude] = coordinates;
  return Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90;
}

function getPublicClinicLocation(locationVerified, location) {
  const verified = locationVerified === true;
  return {
    locationVerified: verified,
    ...(verified && hasValidClinicCoordinates(location)
      ? {
          latitude: location.coordinates[1],
          longitude: location.coordinates[0],
        }
      : {}),
  };
}

function buildClinicLocationVerificationUpdate(role, isVerified, location) {
  if (!CLINIC_LOCATION_VERIFICATION_ROLES.includes(role)) {
    return {
      status: 403,
      error: "Only Admins and the Root Owner can verify clinic locations.",
      code: "FORBIDDEN",
    };
  }
  if (typeof isVerified !== "boolean") {
    return {
      status: 400,
      error: "Clinic location verification must be true or false.",
      code: "INVALID_LOCATION_VERIFICATION",
    };
  }
  if (isVerified && !hasValidClinicCoordinates(location)) {
    return {
      status: 400,
      error: "Save valid clinic coordinates before verifying this location.",
      code: "CLINIC_COORDINATES_REQUIRED",
    };
  }

  return { update: { $set: { locationVerified: isVerified } } };
}

module.exports = {
  CLINIC_LOCATION_VERIFICATION_ROLES,
  hasValidClinicCoordinates,
  getPublicClinicLocation,
  buildClinicLocationVerificationUpdate,
};
