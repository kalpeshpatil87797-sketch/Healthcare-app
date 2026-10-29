export const CLINIC_PICKER_DEFAULT_CENTER = [22.5, 79];
export const CLINIC_PICKER_DEFAULT_ZOOM = 5;

export function validClinicPickerCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
}

export function normalizeClinicPickerResult(location) {
  if (
    !location ||
    (typeof location.latitude !== "number" && typeof location.latitude !== "string") ||
    String(location.latitude).trim() === "" ||
    (typeof location.longitude !== "number" && typeof location.longitude !== "string") ||
    String(location.longitude).trim() === ""
  ) return null;
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!validClinicPickerCoordinates(latitude, longitude)) return null;
  if (!["exact", "approximate"].includes(location?.classification)) return null;
  const displayName = String(location.displayName ?? "").trim();
  if (!displayName || displayName.length > 300) return null;
  return {
    displayName,
    latitude,
    longitude,
    classification: location.classification,
  };
}

export function clinicPickerPositionFromGeolocation(coords) {
  const position = [Number(coords?.latitude), Number(coords?.longitude)];
  return validClinicPickerCoordinates(...position) ? position : null;
}

export function clinicPickerPositionFromEvent(event) {
  const latitude = Number(event?.latlng?.lat);
  const longitude = Number(event?.latlng?.lng);
  return validClinicPickerCoordinates(latitude, longitude)
    ? [latitude, longitude]
    : null;
}

export function clinicPickerPositionFromDrag(event) {
  return clinicPickerPositionFromEvent(event);
}

export function getClinicGeolocationError(error) {
  if (error?.code === 1) return "Location permission was denied. You can search or place the pin manually.";
  if (error?.code === 2) return "Your current location is unavailable. Try again or place the pin manually.";
  if (error?.code === 3) return "The location request timed out. Try again or place the pin manually.";
  return "Could not read your current location. Search or place the pin manually.";
}

export function cancelClinicPickerSearch(controller, onCancel) {
  controller?.abort();
  onCancel();
}

export function confirmClinicPickerPosition(position) {
  if (
    !Array.isArray(position) ||
    position.length !== 2 ||
    !validClinicPickerCoordinates(position[0], position[1])
  ) {
    return null;
  }
  return { latitude: position[0], longitude: position[1] };
}

export async function resolveClinicPickerSelection(
  latitude,
  longitude,
  reverseGeocode,
  source = "manual"
) {
  if (!validClinicPickerCoordinates(latitude, longitude)) {
    throw new Error("The selected coordinates are invalid.");
  }
  const address = await reverseGeocode(latitude, longitude);
  if (
    typeof address !== "string" ||
    !address.trim() ||
    address.trim().length > 300 ||
    /^lat\s*:/i.test(address.trim())
  ) {
    throw new Error("No usable address was found for this location. Move the pin or search for the clinic.");
  }
  return {
    latitude,
    longitude,
    address: address.trim(),
    source,
    classification: "approximate",
    status: "resolved",
  };
}

export function applyClinicPickerSelection(form, selection) {
  const coordinates = confirmClinicPickerPosition(
    selection && [selection.latitude, selection.longitude]
  );
  if (
    !coordinates ||
    typeof selection.address !== "string" ||
    !selection.address.trim() ||
    selection.address.trim().length > 300 ||
    selection.status !== "resolved"
  ) return form;
  return {
    ...form,
    clinicLocation: selection.address.trim(),
    clinicLatitude: String(coordinates.latitude),
    clinicLongitude: String(coordinates.longitude),
  };
}
