import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { applyThemePreference, getThemePreference } from "../utils/theme";
import ClinicLocationPicker from "../components/ClinicLocationPicker";
import {
  applyClinicPickerSelection,
  resolveClinicPickerSelection,
} from "../utils/clinicLocationPicker";
import {
  applyConfirmedClinicLocation,
  createClinicAddressLookup,
} from "../utils/clinicAddressLookup";
import "./auth.css";
import "./ProviderPages.css";

const API_BASE = "http://localhost:8001";

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaveDoctorError, setLeaveDoctorError] = useState("");
  const [isLeavingDoctor, setIsLeavingDoctor] = useState(false);
  const [theme, setTheme] = useState(getThemePreference);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [clinicPickerOpen, setClinicPickerOpen] = useState(false);
  const [clinicLookup, setClinicLookup] = useState({
    status: "idle",
    location: null,
    error: "",
  });
  const clinicLookupRef = useRef(null);
  if (clinicLookupRef.current == null) {
    clinicLookupRef.current = createClinicAddressLookup({
      lookup: async (address, { signal }) => {
        const token = localStorage.getItem("token");
        try {
          const response = await axios.post(
            `${API_BASE}/user/clinic-location/geocode`,
            { address },
            {
              headers: { Authorization: ["Bearer", token].join(" ") },
              signal,
            }
          );
          return response.data.location;
        } catch (error) {
          const message = error.response?.data?.error;
          if (message) throw new Error(message, { cause: error });
          throw error;
        }
      },
      onChange: setClinicLookup,
      delayMs: 850,
    });
  }

  useEffect(() => () => clinicLookupRef.current?.cancel(), []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(res.data);
      } catch (err) {
        setError(err.response?.data?.error ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  function formatUserType(role) {
    const labels = {
      patient: "Patient",
      doctor: "Doctor",
      admin: "Admin",
      root_owner: "Root Owner",
      super_admin: "Super Admin",
    };
    return labels[role] ?? role ?? "Unknown";
  }

  const hasActiveDoctorProfile = Boolean(
    profile?.role === "doctor" &&
    profile?.accountStatus !== "suspended" &&
    profile?.doctorApprovalStatus === "approved" &&
    profile?.doctorProfileActive !== false
  );

  async function handleLeaveDoctorRole() {
    if (!hasActiveDoctorProfile || isLeavingDoctor) return;
    const confirmed = window.confirm(
      "Stop being a doctor? You will lose doctor privileges and continue using the app as a patient. Your doctor profile, appointments, messages, and patient data will be preserved. Any existing appointments will not be canceled automatically."
    );
    if (!confirmed) return;

    setIsLeavingDoctor(true);
    setLeaveDoctorError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/user/doctor/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.setItem("token", response.data.token);
      setProfile((current) => ({
        ...current,
        role: "patient",
        doctorProfileActive: false,
      }));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setLeaveDoctorError(
        err.response?.data?.error ?? "Could not remove doctor privileges. Please try again."
      );
    } finally {
      setIsLeavingDoctor(false);
    }
  }

  function handleThemeChange(nextTheme) {
    setTheme(applyThemePreference(nextTheme));
  }

  function startEditing() {
    const doctor = profile.doctorProfile;
    setEditForm({
      name: profile.name ?? "",
      age: profile.age ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      clinicName: doctor?.clinicName ?? "",
      degree: doctor?.degree ?? "",
      specialist: doctor?.specialist ?? "",
      clinicLocation: doctor?.clinicLocation ?? "",
      clinicLatitude: doctor?.location?.coordinates?.[1] ?? "",
      clinicLongitude: doctor?.location?.coordinates?.[0] ?? "",
    });
    setEditing(true);
    setError("");
    setProfileMessage("");
    setLocationMessage("");
    setClinicLookup({ status: "idle", location: null, error: "" });
  }

  function updateEditField(field, value) {
    setEditForm((current) => {
      if (field !== "clinicLocation") return { ...current, [field]: value };
      const originalAddress = profile.doctorProfile?.clinicLocation ?? "";
      const originalLocation = profile.doctorProfile?.location?.coordinates;
      const addressRestored = value.trim() === originalAddress.trim();
      return {
        ...current,
        clinicLocation: value,
        clinicLatitude: addressRestored && originalLocation ? String(originalLocation[1]) : "",
        clinicLongitude: addressRestored && originalLocation ? String(originalLocation[0]) : "",
      };
    });
    if (field === "clinicLocation") {
      clinicLookupRef.current.schedule(value);
      setLocationMessage("");
    }
    setProfileMessage("");
  }

  async function handleResolveClinicAddress() {
    clinicLookupRef.current.lookupNow(editForm.clinicLocation);
  }

  function handleConfirmMapLocation(location) {
    clinicLookupRef.current.cancel();
    setClinicLookup({ status: "idle", location: null, error: "" });
    setEditForm((current) => applyClinicPickerSelection(current, location));
    setClinicPickerOpen(false);
    setLocationMessage(
      `Clinic address and ${location.source === "approximate" ? "approximate " : ""}map coordinates staged together. Save the profile to store them; an administrator must verify the location before it appears on the map.`
    );
  }

  function handleConfirmResolvedLocation() {
    const location = clinicLookup.location;
    if (
      clinicLookup.status !== "matched" ||
      !location ||
      !["exact", "approximate"].includes(location.classification)
    ) return;
    setEditForm((current) => applyConfirmedClinicLocation(current, location));
    setLocationMessage(
      "Location confirmed. Save the profile to store these coordinates; an administrator must verify them before they appear on the map."
    );
    setClinicLookup({ status: "confirmed", location, error: "" });
  }

  function handleUseClinicLocation() {
    clinicLookupRef.current.cancel();
    setClinicLookup({ status: "idle", location: null, error: "" });
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is unavailable. You can still enter the clinic address manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setLocationMessage("Resolving the address for your current location…");
        try {
          const selection = await resolveClinicPickerSelection(
            coords.latitude,
            coords.longitude,
            async (latitude, longitude) => {
              const response = await axios.post(
                `${API_BASE}/user/location/reverse-geocode`,
                { latitude, longitude }
              );
              return response.data?.address;
            },
            "gps"
          );
          const confirmed = window.confirm(
            `Use this GPS location as the clinic? Confirm that this address represents the clinic:\n\n${selection.address}`
          );
          if (!confirmed) {
            setLocationMessage("GPS location was not staged. No clinic address or coordinates were changed.");
            return;
          }
          setEditForm((current) => applyClinicPickerSelection(current, selection));
          setLocationMessage("Confirmed GPS clinic address and coordinates staged together. Save the profile; an administrator must re-verify the location.");
        } catch (lookupError) {
          setLocationMessage(
            lookupError.response?.data?.error ??
              lookupError.message ??
              "Could not resolve an address for this location. No clinic address or coordinates were changed."
          );
        }
      },
      () => {
        setLocationMessage("Location permission was denied or unavailable. You can still correct the clinic address manually.");
      },
      { timeout: 10000 }
    );
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setProfileMessage("");

    const payload = {
      name: editForm.name,
      age: editForm.age,
      phone: editForm.phone,
      address: editForm.address,
    };
    if (profile.doctorProfileCanEdit) {
      Object.assign(payload, {
        clinicName: editForm.clinicName,
        degree: editForm.degree,
        specialist: editForm.specialist,
        clinicLocation: editForm.clinicLocation,
        clearClinicCoordinates:
          editForm.clinicLatitude === "" || editForm.clinicLongitude === "",
      });
      if (editForm.clinicLatitude !== "" && editForm.clinicLongitude !== "") {
        payload.clinicLatitude = Number(editForm.clinicLatitude);
        payload.clinicLongitude = Number(editForm.clinicLongitude);
      }
    }

    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE}/user/me`, payload, {
        headers: { Authorization: ["Bearer", token].join(" ") },
      });
      const updatedProfile = await axios.get(`${API_BASE}/user/me`, {
        headers: { Authorization: ["Bearer", token].join(" ") },
      });
      setProfile(updatedProfile.data);
      setEditing(false);
      setProfileMessage(
        profile.doctorProfileCanEdit
          ? "Profile updated. Any clinic address or coordinate change requires Admin or Root Owner re-verification."
          : "Profile updated successfully."
      );
    } catch (err) {
      setError(err.response?.data?.error ?? "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <Layout>
      <div className="provider-page profile-page">
        <header className="provider-page-heading">
          <div>
            <span className="provider-eyebrow">ACCOUNT</span>
            <h1>Your profile</h1>
            <p>Review your personal information and account type.</p>
          </div>
          {!loading && !error && profile && !editing && (
            <button type="button" className="provider-primary-button" onClick={startEditing}>
              Edit profile
            </button>
          )}
        </header>
        {loading && <p className="provider-status" role="status">Loading profile...</p>}
        {!loading && error && <div className="provider-error" role="alert">{error}</div>}
        {!loading && !error && profile && (
          editing ? (
            <form className="profile-edit-card" onSubmit={handleSaveProfile}>
              <h2>Edit profile</h2>
              <div className="profile-edit-grid">
                <label>
                  Full name
                  <input required maxLength={100} value={editForm.name} onChange={(event) => updateEditField("name", event.target.value)} />
                </label>
                <label>
                  Age
                  <input required type="number" min="1" max="130" value={editForm.age} onChange={(event) => updateEditField("age", event.target.value)} />
                </label>
                <label>
                  Phone number
                  <input required type="tel" maxLength={25} value={editForm.phone} onChange={(event) => updateEditField("phone", event.target.value)} />
                </label>
                <label className="profile-edit-wide">
                  Address
                  <textarea required maxLength={300} rows={3} value={editForm.address} onChange={(event) => updateEditField("address", event.target.value)} />
                </label>
                {profile.doctorProfileCanEdit && (
                  <>
                    <h3 className="profile-edit-wide">Professional and clinic details</h3>
                    <label>
                      Clinic name
                      <input required maxLength={150} value={editForm.clinicName} onChange={(event) => updateEditField("clinicName", event.target.value)} />
                    </label>
                    <label>
                      Degree
                      <input required maxLength={120} value={editForm.degree} onChange={(event) => updateEditField("degree", event.target.value)} />
                    </label>
                    <label>
                      Specialty
                      <input required maxLength={100} value={editForm.specialist} onChange={(event) => updateEditField("specialist", event.target.value)} />
                    </label>
                    <label className="profile-edit-wide">
                      Clinic address
                      <textarea
                        required
                        maxLength={300}
                        rows={3}
                        value={editForm.clinicLocation}
                        onChange={(event) => updateEditField("clinicLocation", event.target.value)}
                      />
                    </label>
                    <div className="profile-clinic-location profile-edit-wide">
                      <button type="button" className="appointment-secondary-button" onClick={handleUseClinicLocation}>
                        Use current location
                      </button>
                      <button
                        type="button"
                        className="appointment-secondary-button"
                        onClick={() => {
                          clinicLookupRef.current.cancel();
                          setClinicLookup({ status: "idle", location: null, error: "" });
                          setClinicPickerOpen(true);
                        }}
                      >
                        Select Location on Map
                      </button>
                      {editForm.clinicLatitude !== "" && editForm.clinicLongitude !== "" ? (
                        <span>Selected coordinates: {Number(editForm.clinicLatitude).toFixed(5)}, {Number(editForm.clinicLongitude).toFixed(5)}</span>
                      ) : (
                        <span>No clinic coordinates selected. Address edits can be saved manually.</span>
                      )}
                      <div className="profile-address-geocode">
                        <button
                          type="button"
                          className="appointment-secondary-button"
                          onClick={handleResolveClinicAddress}
                          disabled={clinicLookup.status === "loading" || !editForm.clinicLocation.trim()}
                        >
                          {clinicLookup.status === "loading" ? "Looking up address…" : "Check address now"}
                        </button>
                        <p>
                          Address is checked after typing pauses. OpenStreetMap Nominatim is used for lookup; review any result before saving.{" "}
                          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                            © OpenStreetMap contributors
                          </a>
                        </p>
                        {clinicLookup.status === "waiting" && (
                          <span role="status">Waiting for you to finish typing…</span>
                        )}
                        {clinicLookup.status === "loading" && (
                          <span role="status">Checking the full clinic address and nearby area…</span>
                        )}
                        {clinicLookup.status === "error" && (
                          <p className="profile-location-error" role="alert">{clinicLookup.error}</p>
                        )}
                        {clinicLookup.location && (
                          <div className="profile-resolved-location" role="group" aria-label="Resolved clinic location">
                            <strong>
                              {clinicLookup.location.classification === "approximate"
                                ? "Approximate location"
                                : "Building-level address match"}
                            </strong>
                            {clinicLookup.location.classification === "approximate" && (
                              <span>
                                These coordinates identify a nearby area, not the exact clinic building.
                              </span>
                            )}
                            <span>{clinicLookup.location.displayName}</span>
                            <span>
                              {clinicLookup.location.latitude.toFixed(5)}, {clinicLookup.location.longitude.toFixed(5)}
                            </span>
                            {clinicLookup.status === "matched" ? (
                              <button
                                type="button"
                                className="provider-primary-button"
                                onClick={handleConfirmResolvedLocation}
                              >
                                Confirm this location
                              </button>
                            ) : (
                              <span role="status">Location confirmed for profile save; Admin verification is still required.</span>
                            )}
                          </div>
                        )}
                      </div>
                      {locationMessage && <p role="status">{locationMessage}</p>}
                    </div>
                    <p className="profile-edit-notice profile-edit-wide">
                      Editing the clinic address or coordinates revokes location verification. Only an Admin or Root Owner can verify the corrected location.
                    </p>
                  </>
                )}
              </div>
              <div className="profile-edit-actions">
                <button type="submit" className="provider-primary-button" disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
                <button type="button" className="appointment-secondary-button" onClick={() => setEditing(false)} disabled={savingProfile}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
          <section className="profile-card" aria-label="Profile details">
            <div className="profile-identity">
              <span className="profile-avatar" aria-hidden="true">{profile.name?.trim().charAt(0).toUpperCase()}</span>
              <div>
                <h2>{profile.name}</h2>
                <span className="profile-role">
                  {formatUserType(profile.effectiveRole ?? profile.role)}
                </span>
              </div>
            </div>
            <dl className="profile-details">
              <div><dt>Age</dt><dd>{profile.age}</dd></div>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.phone}</dd></div>
              {profile.role === "doctor" && profile.speciality && (
                <div><dt>Specialty</dt><dd>{profile.speciality}</dd></div>
              )}
              <div><dt>Address</dt><dd>{profile.address}</dd></div>
              {profile.doctorProfile && (
                <>
                  <div><dt>Clinic</dt><dd>{profile.doctorProfile.clinicName}</dd></div>
                  <div><dt>Clinic address</dt><dd>{profile.doctorProfile.clinicLocation}</dd></div>
                  <div><dt>Doctor application</dt><dd>{profile.doctorProfile.approvalStatus}</dd></div>
                  <div><dt>Clinic location verification</dt><dd>{profile.doctorProfile.locationVerified ? "Verified" : "Not verified"}</dd></div>
                </>
              )}
            </dl>
          </section>
          )
        )}
        {clinicPickerOpen && (
          <ClinicLocationPicker
            initialPosition={
              editForm.clinicLatitude === "" || editForm.clinicLongitude === ""
                ? null
                : [
                    Number(editForm.clinicLatitude),
                    Number(editForm.clinicLongitude),
                  ]
            }
            onCancel={() => setClinicPickerOpen(false)}
            onConfirm={handleConfirmMapLocation}
          />
        )}
        {profileMessage && <p className="provider-status" role="status">{profileMessage}</p>}
        {!loading && !error && hasActiveDoctorProfile ? (
          <section className="profile-appearance" aria-labelledby="doctor-access-title">
            <div>
              <span className="provider-eyebrow">DOCTOR ACCESS</span>
              <h2 id="doctor-access-title">Change account type</h2>
              <p>
                Stop using this account as a doctor. Your account will remain active
                and continue as a patient.
              </p>
              {leaveDoctorError ? (
                <p className="provider-error" role="alert">{leaveDoctorError}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="provider-primary-button"
              onClick={handleLeaveDoctorRole}
              disabled={isLeavingDoctor}
            >
              {isLeavingDoctor ? "Updating…" : "Not a Doctor Anymore"}
            </button>
          </section>
        ) : null}
        <section className="profile-appearance" aria-labelledby="appearance-title">
          <div>
            <span className="provider-eyebrow">DISPLAY</span>
            <h2 id="appearance-title">Appearance</h2>
            <p>Choose the theme that feels comfortable to use.</p>
          </div>
          <div className="theme-segment" role="group" aria-label="Color theme">
            <button
              type="button"
              className={theme === "light" ? "theme-option theme-option-active" : "theme-option"}
              aria-pressed={theme === "light"}
              onClick={() => handleThemeChange("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === "dark" ? "theme-option theme-option-active" : "theme-option"}
              aria-pressed={theme === "dark"}
              onClick={() => handleThemeChange("dark")}
            >
              Dark
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default Profile;
