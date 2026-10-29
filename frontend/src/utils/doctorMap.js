export const DEFAULT_DOCTOR_MAP_CENTER = [22.5, 79];
export const DEFAULT_DOCTOR_MAP_ZOOM = 5;

export function getVerifiedDoctorMapCandidates(doctors) {
  if (!Array.isArray(doctors)) return [];

  return doctors.filter((doctor) => {
    if (
      doctor?.approvalStatus !== "approved" ||
      doctor.isActive !== true ||
      doctor.isAvailable !== true ||
      doctor.locationVerified !== true
    ) {
      return false;
    }

    return (
      Number.isFinite(doctor.latitude) &&
      doctor.latitude >= -90 &&
      doctor.latitude <= 90 &&
      Number.isFinite(doctor.longitude) &&
      doctor.longitude >= -180 &&
      doctor.longitude <= 180
    );
  });
}

export function getDoctorMapViewport(doctors) {
  if (doctors.length === 0) {
    return {
      kind: "default",
      center: DEFAULT_DOCTOR_MAP_CENTER,
      zoom: DEFAULT_DOCTOR_MAP_ZOOM,
    };
  }

  const points = doctors.map((doctor) =>
    Array.isArray(doctor) ? doctor : [doctor.latitude, doctor.longitude]
  );
  if (points.length === 1) {
    return { kind: "single", center: points[0], zoom: 13 };
  }

  return { kind: "bounds", points };
}

export function getDoctorMapMessage(doctorCount, candidateCount) {
  if (doctorCount === 0) {
    return "No doctors matched this search.";
  }
  if (candidateCount === 0) {
    return "Doctors matched, but none have clinic coordinates verified by an Admin or Root Owner. They remain available in the list; only verified clinic locations appear on the map.";
  }
  return "";
}
