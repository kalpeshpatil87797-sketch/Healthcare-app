export function createClinicAddressLookup({
  lookup,
  onChange,
  delayMs = 850,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer = null;
  let controller = null;
  let requestVersion = 0;

  function cancel() {
    requestVersion += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
    controller?.abort();
    controller = null;
  }

  function startLookup(address, version) {
    controller = new AbortController();
    const activeController = controller;
    onChange({ status: "loading", location: null, error: "" });
    Promise.resolve(lookup(address, { signal: activeController.signal }))
      .then((location) => {
        if (version !== requestVersion || activeController.signal.aborted) return;
        if (
          !location ||
          !["exact", "approximate"].includes(location.classification)
        ) {
          onChange({
            status: "error",
            location: null,
            error: "No reliable clinic or locality match was found. Correct the address or use the current-location option.",
          });
          return;
        }
        onChange({ status: "matched", location, error: "" });
      })
      .catch((error) => {
        if (version !== requestVersion || activeController.signal.aborted) return;
        onChange({
          status: "error",
          location: null,
          error: error?.message || "Clinic location lookup failed. Edit the address or try again later.",
        });
      });
  }

  function schedule(address) {
    cancel();
    const normalizedAddress = address.trim();
    if (normalizedAddress.length < 3) {
      onChange({ status: "idle", location: null, error: "" });
      return;
    }

    const version = requestVersion;
    onChange({ status: "waiting", location: null, error: "" });
    timer = setTimer(() => {
      timer = null;
      startLookup(normalizedAddress, version);
    }, delayMs);
  }

  function lookupNow(address) {
    cancel();
    const normalizedAddress = address.trim();
    if (normalizedAddress.length < 3) {
      onChange({
        status: "error",
        location: null,
        error: "Enter at least 3 address characters to look up the clinic location.",
      });
      return;
    }
    startLookup(normalizedAddress, requestVersion);
  }

  return { schedule, lookupNow, cancel };
}

export function applyConfirmedClinicLocation(form, location) {
  if (
    !location ||
    !["exact", "approximate"].includes(location.classification) ||
    typeof location.displayName !== "string" ||
    !location.displayName.trim() ||
    location.displayName.trim().length > 300 ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return form;
  }
  return {
    ...form,
    clinicLocation: location.displayName.trim(),
    clinicLatitude: String(location.latitude),
    clinicLongitude: String(location.longitude),
  };
}
