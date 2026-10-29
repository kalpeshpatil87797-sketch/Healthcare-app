// Free reverse-geocoding via OpenStreetMap Nominatim (no API key, no paid APIs).
// Returns a human-readable address string for the given coordinates.
// Falls back to a "Lat, Lng" string so the address field is never left empty.

export async function reverseGeocode(latitude, longitude) {
  const fallback = `Lat: ${Number(latitude).toFixed(4)}, Lng: ${Number(longitude).toFixed(4)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      "http://localhost:8001/user/location/reverse-geocode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ latitude, longitude }),
        signal: controller.signal,
      }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return data.address || fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
