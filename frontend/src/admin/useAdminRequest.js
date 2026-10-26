import { useCallback, useEffect, useState } from "react";
import { AdminRequestError } from "./adminApi";

const EMPTY_RESULT = { key: null, data: null, meta: null, error: null };

function getPayloadData(payload) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }

  return payload ?? null;
}

export function useAdminRequest(fetcher, params = {}) {
  const paramsKey = JSON.stringify(params);
  const [result, setResult] = useState(EMPTY_RESULT);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setResult(EMPTY_RESULT);
    setAttempt((value) => value + 1);
  }, []);

  // Reload without blanking the current data (used after a status change).
  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestParams = JSON.parse(paramsKey);
    const { signal } = controller;

    fetcher(requestParams, { signal })
      .then((payload) => {
        if (signal.aborted) return;

        setResult({
          key: paramsKey,
          data: getPayloadData(payload),
          meta: payload?.meta ?? null,
          error: null,
        });
      })
      .catch((error) => {
        if (signal.aborted) return;
        if (error instanceof AdminRequestError && error.kind === "canceled") {
          return;
        }

        setResult({
          key: paramsKey,
          data: null,
          meta: null,
          error:
            error instanceof AdminRequestError
              ? error
              : new AdminRequestError("network"),
        });
      });

    return () => controller.abort();
  }, [fetcher, paramsKey, attempt]);

  const isPending = result.key !== paramsKey;
  const hasData = result.data !== null;

  return {
    data: result.data,
    meta: isPending ? null : result.meta,
    error: isPending ? null : result.error,
    isLoading: isPending && !hasData,
    isRefreshing: isPending && hasData,
    retry,
    refresh,
  };
}
