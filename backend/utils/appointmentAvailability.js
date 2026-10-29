const APPOINTMENT_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
];

function getAvailableAppointmentSlots(appointments, date) {
  const occupied = new Set();
  for (const appointment of appointments) {
    if (
      ["pending", "accepted"].includes(appointment.status) &&
      appointment.appointmentDate === date
    ) {
      occupied.add(appointment.appointmentTime);
    }
    if (appointment.status === "accepted" && appointment.alternateDate === date) {
      occupied.add(appointment.alternateTime);
    }
  }
  return APPOINTMENT_SLOTS.filter((slot) => !occupied.has(slot));
}

module.exports = { APPOINTMENT_SLOTS, getAvailableAppointmentSlots };
