// Free reverse-geocoding via OpenStreetMap Nominatim (no API key, no paid APIs).
// Returns a human-readable address string for the given coordinates.
// Falls back to a "Lat, Lng" string so the address field is never left empty.

export async function reverseGeocode(latitude, longitude) {
  const fallback = `Lat: ${Number(latitude).toFixed(4)}, Lng: ${Number(longitude).toFixed(4)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = await res.json();
    return data.display_name || fallback;
  } catch {
    return fallback;
  }
}
