const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const userRoutes = require("../routes/user");
const {
  handleGeocodeClinicLocation,
  handleReverseGeocodeLocation,
} = require("../controllers/user");
const {
  buildClinicSearchQueries,
  nominatimClient,
  createNominatimClient,
  normalizeAddressText,
  parseClinicAddress,
} = require("../utils/nominatim");
const { buildProfileUpdate } = require("../utils/profileUpdate");

test("full address exact building result is classified and cached", async () => {
  let fetchCount = 0;
  const requestedUrls = [];
  let requestedOptions;
  const client = createNominatimClient({
    fetchImpl: async (url, options) => {
      fetchCount += 1;
      requestedUrls.push(new URL(url));
      requestedOptions = options;
      return {
        ok: true,
        async json() {
          return [{
            display_name: "Clinic Road 12, Pune",
            lat: "18.5204",
            lon: "73.8567",
            type: "clinic",
            name: "Clinic 12",
            address: {
              house_number: "12",
              building: "Clinic 12",
              road: "Clinic Road",
              suburb: "Kothrud",
              city: "Pune",
              state: "Maharashtra",
              postcode: "411038",
            },
          }];
        },
      };
    },
    minIntervalMs: 0,
  });

  const result = await client.geocodeAddress("  Clinic 12,   Clinic Road, Kothrud, Pune, Maharashtra 411038 ");
  const cachedResult = await client.geocodeAddress("Clinic 12, Clinic Road, Kothrud, Pune, Maharashtra 411038");

  assert.deepEqual(result, {
    displayName: "Clinic Road 12, Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    classification: "exact",
    candidates: [{
      displayName: "Clinic Road 12, Pune",
      latitude: 18.5204,
      longitude: 73.8567,
      classification: "exact",
    }],
  });
  assert.equal(cachedResult.classification, "exact");
  assert.equal(fetchCount, 1);
  assert.equal(requestedUrls[0].pathname, "/search");
  assert.equal(requestedUrls[0].searchParams.get("limit"), "5");
  assert.equal(requestedUrls[0].searchParams.get("q"), "Clinic 12, Clinic Road, Kothrud, Pune, Maharashtra 411038");
  assert.equal(requestedUrls[0].searchParams.get("countrycodes"), "in");
  assert.match(requestedOptions.headers["User-Agent"], /Healthcare-app/);

  const update = buildProfileUpdate(
    {
      clinicLocation: "Clinic Road, Pune",
      clinicLatitude: result.latitude,
      clinicLongitude: result.longitude,
    },
    { _id: "user", role: "doctor" },
    {
      clinicLocation: "Old address",
      location: { type: "Point", coordinates: [73.8, 18.5] },
      locationVerified: true,
      approvalStatus: "approved",
      isActive: true,
    }
  );
  assert.deepEqual(update.doctorUpdate.$set.location, {
    type: "Point",
    coordinates: [73.8567, 18.5204],
  });
  assert.equal(update.doctorUpdate.$set.locationVerified, false);
});

test("targeted fallback queries identify a supported locality as approximate", async () => {
  const requestedQueries = [];
  const client = createNominatimClient({
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      requestedQueries.push(requestUrl.searchParams.get("q"));
      assert.equal(requestUrl.searchParams.get("countrycodes"), "in");
      return {
        ok: true,
        async json() {
          if (requestedQueries.length <= 2) return [];
          return [{
                display_name: "Borivali West, Mumbai, Maharashtra",
            lat: "19.2307",
                lon: "72.8362",
            type: "suburb",
            address: {
                  suburb: "Borivali West",
                  city: "Mumbai",
              state: "Maharashtra",
                  postcode: "400092",
            },
          }];
        },
      };
    },
    minIntervalMs: 0,
  });

  assert.deepEqual(
    await client.geocodeAddress(
      "Goyal Shopping Arcade, LT Rd, Kothrud, Borivali West, Mumbai, Maharashtra 400092"
    ),
    {
      displayName: "Borivali West, Mumbai, Maharashtra",
      latitude: 19.2307,
      longitude: 72.8362,
      classification: "approximate",
      candidates: [{
        displayName: "Borivali West, Mumbai, Maharashtra",
        latitude: 19.2307,
        longitude: 72.8362,
        classification: "approximate",
      }],
    }
  );
  assert.deepEqual(requestedQueries, [
  "Goyal Shopping Arcade, LT Road, Kothrud, Borivali West, Mumbai, Maharashtra 400092",
  "Goyal Shopping Arcade, LT Road, Kothrud, Borivali West",
  "LT Road, Kothrud, Borivali West, 400092",
  "Kothrud, Borivali West, Mumbai, Maharashtra",
  ]);
});

test("address parsing normalizes abbreviations and constructs the intended fallback searches", () => {
  const address = "Goyal Shopping Arcade, LT Rd, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092";
  assert.deepEqual(parseClinicAddress(address), {
    original: address,
    searchAddress: "Goyal Shopping Arcade, LT Road, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092",
    normalized: "goyal shopping arcade lt road sundar nagar borivali west mumbai maharashtra 400092",
    building: "Goyal Shopping Arcade",
    road: "LT Road",
    locality: "Sundar Nagar, Borivali West",
    localityParts: ["Sundar Nagar", "Borivali West"],
    city: "Mumbai",
    state: "Maharashtra",
    pinCode: "400092",
  });
  assert.deepEqual(
    buildClinicSearchQueries(address).map(({ kind, query }) => [kind, query]),
    [
      ["full", "Goyal Shopping Arcade, LT Road, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092"],
      ["building-road-locality", "Goyal Shopping Arcade, LT Road, Sundar Nagar, Borivali West"],
      ["road-locality-pin", "LT Road, Sundar Nagar, Borivali West, 400092"],
      ["locality-city-state", "Sundar Nagar, Borivali West, Mumbai, Maharashtra"],
    ]
  );
  assert.equal(normalizeAddressText("L.T. Road"), "lt road");
});

test("facility type alone does not qualify as an exact building match", async () => {
  const client = createNominatimClient({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [{
          display_name: "Clinic Road, Pune",
          lat: "18.52",
          lon: "73.85",
          type: "clinic",
          address: { road: "Clinic Road", city: "Pune" },
        }];
      },
    }),
    minIntervalMs: 0,
  });
  assert.equal(
    await client.geocodeAddress("Named Clinic, Clinic Road, Kothrud, Pune, Maharashtra 411038"),
    null
  );
});

test("city-only results are not accepted as approximate clinic locations", async () => {
  let fetchCount = 0;
  const client = createNominatimClient({
    fetchImpl: async () => {
      fetchCount += 1;
      return {
        ok: true,
        async json() {
          return [{
            display_name: "Mumbai, Maharashtra",
            lat: "19.076",
            lon: "72.8777",
            type: "city",
            address: { city: "Mumbai", state: "Maharashtra" },
          }];
        },
      };
    },
    minIntervalMs: 0,
  });

  const result = await client.geocodeAddress(
    "Goyal Shopping Arcade, LT Rd, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092"
  );
  assert.equal(result, null);
  assert.equal(fetchCount, 4);
});

test("conflicting PINs and misleading similarly named buildings are rejected", async () => {
  const client = createNominatimClient({
    fetchImpl: async (url) => ({
      ok: true,
      async json() {
        if (new URL(url).searchParams.get("limit") !== "5") return [];
        return [{
          display_name: "Goyal Shopping Arcade, Andheri East, Mumbai, Maharashtra 400069",
          name: "Goyal Shopping Arcade",
          lat: "19.1136",
          lon: "72.8697",
          type: "commercial",
          address: {
            commercial: "Goyal Shopping Arcade",
            road: "Andheri Kurla Road",
            suburb: "Andheri East",
            city: "Mumbai",
            state: "Maharashtra",
            postcode: "400069",
          },
        }];
      },
    }),
    minIntervalMs: 0,
  });

  assert.equal(
    await client.geocodeAddress(
      "Goyal Shopping Arcade, LT Rd, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092"
    ),
    null
  );
});

test("multiple equally supported building candidates remain choices, not a guessed exact pin", async () => {
  const client = createNominatimClient({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [
          {
            display_name: "Clinic 12, Clinic Road, Kothrud, Pune, Maharashtra 411038",
            name: "Clinic 12",
            lat: "18.5204",
            lon: "73.8567",
            type: "commercial",
            address: {
              building: "Clinic 12",
              road: "Clinic Road",
              suburb: "Kothrud",
              city: "Pune",
              state: "Maharashtra",
              postcode: "411038",
            },
          },
          {
            display_name: "Clinic 12, Clinic Road, Kothrud, Pune, Maharashtra 411038",
            name: "Clinic 12",
            lat: "18.521",
            lon: "73.857",
            type: "commercial",
            address: {
              building: "Clinic 12",
              road: "Clinic Road",
              suburb: "Kothrud",
              city: "Pune",
              state: "Maharashtra",
              postcode: "411038",
            },
          },
        ];
      },
    }),
    minIntervalMs: 0,
  });

  const result = await client.geocodeAddress(
    "Clinic 12, Clinic Road, Kothrud, Pune, Maharashtra 411038"
  );
  assert.equal(result.classification, "none");
  assert.equal(result.candidates.length, 2);
});

test("Nominatim HTTP failures are errors and invalid coordinates are never returned", async () => {
  const failedClient = createNominatimClient({
    fetchImpl: async () => ({ ok: false, status: 503 }),
    minIntervalMs: 0,
  });
  await assert.rejects(failedClient.geocodeAddress("Clinic Road"), /HTTP 503/);

  const invalidClient = createNominatimClient({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [{ display_name: "Clinic Road", lat: "91", lon: "73" }];
      },
    }),
    minIntervalMs: 0,
  });
  assert.equal(await invalidClient.geocodeAddress("Clinic Road, Pune"), null);
});

test("an aborted stale lookup does not send its queued Nominatim request", async () => {
  let clock = 0;
  const requestedQueries = [];
  const client = createNominatimClient({
    now: () => clock,
    wait: async (milliseconds) => { clock += milliseconds; },
    fetchImpl: async (url) => {
      requestedQueries.push(new URL(url).searchParams.get("q"));
      return {
        ok: true,
        async json() {
          return [{
            display_name: "Clinic, Pune",
            lat: "18",
            lon: "73",
            type: "clinic",
            address: { amenity: "clinic" },
          }];
        },
      };
    },
  });

  await client.geocodeAddress("First Clinic, Pune");
  const controller = new AbortController();
  const staleLookup = client.geocodeAddress("Stale Clinic, Pune", { signal: controller.signal });
  controller.abort();
  await assert.rejects(staleLookup, { name: "AbortError" });
  assert.deepEqual(requestedQueries, ["First Clinic, Pune", "First Clinic"]);
});

test("distinct Nominatim requests are serialized at the configured interval", async () => {
  let clock = 0;
  const requestTimes = [];
  const client = createNominatimClient({
    now: () => clock,
    wait: async (milliseconds) => { clock += milliseconds; },
    fetchImpl: async () => {
      requestTimes.push(clock);
      return {
        ok: true,
        async json() {
          return [{ display_name: "A clinic", lat: "18", lon: "73" }];
        },
      };
    },
  });

  await Promise.all([
    client.geocodeAddress("Clinic Road A"),
    client.geocodeAddress("Clinic Road B"),
  ]);
  assert.deepEqual(requestTimes, [0, 1000]);
});

test("clinic geocoding requires an eligible doctor profile and distinguishes no matches", async (t) => {
  const route = userRoutes.stack.find(
    (layer) => layer.route?.path === "/clinic-location/geocode"
  );
  assert.ok(route);
  assert.equal(route.route.methods.post, true);
  assert.equal(route.route.stack[0].name, "restrictToLoggedinUserOnly");
  assert.equal(route.route.stack[route.route.stack.length - 1].handle, handleGeocodeClinicLocation);

  t.mock.method(User, "findById", () => ({
    select() { return this; },
    async lean() { return { _id: "user-id", email: "doctor@example.test", role: "doctor", accountStatus: "active" }; },
  }));
  t.mock.method(Doctor, "findOne", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return { approvalStatus: "approved", isActive: true }; },
  }));
  t.mock.method(nominatimClient, "geocodeAddress", async () => null);

  const response = createResponse();
  await handleGeocodeClinicLocation(
    { user: { _id: "user-id" }, body: { address: "Unlisted Clinic Road" } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.classification, "none");
  assert.equal(response.body.location, null);
  assert.match(response.body.message, /No reliable clinic or locality match/);
});

test("location lookup errors return clear failure responses", async (t) => {
  t.mock.method(nominatimClient, "reverseGeocode", async () => {
    throw new Error("upstream unavailable");
  });
  const response = createResponse();
  await handleReverseGeocodeLocation(
    { body: { latitude: 19.076, longitude: 72.8777 } },
    response
  );

  assert.equal(response.statusCode, 502);
  assert.match(response.body.error, /temporarily unavailable/);
});

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
