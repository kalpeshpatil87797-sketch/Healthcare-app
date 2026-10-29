const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const REQUEST_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const LOCALITY_TYPES = new Set([
  "borough",
  "city",
  "county",
  "district",
  "municipality",
  "neighbourhood",
  "quarter",
  "suburb",
  "town",
  "village",
]);

function isValidCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
}

function normalizeAddressText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b([a-z])\s+([a-z])\s+(?=(?:road|street|lane|marg|avenue|boulevard|highway)\b)/gi, "$1$2 ")
    .replace(/\b(?:rd)\b/gi, "road")
    .replace(/\b(?:st)\b/gi, "street")
    .replace(/\b(?:ave)\b/gi, "avenue")
    .replace(/\b(?:blvd)\b/gi, "boulevard")
    .replace(/\b(?:pincode|pin\s+code)\b/gi, " ")
    .replace(/\bindia\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function phraseMatches(expected, actualValues) {
  if (!expected) return false;
  const expectedText = normalizeAddressText(expected);
  if (!expectedText) return false;
  const expectedWords = expectedText.split(" ").filter(Boolean);
  return actualValues.some((value) => {
    const actualText = normalizeAddressText(value);
    if (!actualText) return false;
    return actualText.includes(expectedText) ||
      expectedWords.every((word) => actualText.split(" ").includes(word));
  });
}

function parseClinicAddress(address) {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^india$/i.test(part))
    .map((part) =>
      part
        .replace(/\bpin\s*code\s*[:#-]?\s*(?=\d)/i, "")
        .replace(/\brd\b/gi, "Road")
        .replace(/\s+/g, " ")
        .trim()
    );
  const pinCode = address.match(/\b\d{6}\b/)?.[0] ?? "";
  const pinPartIndex = parts.findIndex((part) => /\b\d{6}\b/.test(part));
  const knownStateIndex = parts.findIndex((part) => /\b(?:maharashtra|gujarat|karnataka|delhi|tamil nadu|kerala|telangana|andhra pradesh|west bengal|rajasthan|uttar pradesh|madhya pradesh|punjab|haryana|goa|bihar|odisha|assam)\b/i.test(part));
  const stateIndex = pinPartIndex > 0 ? pinPartIndex : knownStateIndex;
  const state = stateIndex >= 0
    ? parts[stateIndex].replace(/\b\d{6}\b/g, "").trim()
    : "";
  const cityIndex = stateIndex > 0 ? stateIndex - 1 : Math.max(0, parts.length - (pinCode ? 2 : 1));
  const city = parts[cityIndex] && cityIndex > 0 ? parts[cityIndex] : "";
  const roadIndex = parts.findIndex((part) => /\b(?:road|rd|street|st|lane|marg|avenue|ave|boulevard|blvd|highway|cross)\b/i.test(part));
  const building = parts[0] && roadIndex > 0 ? parts[0] : "";
  const road = roadIndex >= 0 ? parts[roadIndex] : "";
  const localityParts = parts.filter((part, index) =>
    index > roadIndex &&
    index < cityIndex &&
    !/\b\d{6}\b/.test(part)
  );
  const locality = localityParts.join(", ");

  return {
    original: address,
    searchAddress: parts.join(", "),
    normalized: normalizeAddressText(address),
    building,
    road,
    locality,
    localityParts,
    city,
    state,
    pinCode,
  };
}

function buildClinicSearchQueries(address) {
  const parsed = parseClinicAddress(address);
  const queries = [
    { kind: "full", query: parsed.searchAddress },
    {
      kind: "building-road-locality",
      query: [parsed.building, parsed.road, parsed.locality].filter(Boolean).join(", "),
    },
    {
      kind: "road-locality-pin",
      query: [parsed.road, parsed.locality, parsed.pinCode].filter(Boolean).join(", "),
    },
    {
      kind: "locality-city-state",
      query: [parsed.locality, parsed.city, parsed.state].filter(Boolean).join(", "),
    },
  ];
  const seen = new Set();
  return queries.filter(({ query }) => {
    const normalized = normalizeAddressText(query);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function getCandidateEvidence(result, parsed) {
  const address = result.address ?? {};
  const values = Object.values(address).filter((value) => typeof value === "string");
  const names = [
    result.name,
    address.building,
    address.commercial,
    address.retail,
    address.amenity,
    address.shop,
  ].filter((value) => typeof value === "string");
  const roads = [
    address.road,
    address.pedestrian,
    address.footway,
    address.residential,
    address.highway,
  ].filter(Boolean);
  const localities = [
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.city_district,
    address.district,
    address.borough,
    address.county,
  ].filter(Boolean);
  const candidateCity = [
    address.city,
    address.municipality,
    address.town,
    address.village,
  ].filter(Boolean);
  const candidateState = [address.state, address.state_district].filter(Boolean);
  const candidatePin = String(address.postcode ?? "").match(/\b\d{6}\b/)?.[0] ?? "";
  const buildingMatch = phraseMatches(parsed.building, names);
  const roadMatch = phraseMatches(parsed.road, [...roads, result.display_name]);
  const localityMatch = parsed.localityParts.some((part) =>
    phraseMatches(part, [...localities, result.name, result.display_name])
  );
  const cityMatch = parsed.city
    ? phraseMatches(parsed.city, [...candidateCity, result.display_name])
    : false;
  const stateMatch = parsed.state
    ? phraseMatches(parsed.state, [...candidateState, result.display_name])
    : false;
  const pinMatch = Boolean(parsed.pinCode && candidatePin === parsed.pinCode);
  const pinConflict = Boolean(parsed.pinCode && candidatePin && candidatePin !== parsed.pinCode);
  const cityConflict = Boolean(
    parsed.city && candidateCity.length > 0 && !cityMatch
  );
  const stateConflict = Boolean(
    parsed.state && candidateState.length > 0 && !stateMatch
  );
  const localityType = LOCALITY_TYPES.has(result.type);
  const exactContextMatch = parsed.road
    ? roadMatch && (localityMatch || cityMatch || pinMatch)
    : localityMatch && (cityMatch || pinMatch);
  const exact = buildingMatch &&
    exactContextMatch &&
    !pinConflict &&
    !cityConflict &&
    !stateConflict;
  const approximate = !pinConflict &&
    !cityConflict &&
    !stateConflict &&
    localityType &&
    localityMatch &&
    (roadMatch || cityMatch || stateMatch || pinMatch);

  return {
    classification: exact ? "exact" : approximate ? "approximate" : "none",
    evidenceCount: [buildingMatch, roadMatch, localityMatch, cityMatch, stateMatch, pinMatch]
      .filter(Boolean).length,
  };
}

function createNominatimClient({
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.NOMINATIM_BASE_URL || DEFAULT_BASE_URL,
  userAgent = process.env.NOMINATIM_USER_AGENT || "Healthcare-app/1.0",
  minIntervalMs = REQUEST_INTERVAL_MS,
  cacheTtlMs = CACHE_TTL_MS,
  now = Date.now,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Nominatim requires a fetch implementation.");
  }
  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new Error("Nominatim must use HTTPS.");
  }

  const cache = new Map();
  let nextRequestAt = 0;
  let requestQueue = Promise.resolve();

  function readCache(key) {
    const cached = cache.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= now()) {
      cache.delete(key);
      return undefined;
    }
    return cached.value;
  }

  function writeCache(key, value) {
    for (const [cacheKey, entry] of cache) {
      if (entry.expiresAt <= now()) cache.delete(cacheKey);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, { value, expiresAt: now() + cacheTtlMs });
  }

  function request(url, cacheKey, signal) {
    const cached = readCache(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached);

    const pending = requestQueue.then(async () => {
      if (signal?.aborted) {
        const error = new Error("Location lookup was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      const cachedAfterQueue = readCache(cacheKey);
      if (cachedAfterQueue !== undefined) return cachedAfterQueue;

      const delay = Math.max(0, nextRequestAt - now());
      if (delay > 0) await wait(delay);
      if (signal?.aborted) {
        const error = new Error("Location lookup was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      nextRequestAt = now() + minIntervalMs;

      const requestController = new AbortController();
      const timeout = setTimeout(() => requestController.abort(), 10000);
      const abortRequest = () => requestController.abort();
      signal?.addEventListener("abort", abortRequest, { once: true });
      if (signal?.aborted) abortRequest();
      let response;
      try {
        response = await fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": userAgent,
          },
          signal: requestController.signal,
        });
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortRequest);
      }
      if (!response.ok) {
        const error = new Error(`Nominatim responded with HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      if (data !== undefined && data !== null) {
        writeCache(cacheKey, data);
      }
      return data;
    });
    requestQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  function buildSearchUrl(query, limit) {
    const url = new URL("/search", endpoint);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("q", query);
    url.searchParams.set("countrycodes", "in");
    return url;
  }

  function hasValidResult(result) {
    return Boolean(
      typeof result?.display_name === "string" &&
      result.display_name.trim() &&
      isValidCoordinates(Number(result.lat), Number(result.lon))
    );
  }

  async function search(query, limit, signal) {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");
    const url = buildSearchUrl(normalizedQuery, limit);
    const results = await request(
      url,
      `forward:${limit}:${normalizedQuery.toLowerCase()}`,
      signal
    );
    if (!results) return [];
    return Array.isArray(results) ? results : [results];
  }

  async function geocodeAddress(address, { signal } = {}) {
    const parsedAddress = parseClinicAddress(address.trim());
    const queryResults = [];
    for (const { kind, query } of buildClinicSearchQueries(address.trim())) {
      if (signal?.aborted) {
        const error = new Error("Location lookup was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      const results = await search(query, 5, signal);
      for (const result of results) {
        if (!hasValidResult(result)) continue;
        const evidence = getCandidateEvidence(result, parsedAddress);
        if (evidence.classification === "none") continue;
        queryResults.push({
          result,
          classification: evidence.classification,
          evidenceCount: evidence.evidenceCount,
        });
      }
      const exactCandidates = queryResults.filter(
        (candidate) => candidate.classification === "exact"
      );
      if (kind === "full" && exactCandidates.length > 0) break;
    }

    if (signal?.aborted) {
      const error = new Error("Location lookup was cancelled.");
      error.name = "AbortError";
      throw error;
    }
    const classification = queryResults.some(
      (candidate) => candidate.classification === "exact"
    )
      ? "exact"
      : "approximate";
    const matchingCandidates = queryResults.filter(
      (candidate) => candidate.classification === classification
    );
    if (matchingCandidates.length === 0) return null;
    matchingCandidates.sort((first, second) =>
      second.evidenceCount - first.evidenceCount
    );
    const best = matchingCandidates[0];
    const tiedCandidates = matchingCandidates.filter(
      (candidate) => candidate.evidenceCount === best.evidenceCount
    );
    const distinctLocations = new Set(
      tiedCandidates.map(({ result }) => `${result.lat},${result.lon}`)
    );
    const candidates = [];
    const seenLocations = new Set();
    for (const candidate of matchingCandidates) {
      const locationKey = `${candidate.result.lat},${candidate.result.lon}`;
      if (seenLocations.has(locationKey)) continue;
      seenLocations.add(locationKey);
      candidates.push({
        displayName: candidate.result.display_name,
        latitude: Number(candidate.result.lat),
        longitude: Number(candidate.result.lon),
        classification,
      });
    }
    if (distinctLocations.size > 1) {
      return { classification: "none", candidates };
    }
    return {
      displayName: best.result.display_name,
      latitude: Number(best.result.lat),
      longitude: Number(best.result.lon),
      classification,
      candidates,
    };
  }

  async function reverseGeocode(latitude, longitude, { signal } = {}) {
    if (!isValidCoordinates(latitude, longitude)) {
      throw new Error("Coordinates are invalid.");
    }
    const url = new URL("/reverse", endpoint);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    const response = await request(url, `reverse:${latitude}:${longitude}`, signal);
    const result = Array.isArray(response) ? response[0] : response;
    return typeof result?.display_name === "string" && result.display_name.trim()
      ? result.display_name
      : null;
  }

  return { geocodeAddress, reverseGeocode };
}

const nominatimClient = createNominatimClient();

module.exports = {
  buildClinicSearchQueries,
  createNominatimClient,
  normalizeAddressText,
  nominatimClient,
  parseClinicAddress,
};
