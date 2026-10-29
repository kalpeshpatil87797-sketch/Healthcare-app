const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APPOINTMENT_SLOTS,
  getAvailableAppointmentSlots,
} = require("../utils/appointmentAvailability");

test("availability excludes pending and accepted bookings on the selected date", () => {
  const slots = getAvailableAppointmentSlots([
    {
      status: "pending",
      appointmentDate: "2026-11-02",
      appointmentTime: "09:00 AM",
    },
    {
      status: "accepted",
      appointmentDate: "2026-11-02",
      appointmentTime: "09:30 AM",
    },
  ], "2026-11-02");

  assert.deepEqual(slots, APPOINTMENT_SLOTS.slice(2));
});

test("accepted alternatives occupy their suggested date; inactive requests do not", () => {
  const slots = getAvailableAppointmentSlots([
    {
      status: "accepted",
      appointmentDate: "2026-11-01",
      appointmentTime: "09:00 AM",
      alternateDate: "2026-11-02",
      alternateTime: "02:00 PM",
    },
    {
      status: "alternate_requested",
      appointmentDate: "2026-11-02",
      appointmentTime: "09:30 AM",
      alternateDate: "2026-11-02",
      alternateTime: "02:30 PM",
    },
    {
      status: "cancelled",
      appointmentDate: "2026-11-02",
      appointmentTime: "10:00 AM",
    },
  ], "2026-11-02");

  assert.equal(slots.includes("02:00 PM"), false);
  assert.equal(slots.includes("09:30 AM"), true);
  assert.equal(slots.includes("02:30 PM"), true);
  assert.equal(slots.includes("10:00 AM"), true);
});
