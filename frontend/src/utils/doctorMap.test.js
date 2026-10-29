import test from "node:test";
import assert from "node:assert/strict";
import {
  getDoctorMapMessage,
  getDoctorMapViewport,
  getVerifiedDoctorMapCandidates,
} from "./doctorMap.js";

const eligibleDoctor = {
  _id: "doctor-1",
  approvalStatus: "approved",
  isActive: true,
  isAvailable: true,
  locationVerified: true,
  latitude: 40.7484,
  longitude: -73.9857,
};

test("map candidates include only verified approved active available doctors with valid coordinates", () => {
  const doctors = [
    eligibleDoctor,
    { ...eligibleDoctor, _id: "unverified", locationVerified: false },
    { ...eligibleDoctor, _id: "missing-verification", locationVerified: undefined },
    { ...eligibleDoctor, _id: "pending", approvalStatus: "pending" },
    { ...eligibleDoctor, _id: "inactive", isActive: false },
    { ...eligibleDoctor, _id: "unavailable", isAvailable: false },
    { ...eligibleDoctor, _id: "latitude-out-of-range", latitude: 91 },
    { ...eligibleDoctor, _id: "longitude-out-of-range", longitude: -181 },
    { ...eligibleDoctor, _id: "missing-latitude", latitude: undefined },
    { ...eligibleDoctor, _id: "string-coordinates", latitude: "40.7484" },
  ];

  assert.deepEqual(getVerifiedDoctorMapCandidates(doctors), [eligibleDoctor]);
});

test("map candidates safely reject missing or malformed doctor lists", () => {
  assert.deepEqual(getVerifiedDoctorMapCandidates(null), []);
  assert.deepEqual(getVerifiedDoctorMapCandidates({}), []);
});

test("API latitude and longitude fields are consumed as Leaflet latitude-longitude positions", () => {
  const apiDoctor = {
    ...eligibleDoctor,
    latitude: 40.7484,
    longitude: -73.9857,
  };

  assert.deepEqual(
    getDoctorMapViewport([apiDoctor]),
    { kind: "single", center: [40.7484, -73.9857], zoom: 13 }
  );
});

test("one marker uses neighborhood zoom and multiple markers request bounds fitting", () => {
  const secondDoctor = {
    ...eligibleDoctor,
    _id: "doctor-2",
    latitude: 19.076,
    longitude: 72.8777,
  };

  assert.deepEqual(getDoctorMapViewport([eligibleDoctor]), {
    kind: "single",
    center: [40.7484, -73.9857],
    zoom: 13,
  });
  assert.deepEqual(getDoctorMapViewport([eligibleDoctor, secondDoctor]), {
    kind: "bounds",
    points: [[40.7484, -73.9857], [19.076, 72.8777]],
  });
  assert.deepEqual(getDoctorMapViewport([]), {
    kind: "default",
    center: [22.5, 79],
    zoom: 5,
  });
});

test("map messages distinguish no matching doctors from results without verified locations", () => {
  assert.equal(getDoctorMapMessage(0, 0), "No doctors matched this search.");
  assert.match(getDoctorMapMessage(2, 0), /verified by an Admin or Root Owner/);
  assert.equal(getDoctorMapMessage(2, 1), "");
});
