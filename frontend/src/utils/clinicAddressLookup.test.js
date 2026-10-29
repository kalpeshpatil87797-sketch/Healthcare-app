import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConfirmedClinicLocation,
  createClinicAddressLookup,
} from "./clinicAddressLookup.js";

test("clinic address validation is debounced and only checks the latest paused input", async () => {
  const timers = new Map();
  const lookupCalls = [];
  const states = [];
  let nextTimerId = 0;
  const lookup = createClinicAddressLookup({
    lookup: async (address) => {
      lookupCalls.push(address);
      return { displayName: `${address} locality`, latitude: 18, longitude: 73, classification: "approximate" };
    },
    onChange: (state) => states.push(state),
    delayMs: 850,
    setTimer: (callback, delay) => {
      assert.equal(delay, 850);
      const id = ++nextTimerId;
      timers.set(id, () => {
        timers.delete(id);
        callback();
      });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });

  lookup.schedule("Clinic Road");
  lookup.schedule("Clinic Road, Pune");
  assert.equal(timers.size, 1);
  assert.deepEqual(lookupCalls, []);
  [...timers.values()][0]();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(lookupCalls, ["Clinic Road, Pune"]);
  assert.equal(states.at(-1).status, "matched");
  lookup.cancel();
});

test("stale address results are aborted and ignored when the input changes", async () => {
  const timers = new Map();
  const states = [];
  const pending = [];
  let nextTimerId = 0;
  const lookup = createClinicAddressLookup({
    lookup: (address, { signal }) => new Promise((resolve) => {
      pending.push({ address, signal, resolve });
    }),
    onChange: (state) => states.push(state),
    delayMs: 1,
    setTimer: (callback) => {
      const id = ++nextTimerId;
      timers.set(id, () => {
        timers.delete(id);
        callback();
      });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });

  lookup.schedule("Old Address");
  [...timers.values()][0]();
  lookup.schedule("New Address");
  assert.equal(pending[0].signal.aborted, true);
  [...timers.values()][0]();
  pending[0].resolve({ displayName: "Stale", latitude: 1, longitude: 2, classification: "approximate" });
  pending[1].resolve({ displayName: "Current", latitude: 3, longitude: 4, classification: "approximate" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(states.some((state) => state.location?.displayName === "Stale"), false);
  assert.equal(states.at(-1).location.displayName, "Current");
  lookup.cancel();
});

test("a geocoding match is staged only after explicit confirmation", () => {
  const existingForm = { clinicLocation: "Kothrud, Pune", clinicLatitude: "", clinicLongitude: "" };
  const matchedLocation = {
    displayName: "Resolved clinic area",
    latitude: 18.5074,
    longitude: 73.8077,
    classification: "approximate",
  };

  assert.deepEqual(existingForm, {
    clinicLocation: "Kothrud, Pune",
    clinicLatitude: "",
    clinicLongitude: "",
  });
  assert.deepEqual(applyConfirmedClinicLocation(existingForm, matchedLocation), {
    clinicLocation: "Resolved clinic area",
    clinicLatitude: "18.5074",
    clinicLongitude: "73.8077",
  });
  assert.equal(applyConfirmedClinicLocation(existingForm, null), existingForm);
});
