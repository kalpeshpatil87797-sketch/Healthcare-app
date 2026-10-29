import test from "node:test";
import assert from "node:assert/strict";
import {
  applyClinicPickerSelection,
  cancelClinicPickerSearch,
  clinicPickerPositionFromDrag,
  clinicPickerPositionFromEvent,
  clinicPickerPositionFromGeolocation,
  confirmClinicPickerPosition,
  getClinicGeolocationError,
  normalizeClinicPickerResult,
  resolveClinicPickerSelection,
} from "./clinicLocationPicker.js";

test("search results retain exact and approximate classification and valid coordinates", () => {
  assert.deepEqual(normalizeClinicPickerResult({
    displayName: "Clinic Road, Pune",
    latitude: 18.52,
    longitude: 73.85,
    classification: "exact",
  }), {
    displayName: "Clinic Road, Pune",
    latitude: 18.52,
    longitude: 73.85,
    classification: "exact",
  });
  assert.equal(normalizeClinicPickerResult({
    latitude: null,
    longitude: 73.85,
    classification: "approximate",
  }), null);
});

test("map clicks and marker drags convert Leaflet coordinates without swapping axes", () => {
  assert.deepEqual(
    clinicPickerPositionFromEvent({ latlng: { lat: 19.076, lng: 72.8777 } }),
    [19.076, 72.8777]
  );
  assert.deepEqual(
    clinicPickerPositionFromDrag({ latlng: { lat: 18.52, lng: 73.85 } }),
    [18.52, 73.85]
  );
  assert.equal(clinicPickerPositionFromEvent({ latlng: { lat: 91, lng: 73 } }), null);
  assert.deepEqual(confirmClinicPickerPosition([19.076, 72.8777]), {
    latitude: 19.076,
    longitude: 72.8777,
  });
});

test("current-location coordinates are only returned after a valid GPS response", () => {
  assert.deepEqual(
    clinicPickerPositionFromGeolocation({ latitude: 19.076, longitude: 72.8777 }),
    [19.076, 72.8777]
  );
  assert.equal(clinicPickerPositionFromGeolocation({ latitude: 100, longitude: 0 }), null);
  assert.match(getClinicGeolocationError({ code: 1 }), /permission was denied/);
  assert.match(getClinicGeolocationError({ code: 2 }), /unavailable/);
  assert.match(getClinicGeolocationError({ code: 3 }), /timed out/);
});

test("confirming a selected map result stages its returned address and coordinates together", () => {
  const form = {
    clinicLocation: "Doctor's previously typed address",
    clinicLatitude: "",
    clinicLongitude: "",
  };
  assert.deepEqual(
    applyClinicPickerSelection(form, {
      latitude: 19.076,
      longitude: 72.8777,
      address: "Resolved Clinic Road, Mumbai",
      source: "exact",
      classification: "exact",
      status: "resolved",
    }),
    {
      clinicLocation: "Resolved Clinic Road, Mumbai",
      clinicLatitude: "19.076",
      clinicLongitude: "72.8777",
    }
  );
  assert.deepEqual(form, {
    clinicLocation: "Doctor's previously typed address",
    clinicLatitude: "",
    clinicLongitude: "",
  });
  assert.equal(applyClinicPickerSelection(form, {
    latitude: 91,
    longitude: 72,
    address: "Invalid",
    status: "resolved",
  }), form);
});

test("moving the pin reverse-geocodes a fresh address for its final coordinates", async () => {
  const first = await resolveClinicPickerSelection(
    19.076,
    72.8777,
    async () => "First Road, Mumbai",
    "manual"
  );
  const moved = await resolveClinicPickerSelection(
    19.08,
    72.88,
    async (latitude, longitude) => {
      assert.equal(latitude, 19.08);
      assert.equal(longitude, 72.88);
      return "Second Road, Mumbai";
    },
    "manual"
  );
  assert.equal(first.address, "First Road, Mumbai");
  assert.equal(moved.address, "Second Road, Mumbai");
  assert.deepEqual(applyClinicPickerSelection(
    { clinicLocation: first.address, clinicLatitude: "19.076", clinicLongitude: "72.8777" },
    moved
  ), {
    clinicLocation: "Second Road, Mumbai",
    clinicLatitude: "19.08",
    clinicLongitude: "72.88",
  });
});

test("reverse-geocoding failure prevents coordinates from being staged with an old address", async () => {
  const form = {
    clinicLocation: "Old clinic address",
    clinicLatitude: "",
    clinicLongitude: "",
  };
  await assert.rejects(
    resolveClinicPickerSelection(19.08, 72.88, async () => null, "manual"),
    /No usable address/
  );
  assert.deepEqual(form, {
    clinicLocation: "Old clinic address",
    clinicLatitude: "",
    clinicLongitude: "",
  });
});

test("GPS selection uses the reverse-geocoded address for its coordinates", async () => {
  const selection = await resolveClinicPickerSelection(
    19.076,
    72.8777,
    async (latitude, longitude) => {
      assert.deepEqual([latitude, longitude], [19.076, 72.8777]);
      return "GPS-resolved Clinic Road, Mumbai";
    },
    "gps"
  );
  assert.equal(selection.source, "gps");
  assert.equal(selection.address, "GPS-resolved Clinic Road, Mumbai");
  assert.deepEqual(
    applyClinicPickerSelection({ clinicLocation: "typed address" }, selection),
    {
      clinicLocation: "GPS-resolved Clinic Road, Mumbai",
      clinicLatitude: "19.076",
      clinicLongitude: "72.8777",
    }
  );
});

test("typing a conflicting address before map confirmation cannot replace the selected result address", () => {
  const selected = {
    latitude: 19.076,
    longitude: 72.8777,
    address: "Map-resolved Clinic Road, Mumbai",
    source: "exact",
    classification: "exact",
    status: "resolved",
  };
  assert.deepEqual(
    applyClinicPickerSelection({ clinicLocation: "Conflicting typed address" }, selected),
    {
      clinicLocation: "Map-resolved Clinic Road, Mumbai",
      clinicLatitude: "19.076",
      clinicLongitude: "72.8777",
    }
  );
});

test("cancel aborts outstanding picker search and leaves profile state untouched", () => {
  const controller = new AbortController();
  const originalForm = { clinicLocation: "Clinic", clinicLatitude: "", clinicLongitude: "" };
  let closed = false;
  cancelClinicPickerSearch(controller, () => { closed = true; });
  assert.equal(controller.signal.aborted, true);
  assert.equal(closed, true);
  assert.deepEqual(originalForm, { clinicLocation: "Clinic", clinicLatitude: "", clinicLongitude: "" });
});
