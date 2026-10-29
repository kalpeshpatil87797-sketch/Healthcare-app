const test = require("node:test");
const assert = require("node:assert/strict");
const Appointment = require("../models/appointment");
const {
  getBookableSlots,
  normalizeSlotTime,
  validateAvailability,
} = require("../utils/appointmentAvailability");

const monday = "2030-01-07";
const schedule = {
  slotDurationMinutes: 30,
  workingHours: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
  ],
  breaks: [
    { dayOfWeek: 1, startTime: "10:00", endTime: "10:30" },
  ],
  blockedDates: [],
  unavailablePeriods: [
    { date: monday, startTime: "11:00", endTime: "11:30" },
  ],
};

test("validates availability ranges and rejects overlapping work times", () => {
  assert.equal(validateAvailability(schedule).error, undefined);
  const invalid = validateAvailability({
    ...schedule,
    workingHours: [
      ...schedule.workingHours,
      { dayOfWeek: 1, startTime: "11:30", endTime: "13:00" },
    ],
  });
  assert.match(invalid.error, /cannot overlap/i);
});

test("generates only free slots inside working hours excluding breaks and periods", () => {
  const slots = getBookableSlots(
    schedule,
    monday,
    ["09:30 AM"],
    new Date(2030, 0, 7, 8, 0)
  );
  assert.deepEqual(slots, ["09:00 AM", "10:30 AM", "11:30 AM"]);
});

test("does not offer slots on blocked dates or in the past", () => {
  assert.deepEqual(
    getBookableSlots(
      { ...schedule, blockedDates: [monday] },
      monday,
      [],
      new Date(2030, 0, 7, 8, 0)
    ),
    []
  );
  assert.deepEqual(
    getBookableSlots(schedule, monday, [], new Date(2030, 0, 7, 11, 0)),
    ["11:30 AM"]
  );
});

test("normalizes equivalent slot labels before availability and conflict checks", () => {
  assert.equal(normalizeSlotTime("9:00 am"), "09:00 AM");
  assert.equal(normalizeSlotTime("21:30"), "09:30 PM");
  assert.equal(normalizeSlotTime("13:75"), null);
});

test("appointment schema retains a unique active doctor-slot index", () => {
  const slotIndex = Appointment.schema.indexes().find(
    ([fields]) =>
      fields.doctorId === 1 &&
      fields.appointmentDate === 1 &&
      fields.appointmentTime === 1
  );
  assert.ok(slotIndex);
  assert.equal(slotIndex[1].unique, true);
  assert.deepEqual(slotIndex[1].partialFilterExpression.status, {
    $in: ["pending", "accepted"],
  });
});
