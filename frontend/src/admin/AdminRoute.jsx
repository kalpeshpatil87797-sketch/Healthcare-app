import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  AdminRequestError,
  ADMIN_ACCESS_INVALID_EVENT,
  clearSession,
  getCurrentUser,
} from "./adminApi";
import { ADMIN_ROLES } from "./adminConstants";
import {
  AdminGateError,
  AdminGateLoader,
} from "./components/AdminStates";
import "./AdminLayout.css";
import "./AdminPages.css";

export default function AdminRoute() {
  const [status, setStatus] = useState("checking");
  const [adminUser, setAdminUser] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    if (!hasToken) return undefined;

    const controller = new AbortController();
    const { signal } = controller;

    function handleAccessInvalid(event) {
      if (event.detail?.kind === "forbidden") {
        setStatus("denied");
        return;
      }

      clearSession();
      setStatus("expired");
    }

    window.addEventListener(ADMIN_ACCESS_INVALID_EVENT, handleAccessInvalid);

    getCurrentUser({ signal })
      .then((user) => {
        if (signal.aborted) return;

        if (ADMIN_ROLES.includes(user?.role)) {
          setAdminUser({
            _id: user._id || "",
            name: user.name || "",
            email: user.email || "",
            role: user.role,
          });
          setStatus("allowed");
          return;
        }

        setStatus("denied");
      })
      .catch((error) => {
        if (signal.aborted) return;
        if (error instanceof AdminRequestError && error.kind === "canceled") {
          return;
        }
        if (error instanceof AdminRequestError && error.kind === "session") {
          clearSession();
          setStatus("expired");
          return;
        }
        if (error instanceof AdminRequestError && error.kind === "suspended") {
          clearSession();
          setStatus("expired");
          return;
        }
        if (error instanceof AdminRequestError && error.kind === "forbidden") {
          setStatus("denied");
          return;
        }

        setStatus("error");
      });

    return () => {
      controller.abort();
      window.removeEventListener(ADMIN_ACCESS_INVALID_EVENT, handleAccessInvalid);
    };
  }, [hasToken, attempt]);

  const handleRetry = useCallback(() => {
    setStatus("checking");
    setAttempt((value) => value + 1);
  }, []);

  const handleSignOut = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  if (!hasToken || status === "expired") {
    return <Navigate to="/login" replace />;
  }

  if (status === "denied") {
    return <Navigate to="/dashboard" replace />;
  }

  if (status === "error") {
    return (
      <AdminGateError onRetry={handleRetry} onSignOut={handleSignOut} />
    );
  }

  if (status !== "allowed" || !adminUser) {
    return <AdminGateLoader />;
  }

  return <Outlet context={{ adminUser }} />;
}
