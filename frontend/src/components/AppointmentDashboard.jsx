import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8001";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function todayLocalISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function authConfig() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };
}

function displayDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AppointmentItem({ appointment, doctorView, onCancel, onComplete, onReschedule }) {
  const statusLabel = appointment.status === "accepted"
    ? "Confirmed"
    : appointment.status?.replace(/_/g, " ");
  const isUpcoming = ["pending", "accepted"].includes(appointment.status) &&
    appointment.appointmentDate >= todayLocalISO();

  return (
    <article className="smart-appointment-card">
      <div className="smart-appointment-heading">
        <div>
          <strong>{doctorView ? appointment.patientName : appointment.doctorName}</strong>
          <span>{displayDate(appointment.appointmentDate)} at {appointment.appointmentTime}</span>
        </div>
        <span className={`smart-appointment-status smart-status-${appointment.status}`}>
          {statusLabel}
        </span>
      </div>
      {appointment.specialist ? <p>{appointment.specialist}</p> : null}
      <p className="smart-appointment-reason">
        <strong>Reason for visit:</strong> {appointment.visitReason || "Not provided"}
      </p>
      <p className="smart-appointment-id">Appointment ID: {appointment._id}</p>
      {isUpcoming ? (
        <div className="smart-appointment-actions">
          <button type="button" onClick={() => onReschedule(appointment)}>
            Reschedule
          </button>
          <button type="button" onClick={() => onCancel(appointment)}>
            Cancel
          </button>
          {doctorView && appointment.status === "accepted" ? (
            <button type="button" onClick={() => onComplete(appointment)}>
              Mark completed
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AvailabilitySettings({ onUpdated = () => {} }) {
  const [availability, setAvailability] = useState(null);
  const [blockedDate, setBlockedDate] = useState("");
  const [period, setPeriod] = useState({ date: "", startTime: "", endTime: "" });
  const [breakInput, setBreakInput] = useState({ dayOfWeek: "1", startTime: "", endTime: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/doctor/availability`, authConfig())
      .then(({ data }) => {
        if (active) {
          setAvailability(data.availability);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.error ?? "Availability settings could not be loaded.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  function updateHours(dayOfWeek, field, value) {
    setAvailability((current) => {
      const currentHours = current.workingHours.filter((range) => range.dayOfWeek !== dayOfWeek);
      const existing = current.workingHours.find((range) => range.dayOfWeek === dayOfWeek);
      if (!existing && field === "enabled") {
        currentHours.push({ dayOfWeek, startTime: "09:00", endTime: "17:00" });
      } else if (existing && field !== "enabled") {
        currentHours.push({ ...existing, [field]: value });
      }
      return { ...current, workingHours: currentHours };
    });
  }

  async function saveAvailability(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await axios.put(
        `${API_BASE}/doctor/availability`,
        availability,
        authConfig()
      );
      setAvailability(data.availability);
      setNotice("Availability saved. Patients will see only current bookable slots.");
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error ?? "Availability could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function addBlockedDate() {
    if (!blockedDate) return;
    setAvailability((current) => ({
      ...current,
      blockedDates: [...new Set([...current.blockedDates, blockedDate])].sort(),
    }));
    setBlockedDate("");
  }

  function addUnavailablePeriod() {
    if (!period.date || !period.startTime || !period.endTime) return;
    setAvailability((current) => ({
      ...current,
      unavailablePeriods: [...current.unavailablePeriods, period],
    }));
    setPeriod({ date: "", startTime: "", endTime: "" });
  }

  function addBreak() {
    if (!breakInput.startTime || !breakInput.endTime) return;
    setAvailability((current) => ({
      ...current,
      breaks: [
        ...current.breaks,
        { ...breakInput, dayOfWeek: Number(breakInput.dayOfWeek) },
      ],
    }));
    setBreakInput({ ...breakInput, startTime: "", endTime: "" });
  }

  if (loading) return <p role="status">Loading doctor availability…</p>;
  if (!availability) return error ? <p role="alert">{error}</p> : null;

  return (
    <section className="smart-availability">
      <h2>Manage availability</h2>
      <p>Changes apply immediately to future bookable slots. Existing appointments remain on the calendar.</p>
      <form onSubmit={saveAvailability}>
        <label>
          Appointment length
          <select
            value={availability.slotDurationMinutes}
            onChange={(event) => setAvailability({
              ...availability,
              slotDurationMinutes: Number(event.target.value),
            })}
          >
            {[15, 20, 30, 45, 60, 90, 120].map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} minutes</option>
            ))}
          </select>
        </label>
        <h3>Weekly working hours</h3>
        <div className="smart-working-hours">
          {WEEKDAYS.map((day, dayOfWeek) => {
            const range = availability.workingHours.find((item) => item.dayOfWeek === dayOfWeek);
            return (
              <div className="smart-working-row" key={day}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(range)}
                    onChange={() => updateHours(dayOfWeek, "enabled", !range)}
                  />
                  {day}
                </label>
                {range ? (
                  <>
                    <input
                      type="time"
                      aria-label={`${day} start`}
                      value={range.startTime}
                      onChange={(event) => updateHours(dayOfWeek, "startTime", event.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      aria-label={`${day} end`}
                      value={range.endTime}
                      onChange={(event) => updateHours(dayOfWeek, "endTime", event.target.value)}
                    />
                  </>
                ) : <span>Not working</span>}
              </div>
            );
          })}
        </div>
        <h3>Weekly breaks</h3>
        <div className="smart-inline-form">
          <select
            value={breakInput.dayOfWeek}
            onChange={(event) => setBreakInput({ ...breakInput, dayOfWeek: event.target.value })}
            aria-label="Break weekday"
          >
            {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
          <input type="time" aria-label="Break start" value={breakInput.startTime} onChange={(event) => setBreakInput({ ...breakInput, startTime: event.target.value })} />
          <input type="time" aria-label="Break end" value={breakInput.endTime} onChange={(event) => setBreakInput({ ...breakInput, endTime: event.target.value })} />
          <button type="button" onClick={addBreak}>Add break</button>
        </div>
        <ul className="smart-exception-list">
          {availability.breaks.map((item, index) => (
            <li key={`${item.dayOfWeek}-${item.startTime}-${index}`}>
              {WEEKDAYS[item.dayOfWeek]} {item.startTime}–{item.endTime}
              <button type="button" onClick={() => setAvailability({
                ...availability,
                breaks: availability.breaks.filter((_, itemIndex) => itemIndex !== index),
              })}>Remove</button>
            </li>
          ))}
        </ul>
        <h3>Blocked dates and unavailable periods</h3>
        <div className="smart-inline-form">
          <input type="date" value={blockedDate} onChange={(event) => setBlockedDate(event.target.value)} aria-label="Date to block" />
          <button type="button" onClick={addBlockedDate}>Block full date</button>
        </div>
        <ul className="smart-exception-list">
          {availability.blockedDates.map((date) => (
            <li key={date}>{displayDate(date)}<button type="button" onClick={() => setAvailability({
              ...availability,
              blockedDates: availability.blockedDates.filter((item) => item !== date),
            })}>Remove</button></li>
          ))}
        </ul>
        <div className="smart-inline-form">
          <input type="date" value={period.date} onChange={(event) => setPeriod({ ...period, date: event.target.value })} aria-label="Unavailable date" />
          <input type="time" value={period.startTime} onChange={(event) => setPeriod({ ...period, startTime: event.target.value })} aria-label="Unavailable start" />
          <input type="time" value={period.endTime} onChange={(event) => setPeriod({ ...period, endTime: event.target.value })} aria-label="Unavailable end" />
          <button type="button" onClick={addUnavailablePeriod}>Add unavailable period</button>
        </div>
        <ul className="smart-exception-list">
          {availability.unavailablePeriods.map((item, index) => (
            <li key={`${item.date}-${item.startTime}-${index}`}>
              {displayDate(item.date)} {item.startTime}–{item.endTime}
              <button type="button" onClick={() => setAvailability({
                ...availability,
                unavailablePeriods: availability.unavailablePeriods.filter((_, itemIndex) => itemIndex !== index),
              })}>Remove</button>
            </li>
          ))}
        </ul>
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save availability"}</button>
      </form>
    </section>
  );
}

export default function AppointmentDashboard({ role }) {
  const doctorView = role === "doctor";
  const [appointments, setAppointments] = useState([]);
  const [loadedView, setLoadedView] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rescheduling, setRescheduling] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [acting, setActing] = useState(false);
  const viewKey = doctorView ? "doctor" : "patient";
  const loading = loadedView !== viewKey;

  async function loadAppointments() {
    setRefreshing(true);
    setError("");
    try {
      const endpoint = doctorView ? "/appointment/doctor" : "/appointment/mine";
      const { data } = await axios.get(`${API_BASE}${endpoint}`, authConfig());
      setAppointments(data.appointments ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? "Appointments could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    const endpoint = doctorView ? "/appointment/doctor" : "/appointment/mine";
    axios.get(`${API_BASE}${endpoint}`, authConfig())
      .then(({ data }) => {
        if (!active) return;
        setAppointments(data.appointments ?? []);
        setError("");
        setLoadedView(viewKey);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.error ?? "Appointments could not be loaded.");
        setLoadedView(viewKey);
      });
    return () => { active = false; };
  }, [viewKey, doctorView]);

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) =>
      `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(
        `${b.appointmentDate} ${b.appointmentTime}`
      )
    ),
    [appointments]
  );
  const upcoming = sortedAppointments.filter((item) =>
    ["pending", "accepted"].includes(item.status) &&
    item.appointmentDate >= todayLocalISO()
  );
  const past = sortedAppointments.filter((item) => !upcoming.includes(item));

  async function mutate(appointment, action, payload = {}) {
    if (acting) return;
    setActing(true);
    setError("");
    setNotice("");
    try {
      const { data } = await axios.patch(
        `${API_BASE}/appointment/${appointment._id}/${action}`,
        payload,
        authConfig()
      );
      setRescheduling(null);
      setNotice(data.notificationWarning || (
        action === "complete"
          ? "Appointment marked completed."
          : action === "cancel"
            ? "Appointment cancelled. Its history has been preserved."
            : "Appointment rescheduled and confirmed."
      ));
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error ?? "The appointment could not be updated.");
    } finally {
      setActing(false);
    }
  }

  async function loadSlots(date) {
    setRescheduleDate(date);
    setSelectedSlot("");
    setAvailableSlots([]);
    if (!date || !rescheduling?.doctorId) return;
    try {
      const { data } = await axios.get(
        `${API_BASE}/doctor/${rescheduling.doctorId}/availability`,
        { params: { date }, ...authConfig() }
      );
      setAvailableSlots(data.availableSlots ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? "Available times could not be loaded.");
    }
  }

  function beginReschedule(appointment) {
    setError("");
    setRescheduleDate("");
    setSelectedSlot("");
    setAvailableSlots([]);
    setRescheduling(appointment);
  }

  return (
    <section className="smart-appointments" aria-labelledby="smart-appointments-title">
      <div className="smart-section-heading">
        <div>
          <span className="care-eyebrow">APPOINTMENTS</span>
          <h2 id="smart-appointments-title">
            {doctorView ? "Your schedule" : "Your appointments"}
          </h2>
        </div>
        <button type="button" onClick={loadAppointments} disabled={loading || refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p className="smart-appointment-error" role="alert">{error}</p> : null}
      {loading ? <p role="status">Loading appointments…</p> : null}
      {!loading && !error ? (
        <>
          <h3>{doctorView ? "Today and upcoming" : "Upcoming"}</h3>
          {upcoming.length ? upcoming.map((appointment) => (
            <AppointmentItem
              key={appointment._id}
              appointment={appointment}
              doctorView={doctorView}
              onCancel={(item) => {
                if (window.confirm("Cancel this appointment? The booking history will be kept.")) {
                  mutate(item, "cancel");
                }
              }}
              onComplete={(item) => mutate(item, "complete")}
              onReschedule={beginReschedule}
            />
          )) : <p>No upcoming appointments.</p>}
          <h3>Past and cancelled</h3>
          {past.length ? past.map((appointment) => (
            <AppointmentItem
              key={appointment._id}
              appointment={appointment}
              doctorView={doctorView}
              onCancel={() => {}}
              onComplete={() => {}}
              onReschedule={() => {}}
            />
          )) : <p>No past appointments.</p>}
        </>
      ) : null}
      {rescheduling ? (
        <div className="smart-reschedule">
          <h3>Reschedule appointment</h3>
          <label>
            New date
            <input
              type="date"
              min={todayLocalISO()}
              value={rescheduleDate}
              onChange={(event) => loadSlots(event.target.value)}
            />
          </label>
          {availableSlots.length ? (
            <label>
              Available time
              <select value={selectedSlot} onChange={(event) => setSelectedSlot(event.target.value)}>
                <option value="">Select a time</option>
                {availableSlots.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
          ) : rescheduleDate ? <p>No available times for this date.</p> : null}
          <button
            type="button"
            disabled={!rescheduleDate || !selectedSlot || acting}
            onClick={() => mutate(rescheduling, "reschedule", {
              appointmentDate: rescheduleDate,
              appointmentTime: selectedSlot,
            })}
          >
            {acting ? "Saving…" : "Confirm reschedule"}
          </button>
          <button type="button" onClick={() => setRescheduling(null)}>Keep current time</button>
        </div>
      ) : null}
      {doctorView ? <AvailabilitySettings onUpdated={loadAppointments} /> : null}
    </section>
  );
}
