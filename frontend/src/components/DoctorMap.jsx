import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  DEFAULT_DOCTOR_MAP_CENTER,
  DEFAULT_DOCTOR_MAP_ZOOM,
  getDoctorMapMessage,
  getDoctorMapViewport,
  getVerifiedDoctorMapCandidates,
} from "../utils/doctorMap";
import "leaflet/dist/leaflet.css";

const CLINIC_MARKER_HTML = `
  <svg class="doctor-clinic-pin-art" viewBox="0 0 36 44" aria-hidden="true" focusable="false">
    <path class="doctor-clinic-pin-shadow" d="M18 1C8.6 1 1 8.6 1 18c0 12.1 15.1 24.2 15.7 24.7a2 2 0 0 0 2.6 0C19.9 42.2 35 30.1 35 18 35 8.6 27.4 1 18 1Z" />
    <circle class="doctor-clinic-pin-center" cx="18" cy="17" r="11" />
    <path class="doctor-clinic-pin-cross" d="M16 10h4v5h5v4h-5v5h-4v-5h-5v-4h5z" />
  </svg>
`;

function createClinicIcon(selected = false) {
  return L.divIcon({
    className: `doctor-clinic-marker${selected ? " is-selected" : ""}`,
    html: CLINIC_MARKER_HTML,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

function FitDoctorMarkers({ doctors }) {
  const map = useMap();
  const markerSignature = doctors
    .map((doctor) => `${doctor.latitude},${doctor.longitude}`)
    .join("|");
  const viewport = useMemo(() => {
    const points = markerSignature
      ? markerSignature.split("|").map((point) => point.split(",").map(Number))
      : [];
    return getDoctorMapViewport(points);
  }, [markerSignature]);

  useEffect(() => {
    if (viewport.kind === "default") {
      map.setView(viewport.center, viewport.zoom);
      return;
    }
    if (viewport.kind === "single") {
      map.setView(viewport.center, viewport.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(viewport.points), { padding: [32, 32], maxZoom: 12 });
  }, [map, viewport]);

  return null;
}

function DoctorMap({ doctors, onBookDoctor, loading = false }) {
  const [tileError, setTileError] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const mapDoctors = loading ? [] : getVerifiedDoctorMapCandidates(doctors);
  const mapMessage = loading ? "Searching for doctors…" : getDoctorMapMessage(doctors.length, mapDoctors.length);

  return (
    <section className="doctor-map-section" aria-label="Verified clinic map">
      <div className="doctor-map-legend">
        <span className="doctor-map-legend-pin" aria-hidden="true">
          <svg viewBox="0 0 36 44" focusable="false">
            <path d="M18 1C8.6 1 1 8.6 1 18c0 12.1 15.1 24.2 15.7 24.7a2 2 0 0 0 2.6 0C19.9 42.2 35 30.1 35 18 35 8.6 27.4 1 18 1Z" />
            <circle cx="18" cy="17" r="11" />
            <path d="M16 10h4v5h5v4h-5v5h-4v-5h-5v-4h5z" />
          </svg>
        </span>
        <span>Admin-verified clinic location</span>
      </div>
      {tileError && (
        <p className="doctor-map-message doctor-map-error" role="status">
          Map tiles could not be loaded. Clinic results are still available in the list.
        </p>
      )}
      {mapMessage && (
        <p className="doctor-map-message" role="status" aria-live="polite">
          {mapMessage}
        </p>
      )}
      <MapContainer
        className="doctor-map"
        center={DEFAULT_DOCTOR_MAP_CENTER}
        zoom={DEFAULT_DOCTOR_MAP_ZOOM}
        scrollWheelZoom={false}
        aria-label="Map of verified doctor clinic locations"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <FitDoctorMarkers doctors={mapDoctors} />
        {mapDoctors.map((doctor) => (
          <Marker
            key={doctor._id}
            position={[doctor.latitude, doctor.longitude]}
            icon={createClinicIcon(selectedDoctorId === String(doctor._id))}
            title={`${doctor.name} clinic`}
            alt={`Verified clinic for ${doctor.name}`}
            riseOnHover
            eventHandlers={{
              click: () => setSelectedDoctorId(String(doctor._id)),
              popupclose: () => setSelectedDoctorId(null),
            }}
          >
            <Popup>
              <div className="doctor-map-popup">
                <strong>{doctor.name}</strong>
                <span>{doctor.specialist}</span>
                {doctor.clinicName && <span>{doctor.clinicName}</span>}
                {doctor.clinicLocation && <span>{doctor.clinicLocation}</span>}
                <button
                  type="button"
                  className="provider-primary-button"
                  onClick={() => onBookDoctor(doctor)}
                >
                  View doctor / book appointment
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}

export default DoctorMap;
