const DEFAULT_SLOT_DURATION_MINUTES = 30;

function timeToMinutes(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeSlotTime(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").toUpperCase();
  const minutes = timeToMinutes(trimmed);
  if (minutes !== null) {
    const hour = Math.floor(minutes / 60);
    const suffix = hour < 12 ? "AM" : "PM";
    return `${String(hour % 12 || 12).padStart(2, "0")}:${String(
      minutes % 60
    ).padStart(2, "0")} ${suffix}`;
  }
  const match = /^(0?[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/.exec(trimmed);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]} ${match[3]}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function overlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function validateAvailability(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Availability settings are required." };
  }

  const slotDurationMinutes = value.slotDurationMinutes;
  if (
    !Number.isInteger(slotDurationMinutes) ||
    slotDurationMinutes < 15 ||
    slotDurationMinutes > 120 ||
    slotDurationMinutes % 5 !== 0
  ) {
    return { error: "Slot duration must be 15-120 minutes in 5-minute increments." };
  }

  const workingHours = Array.isArray(value.workingHours) ? value.workingHours : null;
  const breaks = Array.isArray(value.breaks) ? value.breaks : null;
  const blockedDates = Array.isArray(value.blockedDates) ? value.blockedDates : null;
  const unavailablePeriods = Array.isArray(value.unavailablePeriods)
    ? value.unavailablePeriods
    : null;
  if (!workingHours || !breaks || !blockedDates || !unavailablePeriods) {
    return { error: "Availability settings contain an invalid list." };
  }

  const normalizedHours = [];
  for (const range of workingHours) {
    const start = timeToMinutes(range?.startTime);
    const end = timeToMinutes(range?.endTime);
    if (
      !Number.isInteger(range?.dayOfWeek) ||
      range.dayOfWeek < 0 ||
      range.dayOfWeek > 6 ||
      start === null ||
      end === null ||
      start >= end
    ) {
      return { error: "Each working range must have a valid weekday and start/end time." };
    }
    normalizedHours.push({
      dayOfWeek: range.dayOfWeek,
      startTime: range.startTime,
      endTime: range.endTime,
      start,
      end,
    });
  }

  for (let index = 0; index < normalizedHours.length; index += 1) {
    for (let other = index + 1; other < normalizedHours.length; other += 1) {
      const current = normalizedHours[index];
      const next = normalizedHours[other];
      if (
        current.dayOfWeek === next.dayOfWeek &&
        overlaps(current.start, current.end, next.start, next.end)
      ) {
        return { error: "Working ranges cannot overlap." };
      }
    }
  }

  const normalizedBreaks = [];
  for (const range of breaks) {
    const start = timeToMinutes(range?.startTime);
    const end = timeToMinutes(range?.endTime);
    const inWorkingRange = normalizedHours.some(
      (hours) =>
        hours.dayOfWeek === range?.dayOfWeek &&
        start !== null &&
        end !== null &&
        hours.start <= start &&
        end <= hours.end
    );
    if (
      !Number.isInteger(range?.dayOfWeek) ||
      range.dayOfWeek < 0 ||
      range.dayOfWeek > 6 ||
      start === null ||
      end === null ||
      start >= end ||
      !inWorkingRange
    ) {
      return { error: "Each break must fit inside a working range on the same weekday." };
    }
    normalizedBreaks.push({
      dayOfWeek: range.dayOfWeek,
      startTime: range.startTime,
      endTime: range.endTime,
      start,
      end,
    });
  }

  for (let index = 0; index < normalizedBreaks.length; index += 1) {
    for (let other = index + 1; other < normalizedBreaks.length; other += 1) {
      const current = normalizedBreaks[index];
      const next = normalizedBreaks[other];
      if (
        current.dayOfWeek === next.dayOfWeek &&
        overlaps(current.start, current.end, next.start, next.end)
      ) {
        return { error: "Break periods cannot overlap." };
      }
    }
  }

  if (
    blockedDates.some((date) => !isValidDate(date)) ||
    new Set(blockedDates).size !== blockedDates.length
  ) {
    return { error: "Blocked dates must be unique valid calendar dates." };
  }

  const normalizedUnavailablePeriods = [];
  for (const period of unavailablePeriods) {
    const start = timeToMinutes(period?.startTime);
    const end = timeToMinutes(period?.endTime);
    if (
      !isValidDate(period?.date) ||
      start === null ||
      end === null ||
      start >= end
    ) {
      return { error: "Unavailable periods require a valid date and start/end time." };
    }
    normalizedUnavailablePeriods.push({
      date: period.date,
      startTime: period.startTime,
      endTime: period.endTime,
      start,
      end,
    });
  }

  for (let index = 0; index < normalizedUnavailablePeriods.length; index += 1) {
    for (let other = index + 1; other < normalizedUnavailablePeriods.length; other += 1) {
      const current = normalizedUnavailablePeriods[index];
      const next = normalizedUnavailablePeriods[other];
      if (
        current.date === next.date &&
        overlaps(current.start, current.end, next.start, next.end)
      ) {
        return { error: "Unavailable periods cannot overlap." };
      }
    }
  }

  return {
    value: {
      slotDurationMinutes,
      workingHours: normalizedHours.map(({ dayOfWeek, startTime, endTime }) => ({
        dayOfWeek,
        startTime,
        endTime,
      })),
      breaks: normalizedBreaks.map(({ dayOfWeek, startTime, endTime }) => ({
        dayOfWeek,
        startTime,
        endTime,
      })),
      blockedDates: [...blockedDates],
      unavailablePeriods: normalizedUnavailablePeriods.map(
        ({ date, startTime, endTime }) => ({ date, startTime, endTime })
      ),
    },
  };
}

function formatTime(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getBookableSlots(availability, date, occupiedTimes = [], now = new Date()) {
  if (!isValidDate(date) || !availability) return [];
  if ((availability.blockedDates ?? []).includes(date)) return [];

  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  if (date < today) return [];

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const occupied = new Set(occupiedTimes);
  const unavailablePeriods = (availability.unavailablePeriods ?? [])
    .filter((period) => period.date === date)
    .map((period) => ({
      start: timeToMinutes(period.startTime),
      end: timeToMinutes(period.endTime),
    }));
  const breaks = (availability.breaks ?? [])
    .filter((period) => period.dayOfWeek === weekday)
    .map((period) => ({
      start: timeToMinutes(period.startTime),
      end: timeToMinutes(period.endTime),
    }));
  const duration = availability.slotDurationMinutes ?? DEFAULT_SLOT_DURATION_MINUTES;
  const cutoff =
    date === today
      ? now.getHours() * 60 + now.getMinutes()
      : -1;
  const slots = [];

  for (const range of availability.workingHours ?? []) {
    if (range.dayOfWeek !== weekday) continue;
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
      const slotEnd = slotStart + duration;
      const isUnavailable = [...breaks, ...unavailablePeriods].some((period) =>
        overlaps(slotStart, slotEnd, period.start, period.end)
      );
      const label = formatTime(slotStart);
      if (!isUnavailable && slotStart > cutoff && !occupied.has(label)) {
        slots.push(label);
      }
    }
  }

  return slots.sort((left, right) => timeToMinutes12(left) - timeToMinutes12(right));
}

function timeToMinutes12(value) {
  const match = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]) % 12;
  if (match[3] === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

module.exports = {
  DEFAULT_SLOT_DURATION_MINUTES,
  getBookableSlots,
  isValidDate,
  normalizeSlotTime,
  timeToMinutes,
  validateAvailability,
};
