import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  CLINIC_PICKER_DEFAULT_CENTER,
  CLINIC_PICKER_DEFAULT_ZOOM,
  clinicPickerPositionFromDrag,
  clinicPickerPositionFromEvent,
  clinicPickerPositionFromGeolocation,
  cancelClinicPickerSearch,
  confirmClinicPickerPosition,
  getClinicGeolocationError,
  normalizeClinicPickerResult,
  resolveClinicPickerSelection,
  validClinicPickerCoordinates,
} from "../utils/clinicLocationPicker";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:8001";

const PICKER_PIN = L.divIcon({
  className: "clinic-location-picker-pin",
  html: '<svg viewBox="0 0 36 44" aria-hidden="true"><path d="M18 1C8.6 1 1 8.6 1 18c0 12.1 15.1 24.2 15.7 24.7a2 2 0 0 0 2.6 0C19.9 42.2 35 30.1 35 18 35 8.6 27.4 1 18 1Z"/><circle cx="18" cy="17" r="11"/><path d="M16 10h4v5h5v4h-5v5h-4v-5h-5v-4h5z"/></svg>',
  iconSize: [36, 44],
  iconAnchor: [18, 42],
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      const position = clinicPickerPositionFromEvent(event);
      if (position) onPick(position);
    },
  });
  return null;
}

function MapViewport({ position, revision }) {
  const map = useMap();
  useEffect(() => {
    if (revision > 0 && position) map.setView(position, 16);
  }, [map, position, revision]);
  return null;
}

function ClinicLocationPicker({
  initialPosition,
  onCancel,
  onConfirm,
}) {
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(() => (
    Array.isArray(initialPosition) &&
    validClinicPickerCoordinates(initialPosition[0], initialPosition[1])
      ? {
          latitude: initialPosition[0],
          longitude: initialPosition[1],
          address: "",
          source: "manual",
          classification: "approximate",
          status: "loading",
          error: "",
        }
      : null
  ));
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const requestRef = useRef(null);
  const reverseRequestRef = useRef(null);
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") cancelRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      requestRef.current?.abort();
      requestRef.current = null;
      reverseRequestRef.current?.abort();
      reverseRequestRef.current = null;
    };
  }, []);

  function abortSearch() {
    requestRef.current?.abort();
    requestRef.current = null;
    setSearching(false);
  }

  function abortReverseGeocode() {
    reverseRequestRef.current?.abort();
    reverseRequestRef.current = null;
  }

  const reverseGeocodePosition = useCallback(async (position, source) => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSearching(false);
    reverseRequestRef.current?.abort();
    reverseRequestRef.current = null;
    const controller = new AbortController();
    reverseRequestRef.current = controller;
    setSelectedLocation({
      latitude: position[0],
      longitude: position[1],
      address: "",
      source,
      classification: "approximate",
      status: "loading",
      error: "",
    });
    setSearchResults([]);
    setViewportRevision((revision) => revision + 1);
    setGeoError("");
    try {
      const selection = await resolveClinicPickerSelection(
        position[0],
        position[1],
        async (latitude, longitude) => {
          const response = await axios.post(
            `${API_BASE}/user/location/reverse-geocode`,
            { latitude, longitude },
            { signal: controller.signal }
          );
          return response.data?.address;
        },
        source
      );
      if (reverseRequestRef.current !== controller || controller.signal.aborted) return;
      setSelectedLocation(selection);
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      if (reverseRequestRef.current !== controller) return;
      setSelectedLocation((current) => current && ({
        ...current,
        address: "",
        status: "error",
        error: error.response?.data?.error ??
          error.message ??
          "Could not resolve an address for this pin. Move it or search for the clinic.",
      }));
    } finally {
      if (reverseRequestRef.current === controller) reverseRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (selectedLocation?.status === "loading" && !reverseRequestRef.current) {
      reverseGeocodePosition(
        [selectedLocation.latitude, selectedLocation.longitude],
        selectedLocation.source
      );
    }
  }, [selectedLocation, reverseGeocodePosition]);

  function handleSearchInputChange(value) {
    abortSearch();
    setSearchResults([]);
    setSearchError("");
    setQuery(value);
  }

  async function handleSearch(event) {
    event.preventDefault();
    const address = query.trim();
    if (address.length < 3 || searching) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    setGeoError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/user/clinic-location/geocode`,
        { address },
        {
          headers: { Authorization: ["Bearer", token].join(" ") },
          signal: controller.signal,
        }
      );
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const results = (response.data?.candidates ?? [])
        .map(normalizeClinicPickerResult)
        .filter(Boolean);
      if (results.length === 0) {
        setSearchError(
          response.data?.message ??
            "No reliable location matched. Edit the search or place the pin manually."
        );
        return;
      }
      setSearchResults(results);
      if (response.data?.classification === "none") {
        setSearchError(response.data.message ?? "Choose the best-supported result or place the pin manually.");
      }
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      setSearchError(
        error.response?.data?.error ??
          "Location search failed. Check your connection or place the pin manually."
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSearching(false);
      }
    }
  }

  function handleChooseSearchResult(result) {
    abortReverseGeocode();
    setSelectedLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.displayName,
      source: result.classification,
      classification: result.classification,
      status: "resolved",
      error: "",
    });
    setViewportRevision((revision) => revision + 1);
    setGeoError("");
  }

  function handleUseCurrentLocation() {
    abortSearch();
    setGeoError("");
    setSearchError("");
    if (!navigator.geolocation) {
      setGeoError("Browser geolocation is unavailable. Search or place the pin manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const position = clinicPickerPositionFromGeolocation(coords);
        if (!position) {
          setGeoError("The browser returned invalid coordinates. Place the pin manually.");
          return;
        }
        void reverseGeocodePosition(position, "gps");
        setGeoError("GPS gives your device location only. Review its resolved address and confirm it represents the clinic.");
      },
      (error) => {
        setLocating(false);
        setGeoError(getClinicGeolocationError(error));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleMarkerDrag(event) {
    const position = clinicPickerPositionFromDrag(event);
    if (position) void reverseGeocodePosition(position, "manual");
  }

  function handleConfirm() {
    const coordinates = confirmClinicPickerPosition(
      selectedLocation && [selectedLocation.latitude, selectedLocation.longitude]
    );
    if (coordinates && selectedLocation?.status === "resolved" && selectedLocation.address) {
      onConfirm({ ...selectedLocation, ...coordinates });
    }
  }

  function handleCancel() {
    cancelClinicPickerSearch(requestRef.current, onCancel);
  }

  const selectedPosition = selectedLocation
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : Array.isArray(initialPosition) &&
      validClinicPickerCoordinates(initialPosition[0], initialPosition[1])
      ? initialPosition
      : null;

  return (
    <div
      className="clinic-picker-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <section
        className="clinic-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinic-picker-title"
      >
        <header className="clinic-picker-header">
          <div>
            <h2 id="clinic-picker-title">Select clinic location</h2>
            <p>Search for the clinic, then click or drag the pin to its actual location.</p>
          </div>
          <button type="button" className="appointment-secondary-button" onClick={handleCancel}>
            Close
          </button>
        </header>

        <form className="clinic-picker-search" onSubmit={handleSearch}>
          <label htmlFor="clinic-picker-query">Search building, road, area, city, or PIN code</label>
          <div>
            <input
              id="clinic-picker-query"
              type="search"
              minLength={3}
              maxLength={300}
              value={query}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              placeholder="Clinic address or locality"
            />
            <button type="submit" className="provider-primary-button" disabled={searching || query.trim().length < 3}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {searching && <p role="status">Searching OpenStreetMap…</p>}
          {searchError && <p className="clinic-picker-error" role="alert">{searchError}</p>}
          {searchResults.length > 0 && (
            <div className="clinic-picker-results" aria-live="polite">
              {searchResults.map((result, index) => (
                <article className="clinic-picker-result" key={`${result.latitude},${result.longitude}`}>
                  <strong>
                    {result.classification === "approximate"
                      ? "Approximate location"
                      : "Building-level address match"}
                  </strong>
                  {result.classification === "approximate" && (
                    <span>This is a nearby area result, not confirmation of the clinic building.</span>
                  )}
                  <span>{result.displayName}</span>
                  <button
                    type="button"
                    className="appointment-secondary-button"
                    onClick={() => handleChooseSearchResult(result)}
                  >
                    {index === 0 ? "Use this result" : "Choose this result"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </form>

        <div className="clinic-picker-toolbar">
          <button
            type="button"
            className="appointment-secondary-button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
          >
            {locating ? "Finding current location…" : "Use My Current Location"}
          </button>
          <span>GPS is your device position, not necessarily the clinic. Review and adjust the pin.</span>
          {geoError && <p role="status">{geoError}</p>}
        </div>

        {tileError && (
          <p className="clinic-picker-error" role="status">
            Map tiles could not be loaded. You can still search or cancel; the map background may be unavailable.
          </p>
        )}
        <MapContainer
          className="clinic-picker-map"
          center={selectedPosition ?? CLINIC_PICKER_DEFAULT_CENTER}
          zoom={selectedPosition ? 16 : CLINIC_PICKER_DEFAULT_ZOOM}
          scrollWheelZoom
          aria-label="Select clinic coordinates on the map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <MapViewport position={selectedPosition} revision={viewportRevision} />
          <MapClickHandler onPick={(position) => void reverseGeocodePosition(position, "manual")} />
          {selectedLocation && (
            <Marker
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              icon={PICKER_PIN}
              draggable
              riseOnHover
              eventHandlers={{ dragend: handleMarkerDrag }}
            />
          )}
        </MapContainer>
        <p className="clinic-picker-instructions">
          Click the map to place the pin or drag it to refine the position.
        </p>
        <footer className="clinic-picker-footer">
          {selectedLocation ? (
            <div className="clinic-picker-selected">
              <span>
                Selected: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </span>
              {selectedLocation.status === "loading" && (
                <span role="status">Resolving the address for these coordinates…</span>
              )}
              {selectedLocation.status === "error" && (
                <strong className="clinic-picker-error" role="alert">{selectedLocation.error}</strong>
              )}
              {selectedLocation.status === "resolved" && (
                <span>Address for this location: {selectedLocation.address}</span>
              )}
              {selectedLocation.classification === "approximate" && selectedLocation.source === "approximate" && (
                <strong>Approximate search result; adjust the pin to the clinic before confirming.</strong>
              )}
              {selectedLocation.source === "gps" && (
                <strong>GPS is your device position. Confirm only if it is the clinic.</strong>
              )}
              {selectedLocation.source === "manual" && (
                <strong>Manually selected pin; confirm it represents the clinic.</strong>
              )}
            </div>
          ) : (
            <span>No location selected yet.</span>
          )}
          <div>
            <button type="button" className="appointment-secondary-button"             onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="provider-primary-button"
              onClick={handleConfirm}
              disabled={!selectedLocation || selectedLocation.status !== "resolved"}
            >
              Confirm Location
            </button>
          </div>
        </footer>
        <p className="clinic-picker-attribution">
          Search results are provided by Nominatim and may be approximate. © OpenStreetMap contributors.
        </p>
      </section>
    </div>
  );
}

export default ClinicLocationPicker;
