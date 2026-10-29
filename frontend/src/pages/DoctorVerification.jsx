import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://localhost:8001";

function DoctorVerification() {
  const navigate = useNavigate();
  const [name, setName] = useState("Doctor");
  const [status, setStatus] = useState("pending");
  const [profileActive, setProfileActive] = useState(true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function fetchStatus() {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const currentRole = res.data?.role;
        const currentStatus = res.data?.doctorApprovalStatus;
        const currentProfileActive = res.data?.doctorProfileActive !== false;

        if (
          !["patient", "doctor"].includes(currentRole) ||
          (!["pending", "rejected"].includes(currentStatus) && currentProfileActive)
        ) {
          navigate("/dashboard", { replace: true });
          return;
        }

        setName(res.data?.name || "Doctor");
        setStatus(currentStatus);
        setProfileActive(currentProfileActive);
        setReason(res.data?.rejectionReason || "");
      } catch {
        navigate("/login", { replace: true });
      }
    }

    fetchStatus();
  }, [navigate]);

  const isRejected = status === "rejected";
  const isRemoved = status === "approved" && !profileActive;

  return (
    <div className="auth-wrapper" style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div className="auth-card" style={{ maxWidth: "520px" }}>
        <h1>
          {isRemoved
            ? "Doctor access removed"
            : isRejected
              ? "Verification update"
              : "Verification pending"}
        </h1>
        <p className="subtitle" style={{ marginBottom: "20px" }}>
          {isRemoved
            ? `Hi ${name}, your doctor profile is inactive.`
            : isRejected
              ? `Hi ${name}, your doctor registration needs attention.`
              : `Hi ${name}, your account is being reviewed.`}
        </p>

        {isRemoved ? (
          <div className="error-box" style={{ marginBottom: "16px" }}>
            Doctor privileges have been removed. Your account and patient access remain active.
          </div>
        ) : isRejected ? (
          <div className="error-box" style={{ marginBottom: "16px" }}>
            Your doctor profile was rejected.
            {reason ? <div style={{ marginTop: "8px" }}>Reason: {reason}</div> : null}
          </div>
        ) : (
          <div className="success-box" style={{ marginBottom: "16px" }}>
            Your doctor registration is awaiting approval from the admin team.
          </div>
        )}

        <p style={{ lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          {isRemoved
            ? "You can continue using patient features. Submit a new doctor application to request review; doctor access will return only after approval."
            : isRejected
              ? "You can continue using patient features. Doctor dashboard access remains unavailable until a new application is approved."
              : "You can continue using patient features while your application is reviewed. Doctor dashboard access is available only after approval."}
        </p>

        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          {(isRejected || isRemoved) && (
            <button type="button" onClick={() => navigate("/im-doctor")}>
              Apply Again
            </button>
          )}
          <button type="button" onClick={() => navigate("/dashboard")}>
            Continue as patient
          </button>
          <button type="button" onClick={() => {
            localStorage.removeItem("token");
            navigate("/login", { replace: true });
          }}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default DoctorVerification;
