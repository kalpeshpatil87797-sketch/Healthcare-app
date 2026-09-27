import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";
import MedicineDetailModal, { familyForProduct } from "../components/MedicineDetailModal";
import AppointmentModal from "../components/AppointmentModal";
import AlternateTimeModal from "../components/AlternateTimeModal";
import AppointmentCard from "../components/AppointmentCard";
import axios from "axios";
import { SPECIALTIES } from "../utils/specialties";
import { PRODUCTS, CATEGORIES } from "../data/medicines";
import "./Chat.css";
import "./ChatTheme.css";

const API_BASE = "http://localhost:8001";

// Patient ↔ Doctor chat attachments (images + PDF only). Mirrors the
// backend allowlist in backend/middlewares/upload.js — keep both in sync.
const CHAT_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const CHAT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const CHAT_DOC_ACCEPT = "application/pdf,.pdf";
const CHAT_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const CHAT_MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB

function chatFileKind(file) {
  if (!file) return null;
  if (file.type && file.type.startsWith("image/")) return "image";
  const name = String(file.name || "").toLowerCase();
  if ((file.type === "application/pdf" || !file.type) && name.endsWith(".pdf")) return "document";
  if (file.type === "application/pdf") return "document";
  return null;
}

// Client-side guard only — the backend re-validates MIME type, extension
// and size and is the authority. Returns "" when the file looks fine.
function validateChatAttachment(file) {
  if (!file) return "";
  const ext = String(file.name || "").toLowerCase().split(".").pop();
  const isImage = CHAT_IMAGE_MIMES.includes(file.type) && ["jpg", "jpeg", "png", "webp"].includes(ext);
  const isPdf = file.type === "application/pdf" && ext === "pdf";
  if (!isImage && !isPdf) return "This file type is not supported.";
  const limit = isImage ? CHAT_MAX_IMAGE_SIZE : CHAT_MAX_DOC_SIZE;
  if (file.size > limit) return "File is too large.";
  return "";
}

function formatChatFileSize(size) {
  if (size === undefined || size === null) return "";
  const kb = size / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Attachment body shared by both sides of the Patient ↔ Doctor chat.
// Text-only history (no fileUrl) renders exactly as before; image messages
// show a contained preview, PDF messages a compact card with an Open action.
function renderChatAttachment(msg) {
  if (!msg || !msg.fileUrl) return null;
  const url = `${API_BASE}${msg.fileUrl}`;
  if (msg.fileType === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" aria-label={`Open image ${msg.fileName || "attachment"}`}>
        <img className="msg-attach-img" src={url} alt={msg.fileName || "Shared image"} loading="lazy" />
      </a>
    );
  }
  if (msg.fileType === "document") {
    return (
      <div className="msg-doc-card">
        <span className="msg-doc-icon" aria-hidden="true">📄</span>
        <span className="msg-doc-info">
          <span className="msg-doc-name">{msg.fileName || "Document.pdf"}</span>
          {msg.fileSize ? <span className="msg-doc-size">{formatChatFileSize(msg.fileSize)}</span> : null}
        </span>
        <a className="msg-doc-open" href={url} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>
    );
  }
  return null;
}

// Pending-attachment preview shown above the input before sending.
// Images get a thumbnail, PDFs an icon + filename; ✕ removes the file.
function ChatAttachPreview({ file, onRemove }) {
  if (!file) return null;
  const kind = chatFileKind(file);
  return (
    <div className="image-preview chat-attach-preview">
      {kind === "image" ? (
        <img src={URL.createObjectURL(file)} alt="Attachment preview" />
      ) : (
        <span className="file-chip">📄 {file.name}</span>
      )}
      <span onClick={onRemove} role="button" tabIndex={0} aria-label="Remove attachment"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(); } }}>
        ✕
      </span>
    </div>
  );
}

// Render AI health replies with readable headings + bullets.
// Keeps plain text for user/doctor messages; only formats AI bubbles.
// Section headings get a small icon purely for visual separation —
// the AI-generated text itself is never modified.
const AI_HEADING_ICONS = [
  [/possible condition/i, "🩺"],
  [/why.*happen/i, "🔍"],
  [/home precaution/i, "🏠"],
  [/which doctor|doctor to visit/i, "👩‍⚕️"],
  [/urgent|emergency/i, "⚠️"],
];

function aiHeadingIcon(title) {
  const found = AI_HEADING_ICONS.find(([re]) => re.test(title));
  return found ? found[1] : null;
}
function renderAiText(text) {
  const lines = String(text ?? "").split("\n");
  const nodes = [];
  let bullets = [];

  function flushBullets(keyPrefix) {
    if (bullets.length > 0) {
      nodes.push(
        <ul key={`${keyPrefix}-ul-${nodes.length}`} className="ai-list">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets(`gap-${idx}`);
      return;
    }
    const headingMatch = trimmed.match(/^([1-5])\.\s*(.+)$/);
    if (headingMatch) {
      flushBullets(`h-${idx}`);
      const icon = aiHeadingIcon(headingMatch[2]);
      nodes.push(
        <div key={`h-${idx}`} className="ai-heading">
          {icon && (
            <span className="ai-heading-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {headingMatch[1]}. {headingMatch[2]}
        </div>
      );
      return;
    }
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }
    flushBullets(`t-${idx}`);
    nodes.push(
      <div key={`t-${idx}`} className="ai-line">
        {trimmed}
      </div>
    );
  });
  flushBullets("end");
  return nodes;
}

// Doctor-only "/med/" hierarchical medicine autocomplete. Uses the SAME
// PRODUCTS + CATEGORIES as the Medicine page — no second dataset, no
// invented names. Grammar: /med/ → categories, /med/<category>/ → that
// category's products, /med/<category>/<query> → filtered products.
function isPlaceholderValue(v) {
  return !v || String(v).trim() === "" || String(v).trim().toLowerCase() === "not specified";
}

// Exact product name composed only from stored fields: brand alone when
// strength is unspecified (e.g. "Ascoril LS"), else brand + strength
// (e.g. "Dolo 650mg"). Never invented.
function getProductDisplayName(p) {
  if (!p) return "";
  return isPlaceholderValue(p.strength) ? p.brandName : `${p.brandName} ${p.strength}`;
}

function getCategorySuggestions(filter) {
  const q = String(filter ?? "").trim().toLowerCase();
  const list = q ? CATEGORIES.filter((c) => c.toLowerCase().includes(q)) : [...CATEGORIES];
  return list.slice(0, 8);
}

function productsInCategory(category) {
  return PRODUCTS.filter((p) => (p.conditions || []).includes(category));
}

function getCategoryMedSuggestions(category, query) {
  const inCat = productsInCategory(category);
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return inCat.slice(0, 6);
  const hits = inCat.filter((p) =>
    `${getProductDisplayName(p)} ${p.brandName} ${p.activeIngredient} ${p.strength} ${p.dosageForm}`
      .toLowerCase()
      .includes(q)
  );
  hits.sort((a, b) => {
    const aHead = getProductDisplayName(a).toLowerCase().startsWith(q) ? 0 : 1;
    const bHead = getProductDisplayName(b).toLowerCase().startsWith(q) ? 0 : 1;
    return aHead - bHead;
  });
  return hits.slice(0, 6);
}

// Find every "/med" command start, wherever it appears in the input.
// Boundaries: "/med" must be at the start or after whitespace, and followed
// by "/", whitespace, or end — so "medicine"/"medical" never trigger.
function findMedTokens(value) {
  const starts = [];
  const re = /(^|\s)\/med(?=\/|\s|$)/g;
  let m;
  while ((m = re.exec(value)) !== null) {
    starts.push(m.index + m[1].length); // index of "/"
  }
  return starts;
}

// Parse the active command text (from "/med" up to the cursor) into stages:
// /med/ → categories, /med/<cat>/ → that category's medicines,
// /med/<cat>/<query> → filtered medicines.
function parseMedCommand(tokenText) {
  const rest = tokenText.slice(4); // after "/med"
  if (rest === "") return { kind: "category", categoryFilter: "" };
  if (rest[0] !== "/" && rest[0] !== " " && rest[0] !== "\t") return null;
  if (rest[0] !== "/") return { kind: "category", categoryFilter: rest.trim() };
  const remainder = rest.slice(1); // after "/med/"
  const slashIdx = remainder.indexOf("/");
  if (slashIdx === -1) return { kind: "category", categoryFilter: remainder.trim() };
  const categoryText = remainder.slice(0, slashIdx).trim();
  const canonical = CATEGORIES.find((c) => c.toLowerCase() === categoryText.toLowerCase());
  if (!canonical) return { kind: "none" };
  return { kind: "medicine", category: canonical, medQuery: remainder.slice(slashIdx + 1).trim() };
}

// The active command is the nearest "/med" at or before the cursor —
// never blindly the first one in the message.
function findActiveMedCommand(value, cursor) {
  const pos = Math.max(0, Math.min(cursor ?? value.length, value.length));
  let start = null;
  for (const s of findMedTokens(value)) {
    if (s <= pos) start = s;
    else break;
  }
  if (start === null) return null;
  const parsed = parseMedCommand(value.slice(start, pos));
  if (!parsed) return null;
  return { ...parsed, tokenStart: start };
}

// Minimal card payload built only from stored directory fields.
// No dosage/frequency instructions are invented here.
function buildMedicinePayload(p) {
  return {
    id: p.id,
    activeIngredient: p.activeIngredient,
    brandName: p.brandName,
    companyName: p.companyName,
    strength: p.strength,
    dosageForm: p.dosageForm,
    category: p.category,
    condition: p.conditions?.[0] ?? "",
  };
}

// Exact display name from a stored medicine snapshot (same rule as
// getProductDisplayName, for snapshots travelling inside messages).
function getSnapshotDisplayName(med) {
  if (!med) return "";
  return getProductDisplayName({ brandName: med.brandName, strength: med.strength });
}

// Resolve a stored medicine reference against the SAME dataset the Medicine
// page uses (matched by stable product id, then brand+strength+ingredient).
// Never invents details: an unrecognized reference yields no product, and
// the card then shows only the stored name with no detail rows.
function resolveMedicineProduct(med) {
  if (!med) return null;
  if (med.id) {
    const byId = PRODUCTS.find((p) => p.id === med.id);
    if (byId) return byId;
  }
  const norm = (v) => String(v ?? "").trim().toLowerCase();
  return (
    PRODUCTS.find(
      (p) =>
        norm(p.brandName) === norm(med.brandName) &&
        norm(p.strength) === norm(med.strength) &&
        norm(p.activeIngredient) === norm(med.activeIngredient)
    ) ?? null
  );
}

// Exact visible medicine name: dataset-resolved when possible, otherwise
// the stored snapshot name. Always an existing name, never invented.
function medMessageName(med) {
  const product = resolveMedicineProduct(med);
  return product ? getProductDisplayName(product) : getSnapshotDisplayName(med);
}

// Every medicine carried by a message: the newer `medicines` list when
// present, otherwise the legacy single `medicine` snapshot.
function medListOf(msg) {
  if (msg && Array.isArray(msg.medicines) && msg.medicines.length > 0) return msg.medicines;
  return msg && msg.medicine ? [msg.medicine] : [];
}

// Hide the text line only when it is exactly the single card's name
// (e.g. typebox "Ascoril LS"); notes mentioning several medicines stay.
function showMedText(msg, list) {
  if (!msg.text || !msg.text.trim()) return false;
  if (list.length !== 1) return true;
  return msg.text.trim().toLowerCase() !== medMessageName(list[0]).toLowerCase();
}

// Structured medicine card reusing the existing .med-card styling.
// Shows only fields already present in medicines.js; placeholder values
// ("Not specified"/empty) are hidden, never invented. When `onOpen` is
// provided the whole card acts as a button navigating to the Medicine page.
function renderMedicineCard(med, onOpen) {
  const product = resolveMedicineProduct(med);
  const name = product ? getProductDisplayName(product) : getSnapshotDisplayName(med);
  if (!name) return null;
  const get = (key) => (product ? product[key] : med[key]);
  const rows = [];
  const ingredient = get("activeIngredient");
  const brand = get("brandName");
  const strength = get("strength");
  const form = get("dosageForm");
  const category = product ? product.conditions?.[0] || product.category : med.condition || med.category;
  const company = get("companyName");
  if (!isPlaceholderValue(ingredient)) rows.push(["Active Ingredient", ingredient]);
  if (!isPlaceholderValue(brand)) {
    rows.push(["Brand / Product", isPlaceholderValue(strength) ? brand : `${brand} ${strength}`]);
  }
  if (!isPlaceholderValue(strength)) rows.push(["Strength", strength]);
  if (!isPlaceholderValue(form)) rows.push(["Dosage Form", form]);
  if (!isPlaceholderValue(category)) rows.push(["Category", category]);
  if (!isPlaceholderValue(company)) rows.push(["Company / Manufacturer", company]);
  return (
    <div
      className={`med-card${onOpen ? " med-clickable" : ""}`}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `View ${name} details` : undefined}
    >
      <div className="med-card-header">
        <span className="med-card-icon" aria-hidden="true">💊</span>
        <div className="med-card-title">
          <strong>{name}</strong>
          <span>Medicine</span>
        </div>
        <span className="med-card-badge">Medicine</span>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="med-card-row">
          <span className="med-card-label">{label}</span>
          <span className="med-card-value">{value}</span>
        </div>
      ))}
      <div className="med-card-note">Info only — no dosage prescribed. Your doctor will advise dosage and frequency.</div>
      {onOpen && <div className="med-card-hint">Tap to view details</div>}
    </div>
  );
}

// Doctor-only chat composer with hierarchical "/med/" autocomplete.
// Used solely in the doctor typebox (doctor chatting with a patient).
// Normal text without /med/ sends exactly as before.
function DoctorMedComposer({
  patientName,
  patientConvoText,
  patientConvoSending,
  medIndex,
  medCursor,
  medDismissed,
  onInputChange,
  onCursorChange,
  onKeyDown,
  onSelectCategory,
  onSelectProduct,
  onSend,
  inputRef,
  attachFile,
  attachMenuOpen,
  onToggleAttachMenu,
  onPickPhoto,
  onPickDoc,
  onRemoveAttachFile,
  photoInputRef,
  docInputRef,
  onPhotoFile,
  onDocFile,
  attachDisabled,
}) {
  // Cursor-aware detection: the /med/ command nearest to (at or before) the
  // cursor, wherever it appears in the input — not only at the start.
  const cursor = medCursor ?? patientConvoText.length;
  const active = findActiveMedCommand(patientConvoText, cursor);
  const dismissKey = active ? `${active.tokenStart}:${patientConvoText.slice(active.tokenStart, cursor)}` : null;
  let suggestions = [];
  if (active && !(medDismissed && medDismissed === dismissKey)) {
    if (active.kind === "category") {
      suggestions = getCategorySuggestions(active.categoryFilter).map((name) => ({ kind: "category", name }));
    } else if (active.kind === "medicine") {
      suggestions = getCategoryMedSuggestions(active.category, active.medQuery).map((p) => ({ kind: "medicine", product: p }));
    }
  }
  const safeIndex = suggestions.length === 0 ? 0 : Math.min(medIndex, suggestions.length - 1);

  return (
    <div className="med-compose-wrap">
      {suggestions.length > 0 && (
        <ul className="med-suggest" role="listbox" aria-label="Medicine suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.kind === "category" ? `cat-${s.name}` : s.product.id}
              role="option"
              aria-selected={i === safeIndex}
              className={`med-suggest-item ${i === safeIndex ? "med-suggest-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (s.kind === "category") onSelectCategory(s.name);
                else onSelectProduct(s.product);
              }}
            >
              {s.kind === "category" ? (
                <>
                  <span className="med-suggest-brand">{s.name}</span>
                  <span className="med-suggest-sub">Category · {productsInCategory(s.name).length} products</span>
                </>
              ) : (
                <>
                  <span className="med-suggest-brand">{getProductDisplayName(s.product)}</span>
                  <span className="med-suggest-sub">{s.product.activeIngredient} · {isPlaceholderValue(s.product.dosageForm) ? s.product.category : s.product.dosageForm}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ChatAttachPreview file={attachFile} onRemove={onRemoveAttachFile} />
      <form className="chat-input-row dm-input-row" onSubmit={onSend}>
        <div className="attach-wrapper">
          <button
            type="button"
            className="attach-btn"
            onClick={onToggleAttachMenu}
            disabled={attachDisabled || patientConvoSending}
            aria-label="Attach a file"
          >
            📎
          </button>
          {attachMenuOpen && (
            <div className="attach-menu">
              <div className="attach-option" onClick={onPickPhoto}>🖼️ Photo</div>
              <div className="attach-option" onClick={onPickDoc}>📄 Document</div>
            </div>
          )}
          <input type="file" accept={CHAT_IMAGE_ACCEPT} ref={photoInputRef} onChange={onPhotoFile} style={{ display: "none" }} />
          <input type="file" accept={CHAT_DOC_ACCEPT} ref={docInputRef} onChange={onDocFile} style={{ display: "none" }} />
        </div>
        <input
          type="text"
          ref={inputRef}
          className="chat-input"
          placeholder={`Message ${patientName}... (type /med/ for medicines)`}
          value={patientConvoText}
          onChange={onInputChange}
          onClick={(e) => onCursorChange(e.target.selectionStart)}
          onKeyUp={(e) => onCursorChange(e.target.selectionStart)}
          onKeyDown={(e) => onKeyDown(e)}
          disabled={patientConvoSending}
        />
        <button type="submit" className="send-btn" disabled={patientConvoSending}>
          {patientConvoSending ? (attachFile ? "Uploading..." : "Sending...") : "Send"}
        </button>
      </form>
    </div>
  );
}

function Chat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const [doctors, setDoctors] = useState([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [doctorSearched, setDoctorSearched] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [connectedDoctor, setConnectedDoctor] = useState(null);
  const [convoMessages, setConvoMessages] = useState([]);
  const [convoText, setConvoText] = useState("");
  const [convoSending, setConvoSending] = useState(false);
  const [convoError, setConvoError] = useState("");
  const [myDoctors, setMyDoctors] = useState([]);
  const [myDoctorsLoading, setMyDoctorsLoading] = useState(false);
  const [myDoctorsMessage, setMyDoctorsMessage] = useState("");
  const [connectingId, setConnectingId] = useState("");
  const [role, setRole] = useState("patient");
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsMessage, setPatientsMessage] = useState("");
  const [myDoctorId, setMyDoctorId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientConvo, setPatientConvo] = useState([]);
  const [patientConvoText, setPatientConvoText] = useState("");
  const [patientConvoSending, setPatientConvoSending] = useState(false);
  const [patientConvoError, setPatientConvoError] = useState("");
  // Pending attachments for the Patient ↔ Doctor chat (one per side).
  // Nothing sends until Send is pressed; ✕ clears the selection.
  const [convoFile, setConvoFile] = useState(null);
  const [showConvoAttachMenu, setShowConvoAttachMenu] = useState(false);
  const [patientConvoFile, setPatientConvoFile] = useState(null);
  const [showPatientAttachMenu, setShowPatientAttachMenu] = useState(false);
  // Doctor-only /med/ autocomplete state (doctor typebox with a patient only).
  // selectedMeds keeps one snapshot per chosen product for the internal
  // type:"medicine" payload; the visible text holds the exact names.
  const [medIndex, setMedIndex] = useState(0);
  const [medCursor, setMedCursor] = useState(null);
  const [medDismissed, setMedDismissed] = useState(null);
  const [selectedMeds, setSelectedMeds] = useState([]);
  // Snapshot for the in-chat medicine details modal (one card → its own
  // details). Null means closed; stays on the chat page, never navigates.
  const [detailMed, setDetailMed] = useState(null);
  // Doctor whose appointment popup is open (STEP 1: UI only, no backend).
  // Null means closed; the modal remounts fresh on every open.
  const [appointmentDoctor, setAppointmentDoctor] = useState(null);
  // Appointment card actions: alternate modal target + in-flight action id.
  // Cards themselves re-render through the existing message refetch.
  const [alternateFor, setAlternateFor] = useState(null);
  const [apptActingId, setApptActingId] = useState(null);

  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const convoPhotoRef = useRef(null);
  const convoDocRef = useRef(null);
  const patientPhotoRef = useRef(null);
  const patientDocRef = useRef(null);
  const doctorInputRef = useRef(null);
  const aiInputRef = useRef(null);
  const token = localStorage.getItem("token");

  // Empty-state suggestion chips only fill the existing AI input —
  // sending still goes through the normal Send flow.
  function handleSuggestionChip(label) {
    setText(label);
    aiInputRef.current?.focus();
  }

  function getMyEmail() {
    try {
      return JSON.parse(atob(token.split(".")[1])).email;
    } catch {
      return "";
    }
  }
  const myEmail = getMyEmail();

  // Snapshot clicked in a medicine card → full product for the in-chat
  // details modal. Dataset match preferred; otherwise a snapshot-derived
  // product so only already-stored fields are shown, never invented data.
  function productForChatSnapshot(med) {
    const found = resolveMedicineProduct(med);
    if (found) return found;
    return {
      activeIngredient: med.activeIngredient ?? "",
      brandName: med.brandName ?? "",
      companyName: med.companyName ?? "",
      strength: med.strength ?? "",
      dosageForm: med.dosageForm ?? "",
      category: med.category ?? "",
      conditions: med.condition ? [med.condition] : [],
      use: "",
      shortDescription: "",
      detailedDescription: "",
      commonUses: [],
      precautions: "",
      warnings: "",
    };
  }

  useEffect(() => {
    fetchMessages();
    fetchRole();
  }, []);

  async function fetchRole() {
    try {
      const res = await axios.get(`${API_BASE}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userRole = res.data.role === "doctor" ? "doctor" : "patient";
      setRole(userRole);
      if (userRole === "doctor") {
        fetchMyPatients();
      } else {
        fetchMyDoctors();
      }
    } catch (err) {
      console.log("Failed to fetch role", err);
    }
  }

  async function fetchMyPatients() {
    setPatientsLoading(true);
    setPatientsMessage("");
    try {
      const res = await axios.get(`${API_BASE}/doctor/my-patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyDoctorId(res.data.doctorId ?? "");
      setPatients(res.data.patients ?? []);
      if ((res.data.patients ?? []).length === 0) {
        setPatientsMessage("No patients have connected with you yet.");
      }
    } catch (err) {
      setPatientsMessage(err.response?.data?.error ?? "Failed to fetch patients.");
    } finally {
      setPatientsLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      const res = await axios.get(`${API_BASE}/message/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
    } catch (err) {
      console.log("Failed to fetch messages", err);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadError("");
    }
    setShowAttachMenu(false);
  }

  // Shared picker for the Patient ↔ Doctor chat: validate client-side
  // (backend re-validates), keep the file pending until Send is pressed.
  function handleConvoFileSelect(e, setFile, setMenu, setError) {
    const file = e.target.files[0];
    e.target.value = "";
    setMenu(false);
    if (!file) return;
    const problem = validateChatAttachment(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setFile(file);
  }

  function clearConvoFileInput() {
    if (convoPhotoRef.current) convoPhotoRef.current.value = "";
    if (convoDocRef.current) convoDocRef.current.value = "";
  }

  function clearPatientFileInput() {
    if (patientPhotoRef.current) patientPhotoRef.current.value = "";
    if (patientDocRef.current) patientDocRef.current.value = "";
  }

  function handleFindNearbyDoctors() {
    if (!specialty) {
      setDoctorMessage("Please select a doctor specialty first.");
      return;
    }
    setDoctorMessage("");
    setDoctorSearched(false);
    if (!("geolocation" in navigator)) {
      setDoctorMessage("Geolocation is not supported by this browser.");
      return;
    }
    setDoctorLoading(true);
    setDoctorMessage("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setDoctorMessage("Searching nearby doctors...");
          const res = await axios.get(`${API_BASE}/doctor/nearby`, {
            params: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              radiusKm: 10,
              specialty,
            },
            headers: { Authorization: `Bearer ${token}` },
          });
          setDoctors(res.data.doctors ?? []);
          setDoctorSearched(true);
          if ((res.data.doctors ?? []).length === 0) {
            setDoctorMessage(`No available ${specialty} doctors found nearby.`);
          } else {
            setDoctorMessage("");
          }
        } catch (err) {
          setDoctorSearched(true);
          setDoctorMessage(err.response?.data?.error ?? "Failed to fetch nearby doctors.");
        } finally {
          setDoctorLoading(false);
        }
      },
      () => {
        setDoctorLoading(false);
        setDoctorSearched(false);
        setDoctorMessage("Location permission denied. Please allow location access to find nearby doctors.");
      },
      { timeout: 10000 }
    );
  }

  async function fetchMyDoctors() {
    setMyDoctorsLoading(true);
    setMyDoctorsMessage("");
    try {
      const res = await axios.get(`${API_BASE}/doctor/my-doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyDoctors(res.data.doctors ?? []);
      if ((res.data.doctors ?? []).length === 0) {
        setMyDoctorsMessage("You haven't connected with any doctor yet.");
      }
    } catch (err) {
      setMyDoctorsMessage(err.response?.data?.error ?? "Failed to fetch your doctors.");
    } finally {
      setMyDoctorsLoading(false);
    }
  }

  async function fetchConvoMessages(doctorId) {
    try {
      const res = await axios.get(`${API_BASE}/message/all`, {
        params: { doctorId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setConvoMessages(res.data);
    } catch (err) {
      console.log("Failed to fetch conversation", err);
    }
  }

  async function handleConnectDoctor(doctor) {
    setConnectingId(String(doctor._id));
    try {
      await axios.post(
        `${API_BASE}/doctor/connect`,
        { doctorId: doctor._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMyDoctors();
      setActiveTab("mydoctor");
    } catch (err) {
      setDoctorMessage(err.response?.data?.error ?? "Failed to connect with doctor.");
    } finally {
      setConnectingId("");
    }
  }

  function handleOpenMyDoctorChat(doctor) {
    setConnectedDoctor({
      _id: doctor._id,
      name: doctor.name,
      specialist: doctor.specialist,
      clinicName: doctor.clinicName,
      isAvailable: doctor.isAvailable,
    });
    setConvoMessages([]);
    setConvoText("");
    setConvoError("");
    setConvoFile(null);
    setShowConvoAttachMenu(false);
    fetchConvoMessages(doctor._id);
  }

  async function fetchPatientConvo(patientId) {
    try {
      const res = await axios.get(`${API_BASE}/message/all`, {
        params: { doctorId: myDoctorId, patientId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setPatientConvo(res.data);
    } catch (err) {
      console.log("Failed to fetch conversation", err);
    }
  }

  function handleOpenPatientChat(patient) {
    setSelectedPatient(patient);
    setPatientConvo([]);
    setPatientConvoText("");
    setPatientConvoError("");
    setSelectedMeds([]);
    setDetailMed(null);
    setMedIndex(0);
    setMedCursor(null);
    setMedDismissed(null);
    setPatientConvoFile(null);
    setShowPatientAttachMenu(false);
    fetchPatientConvo(patient.patientId);
  }

  function handlePatientConvoInputChange(e) {
    setPatientConvoText(e.target.value);
    setMedCursor(e.target.selectionStart ?? e.target.value.length);
    setMedIndex(0);
    setMedDismissed(null);
  }

  // Replace ONLY the active "/med/..." command (from its "/med" up to the
  // cursor) with the chosen value, keeping all other text (and other /med/
  // commands) intact so /med/ stays reusable any number of times.
  function replaceActiveMedCommand(insert) {
    const value = patientConvoText;
    const cursor = doctorInputRef.current?.selectionStart ?? value.length;
    const active = findActiveMedCommand(value, cursor);
    if (!active) return false;
    const before = value.slice(0, active.tokenStart);
    const after = value.slice(cursor);
    const sep = after === "" || after[0] === " " || after[0] === "\t" || after[0] === "\n" ? "" : " ";
    const next = `${before}${insert}${sep}${after}`;
    const newCursor = before.length + insert.length + sep.length;
    setPatientConvoText(next);
    setMedCursor(newCursor);
    setMedIndex(0);
    setMedDismissed(null);
    setPatientConvoError("");
    requestAnimationFrame(() => {
      const el = doctorInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }
    });
    return true;
  }

  // STAGE 1 → 2: category chosen → "/med/<Category>/" so only that
  // category's medicines are suggested next.
  function selectMedCategory(name) {
    replaceActiveMedCommand(`/med/${name}/`);
  }

  // STAGE 3 → 4: product chosen → the whole active command becomes ONLY
  // the exact stored product name (e.g. "Ascoril LS"). The snapshot is kept
  // for the internal type:"medicine" payload — never shown as a command.
  function selectMedProduct(p) {
    if (!replaceActiveMedCommand(getProductDisplayName(p))) return;
    setSelectedMeds((prev) => [...prev, buildMedicinePayload(p)]);
  }

  // Suggestions for the command under the cursor (categories or that
  // category's products), reused by keyboard navigation.
  function liveMedSuggestions() {
    const value = patientConvoText;
    const cursor = doctorInputRef.current?.selectionStart ?? value.length;
    const active = findActiveMedCommand(value, cursor);
    if (!active) return [];
    if (active.kind === "category") {
      return getCategorySuggestions(active.categoryFilter).map((name) => ({ kind: "category", name }));
    }
    if (active.kind === "medicine") {
      return getCategoryMedSuggestions(active.category, active.medQuery).map((p) => ({ kind: "medicine", product: p }));
    }
    return [];
  }

  function handlePatientConvoKeyDown(e) {
    const value = patientConvoText;
    const cursor = doctorInputRef.current?.selectionStart ?? value.length;
    const active = findActiveMedCommand(value, cursor);
    if (e.key === "Escape") {
      if (active) setMedDismissed(`${active.tokenStart}:${value.slice(active.tokenStart, cursor)}`);
      return;
    }
    const suggestions = liveMedSuggestions();
    if (suggestions.length === 0 || !active) return;
    const safeIndex = Math.min(medIndex, suggestions.length - 1);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMedIndex((safeIndex + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMedIndex((safeIndex - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = suggestions[safeIndex] ?? suggestions[0];
      if (picked.kind === "category") selectMedCategory(picked.name);
      else selectMedProduct(picked.product);
    }
  }

  async function handlePatientConvoSend(e) {
    e.preventDefault();
    if (patientConvoSending || !selectedPatient) return;
    // Never send an unresolved /med command as a chat message — it must be
    // selected from the suggestions or deleted, wherever it appears.
    if (findMedTokens(patientConvoText).length > 0) {
      setPatientConvoError("Select a medicine from the suggestions, or delete the /med command to send.");
      return;
    }
    if (!patientConvoText.trim() && selectedMeds.length === 0 && !patientConvoFile) return;
    if (patientConvoFile && selectedMeds.length > 0) {
      setPatientConvoError("Attachments cannot be combined with medicine cards.");
      return;
    }
    setPatientConvoSending(true);
    try {
      const note = patientConvoText.trim() || selectedMeds.map((m) => getSnapshotDisplayName(m)).join(", ");
      if (patientConvoFile) {
        const formData = new FormData();
        formData.append("text", note);
        formData.append("file", patientConvoFile);
        formData.append("doctorId", myDoctorId);
        formData.append("patientId", selectedPatient.patientId);
        await axios.post(`${API_BASE}/message/send`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      } else {
        await axios.post(
          `${API_BASE}/message/send`,
          selectedMeds.length > 0
            ? {
                text: note,
                type: "medicine",
                medicine: selectedMeds[selectedMeds.length - 1],
                medicines: selectedMeds,
                doctorId: myDoctorId,
                patientId: selectedPatient.patientId,
              }
            : { text: note, doctorId: myDoctorId, patientId: selectedPatient.patientId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setPatientConvoText("");
      setPatientConvoFile(null);
      clearPatientFileInput();
      setSelectedMeds([]);
      setMedIndex(0);
      setMedCursor(null);
      setMedDismissed(null);
      setShowPatientAttachMenu(false);
      setPatientConvoError("");
      await fetchPatientConvo(selectedPatient.patientId);
    } catch (err) {
      setPatientConvoError(err.response?.data?.error ?? "File upload failed. Please try again.");
    } finally {
      setPatientConvoSending(false);
    }
  }

  async function handleConvoSend(e) {
    e.preventDefault();
    if (convoSending || !connectedDoctor) return;
    if (!convoText.trim() && !convoFile) return;
    setConvoSending(true);
    try {
      // Text-only keeps the original JSON path; attachments use multipart.
      if (convoFile) {
        const formData = new FormData();
        formData.append("text", convoText.trim());
        formData.append("file", convoFile);
        formData.append("doctorId", connectedDoctor._id);
        await axios.post(`${API_BASE}/message/send`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      } else {
        await axios.post(
          `${API_BASE}/message/send`,
          { text: convoText.trim(), doctorId: connectedDoctor._id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setConvoText("");
      setConvoFile(null);
      clearConvoFileInput();
      setShowConvoAttachMenu(false);
      setConvoError("");
      await fetchConvoMessages(connectedDoctor._id);
    } catch (err) {
      setConvoError(err.response?.data?.error ?? "File upload failed. Please try again.");
    } finally {
      setConvoSending(false);
    }
  }

  // Appointment card actions (STEP 3). Doctor accept/reject and patient
  // alternate-accept call the STEP 2 APIs, then reload messages through
  // the existing fetch so cards update — no second realtime system.
  async function handleAppointmentRespond(appointmentId, action) {
    if (apptActingId || !selectedPatient) return;
    setApptActingId(String(appointmentId));
    try {
      await axios.patch(
        `${API_BASE}/appointment/${appointmentId}/respond`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPatientConvoError("");
      await fetchPatientConvo(selectedPatient.patientId);
    } catch (err) {
      setPatientConvoError(err.response?.data?.error ?? "Failed to update appointment. Please try again.");
    } finally {
      setApptActingId(null);
    }
  }

  async function handleAcceptAlternate(appointmentId) {
    if (apptActingId || !connectedDoctor) return;
    setApptActingId(String(appointmentId));
    try {
      await axios.patch(
        `${API_BASE}/appointment/${appointmentId}/accept-alternate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConvoError("");
      await fetchConvoMessages(connectedDoctor._id);
    } catch (err) {
      setConvoError(err.response?.data?.error ?? "Failed to accept alternate time. Please try again.");
    } finally {
      setApptActingId(null);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if ((!text.trim() && !selectedFile) || isSending) return;

    const formData = new FormData();
    formData.append("text", text.trim());
    if (selectedFile) formData.append("file", selectedFile);

    setIsSending(true);
    try {
      const res = await axios.post(`${API_BASE}/message/send`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setText("");
      setSelectedFile(null);
      setUploadError(res.data.aiError || "");
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (documentInputRef.current) documentInputRef.current.value = "";
      await fetchMessages();
    } catch (err) {
      setUploadError(err.response?.data?.error ?? "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div>
      <Layout>
        <div className="chat-container">
          <div className="chat-layout">
            <div className="chat-tabs">
              <button
                type="button"
                className={`chat-tab ${activeTab === "ai" ? "chat-tab-active" : "chat-tab-inactive"}`}
                onClick={() => setActiveTab("ai")}
              >
                AI Chat
              </button>
              <button
                type="button"
                className={`chat-tab ${activeTab === "doctor" ? "chat-tab-active" : "chat-tab-inactive"}`}
                onClick={() => setActiveTab("doctor")}
              >
                {role === "doctor" ? "My Patients" : "Doctor"}
              </button>
              {role !== "doctor" && (
                <button
                  type="button"
                  className={`chat-tab ${activeTab === "mydoctor" ? "chat-tab-active" : "chat-tab-inactive"}`}
                  onClick={() => setActiveTab("mydoctor")}
                >
                  My Doctor
                </button>
              )}
            </div>
            <div className="chat-main">
              {activeTab === "ai" ? (
                <>
                  <div className="ai-header">
                    <span className="ai-header-icon" aria-hidden="true">🤖</span>
                    <div className="ai-header-text">
                      <h2>AI Health Assistant</h2>
                      <p>General health information and guidance</p>
                    </div>
                  </div>
                  <div className="chatbox ai-chatbox">
                    {messages.length === 0 && (
                      <div className="ai-empty">
                        <span className="ai-empty-icon" aria-hidden="true">🩺</span>
                        <p className="ai-empty-title">How can I help you today?</p>
                        <p className="ai-empty-sub">
                          Describe your symptoms or health concern to get general health information.
                        </p>
                        <div className="ai-chips">
                          {["Headache", "Fever", "Cough", "Stomach pain"].map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="ai-chip"
                              onClick={() => handleSuggestionChip(s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div key={msg._id} className={`chat-bubble ${msg.senderEmail === "AI Assistant" ? "ai-bubble ai-msg" : "user-msg"}`}>
                        <span className="sender-label">
                          {msg.senderEmail === "AI Assistant" ? "🩺 AI Assistant" : "You"}
                        </span>
                        {msg.senderEmail === "AI Assistant" && msg.text ? (
                          <div className="ai-formatted">{renderAiText(msg.text)}</div>
                        ) : (
                          msg.text && <p>{msg.text}</p>
                        )}
                        {msg.fileType === "image" && <img src={`${API_BASE}${msg.fileUrl}`} alt={msg.fileName} />}
                        {msg.fileType === "document" && (
                          <a href={`${API_BASE}${msg.fileUrl}`} target="_blank" rel="noreferrer" className="document-link">
                            📄 {msg.fileName}
                          </a>
                        )}
                      </div>
                    ))}
                    {isSending && text.trim() && (
                      <div className="chat-bubble ai-bubble ai-msg ai-thinking">
                        <span className="sender-label">🩺 AI Assistant</span>
                        <p>
                          <span className="typing-dots" aria-hidden="true">
                            <span></span>
                            <span></span>
                            <span></span>
                          </span>{" "}
                          AI Assistant is thinking...
                        </p>
                      </div>
                    )}
                  </div>
                  {uploadError && <div className="upload-error ai-error">{uploadError}</div>}
                  {selectedFile && (
                    <div className="image-preview">
                      {selectedFile.type.startsWith("image/") ? <img src={URL.createObjectURL(selectedFile)} alt="preview" /> : <span className="file-chip">📄 {selectedFile.name}</span>}
                      <span onClick={() => setSelectedFile(null)}>✕</span>
                    </div>
                  )}

                  <form className="chat-input-row ai-input-row" onSubmit={handleSend}>
                    <div className="attach-wrapper">
                      <button type="button" className="attach-btn" onClick={() => setShowAttachMenu(!showAttachMenu)} disabled={isSending}>📎</button>
                      {showAttachMenu && (
                        <div className="attach-menu">
                          <div className="attach-option" onClick={() => photoInputRef.current.click()}>🖼️ Photo</div>
                          <div className="attach-option" onClick={() => documentInputRef.current.click()}>📄 Document</div>
                        </div>
                      )}
                      <input type="file" accept="image/*" ref={photoInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
                      <input type="file" accept=".pdf,.doc,.docx,.txt" ref={documentInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
                    </div>
                    <input type="text" ref={aiInputRef} className="chat-input" placeholder="Describe your symptoms..." value={text} onChange={(e) => setText(e.target.value)} disabled={isSending} />
                    <button type="submit" className="send-btn" disabled={isSending}>{isSending ? "Sending..." : "Send"}</button>
                  </form>
                  <p className="ai-disclaimer">
                    AI-generated information is for general guidance and is not a substitute for professional medical care.
                  </p>
                </>
              ) : role === "doctor" ? (
                selectedPatient ? (
                  <>
                    <div className="chatbox">
                      <div className="doctor-convo-header">
                        <button type="button" className="doctor-back-btn" onClick={() => setSelectedPatient(null)}>
                          ← Back
                        </button>
                        <span className="dm-avatar" aria-hidden="true">
                          {(selectedPatient.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <h3 style={{ margin: 0 }}>{selectedPatient.name}</h3>
                          <p className="doctor-specialist" style={{ margin: 0 }}>
                            {selectedPatient.age !== undefined ? `Age ${selectedPatient.age}` : "Patient"}
                          </p>
                        </div>
                      </div>
                      {patientConvo.length === 0 && (
                        <div className="dm-empty">
                          <span className="dm-empty-icon" aria-hidden="true">💬</span>
                          <p className="dm-empty-title">Start the conversation.</p>
                          <p className="dm-empty-sub">Messages with {selectedPatient.name} will appear here.</p>
                        </div>
                      )}
                      {patientConvo.map((msg) => {
                        const isMine = msg.senderEmail === myEmail;
                        const meds = medListOf(msg);
                        return (
                          <div key={msg._id} className={`chat-bubble ${isMine ? "" : "ai-bubble"}`}>
                            <span className="sender-label">{isMine ? "You" : msg.senderEmail}</span>
                            {msg.type === "appointment" ? (
                              <AppointmentCard
                                msg={msg}
                                isDoctorView
                                patientName={selectedPatient.name}
                                acting={apptActingId}
                                onAccept={(id) => handleAppointmentRespond(id, "accept")}
                                onReject={(id) => handleAppointmentRespond(id, "reject")}
                                onAlternate={(id) => setAlternateFor(id)}
                              />
                            ) : msg.type === "medicine" && meds.length > 0 ? (
                              <>
                                {showMedText(msg, meds) && <p>{msg.text}</p>}
                                {meds.map((m, i) => (
                                  <div key={m.id || i}>{renderMedicineCard(m, () => setDetailMed(m))}</div>
                                ))}
                              </>
                            ) : (
                              msg.text && <p>{msg.text}</p>
                            )}
                            {renderChatAttachment(msg)}
                          </div>
                        );
                      })}
                    </div>
                    {patientConvoError && <div className="upload-error">{patientConvoError}</div>}
                    <DoctorMedComposer
                      patientName={selectedPatient.name}
                      patientConvoText={patientConvoText}
                      patientConvoSending={patientConvoSending}
                      medIndex={medIndex}
                      medCursor={medCursor}
                      medDismissed={medDismissed}
                      onInputChange={handlePatientConvoInputChange}
                      onCursorChange={setMedCursor}
                      onKeyDown={handlePatientConvoKeyDown}
                      onSelectCategory={selectMedCategory}
                      onSelectProduct={selectMedProduct}
                      onSend={handlePatientConvoSend}
                      inputRef={doctorInputRef}
                      attachFile={patientConvoFile}
                      attachMenuOpen={showPatientAttachMenu}
                      onToggleAttachMenu={() => setShowPatientAttachMenu((v) => !v)}
                      onPickPhoto={() => patientPhotoRef.current?.click()}
                      onPickDoc={() => patientDocRef.current?.click()}
                      onRemoveAttachFile={() => { setPatientConvoFile(null); clearPatientFileInput(); }}
                      photoInputRef={patientPhotoRef}
                      docInputRef={patientDocRef}
                      onPhotoFile={(e) => handleConvoFileSelect(e, setPatientConvoFile, setShowPatientAttachMenu, setPatientConvoError)}
                      onDocFile={(e) => handleConvoFileSelect(e, setPatientConvoFile, setShowPatientAttachMenu, setPatientConvoError)}
                      attachDisabled={patientConvoSending}
                    />
                  </>
                ) : (
                  <div className="chatbox dm-list">
                    <div className="dm-list-header">
                      <h3>My Patients</h3>
                      <p>Patients connected with you</p>
                    </div>
                    {patientsLoading && (
                      <div className="dm-loading">
                        <span className="typing-dots" aria-hidden="true">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>{" "}
                        Loading conversations...
                      </div>
                    )}
                    {!patientsLoading && patientsMessage && patients.length === 0 && (
                      <div className="dm-empty">
                        <span className="dm-empty-icon" aria-hidden="true">👥</span>
                        <p className="dm-empty-title">No patients connected yet.</p>
                        <p className="dm-empty-sub">When a patient connects with you, they will appear here.</p>
                      </div>
                    )}
                    {!patientsLoading &&
                      patients.map((p) => (
                        <div key={p.patientId} className="doctor-card dm-person-card">
                          <span className="dm-avatar" aria-hidden="true">
                            {(p.name || "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="dm-person-info">
                            <h3>{p.name}</h3>
                            {p.age !== undefined && <p>Age: {p.age}</p>}
                          </div>
                          <button type="button" className="doctor-connect-btn" onClick={() => handleOpenPatientChat(p)}>
                            Chat
                          </button>
                        </div>
                      ))}
                  </div>
                )
              ) : connectedDoctor ? (
                <>
                  <div className="chatbox">
                    <div className="doctor-convo-header">
                      <button type="button" className="doctor-back-btn" onClick={() => setConnectedDoctor(null)}>
                        ← Back
                      </button>
                      <span className="dm-avatar" aria-hidden="true">
                        {(connectedDoctor.name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h3 style={{ margin: 0 }}>
                          {connectedDoctor.name}{" "}
                          {connectedDoctor.isAvailable === true && (
                            <span className="dm-status-dot" title="Available">
                              <span aria-hidden="true">●</span> Available
                            </span>
                          )}
                        </h3>
                        <p className="doctor-specialist" style={{ margin: 0 }}>
                          {connectedDoctor.specialist}
                          {connectedDoctor.clinicName ? ` · ${connectedDoctor.clinicName}` : ""}
                        </p>
                      </div>
                    </div>
                    {convoMessages.length === 0 && (
                      <div className="dm-empty">
                        <span className="dm-empty-icon" aria-hidden="true">💬</span>
                        <p className="dm-empty-title">Start the conversation.</p>
                        <p className="dm-empty-sub">Say hello to {connectedDoctor.name}!</p>
                      </div>
                    )}
                    {convoMessages.map((msg) => {
                      const isMine = msg.senderEmail === myEmail;
                      const meds = medListOf(msg);
                      return (
                        <div key={msg._id} className={`chat-bubble ${isMine ? "" : "ai-bubble"}`}>
                          <span className="sender-label">{isMine ? "You" : msg.senderEmail}</span>
                          {msg.type === "appointment" ? (
                            <AppointmentCard
                              msg={msg}
                              isDoctorView={false}
                              acting={apptActingId}
                              onAcceptAlternate={(id) => handleAcceptAlternate(id)}
                              onChooseAnother={() => setAppointmentDoctor(connectedDoctor)}
                            />
                          ) : msg.type === "medicine" && meds.length > 0 ? (
                            <>
                              {showMedText(msg, meds) && <p>{msg.text}</p>}
                              {meds.map((m, i) => (
                                <div key={m.id || i}>{renderMedicineCard(m, () => setDetailMed(m))}</div>
                              ))}
                            </>
                          ) : (
                            msg.text && <p>{msg.text}</p>
                          )}
                          {renderChatAttachment(msg)}
                        </div>
                      );
                    })}
                  </div>
                  {convoError && <div className="upload-error">{convoError}</div>}
                  <ChatAttachPreview file={convoFile} onRemove={() => { setConvoFile(null); clearConvoFileInput(); }} />
                  <form className="chat-input-row dm-input-row" onSubmit={handleConvoSend}>
                    <div className="attach-wrapper">
                      <button
                        type="button"
                        className="attach-btn"
                        onClick={() => setShowConvoAttachMenu((v) => !v)}
                        disabled={convoSending}
                        aria-label="Attach a file"
                      >
                        📎
                      </button>
                      {showConvoAttachMenu && (
                        <div className="attach-menu">
                          <div className="attach-option" onClick={() => convoPhotoRef.current?.click()}>🖼️ Photo</div>
                          <div className="attach-option" onClick={() => convoDocRef.current?.click()}>📄 Document</div>
                        </div>
                      )}
                      <input type="file" accept={CHAT_IMAGE_ACCEPT} ref={convoPhotoRef} onChange={(e) => handleConvoFileSelect(e, setConvoFile, setShowConvoAttachMenu, setConvoError)} style={{ display: "none" }} />
                      <input type="file" accept={CHAT_DOC_ACCEPT} ref={convoDocRef} onChange={(e) => handleConvoFileSelect(e, setConvoFile, setShowConvoAttachMenu, setConvoError)} style={{ display: "none" }} />
                    </div>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder={`Message ${connectedDoctor.name}...`}
                      value={convoText}
                      onChange={(e) => setConvoText(e.target.value)}
                      disabled={convoSending}
                    />
                    <button type="submit" className="send-btn" disabled={convoSending}>
                      {convoSending ? (convoFile ? "Uploading..." : "Sending...") : "Send"}
                    </button>
                  </form>
                </>
              ) : activeTab === "mydoctor" ? (
                <div className="chatbox dm-list">
                  <div className="dm-list-header">
                    <h3>My Doctor</h3>
                    <p>Doctors you are connected with</p>
                  </div>
                  {myDoctorsLoading && (
                    <div className="dm-loading">
                      <span className="typing-dots" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>{" "}
                      Loading conversations...
                    </div>
                  )}
                  {!myDoctorsLoading && myDoctorsMessage && myDoctors.length === 0 && (
                    <div className="dm-empty">
                      <span className="dm-empty-icon" aria-hidden="true">👩‍⚕️</span>
                      <p className="dm-empty-title">No doctor connected yet.</p>
                      <p className="dm-empty-sub">Find an available doctor nearby to start chatting.</p>
                      <button type="button" className="doctor-find-btn" onClick={() => setActiveTab("doctor")}>
                        Find a Doctor
                      </button>
                    </div>
                  )}
                  {!myDoctorsLoading &&
                    myDoctors.map((d) => (
                      <div key={d._id} className="doctor-card dm-person-card">
                        <span className="dm-avatar" aria-hidden="true">
                          {(d.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="dm-person-info">
                          <h3>
                            {d.name}{" "}
                            {d.isAvailable === true && (
                              <span className="dm-status-dot" title="Available">
                                <span aria-hidden="true">●</span> Available
                              </span>
                            )}
                          </h3>
                          <p className="doctor-specialist">{d.specialist}</p>
                          {d.clinicName && <p>🏥 {d.clinicName}</p>}
                          {d.clinicLocation && <p>📍 {d.clinicLocation}</p>}
                        </div>
                        <div className="dm-card-actions">
                          <button type="button" className="doctor-connect-btn" onClick={() => handleOpenMyDoctorChat(d)}>
                            Chat with Doctor
                          </button>
                          <button type="button" className="doctor-appt-btn" onClick={() => setAppointmentDoctor(d)}>
                            📅 Get Appointment
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="chatbox">
                  <p style={{ margin: 0, color: "var(--color-text)", fontWeight: 600, fontSize: "15px" }}>
                    Which type of doctor do you need?
                  </p>
                  <select
                    className="doctor-select"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="">Select specialty</option>
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button type="button" className="doctor-find-btn" onClick={handleFindNearbyDoctors} disabled={doctorLoading}>
                    {doctorLoading ? "Searching..." : "Find Doctors"}
                  </button>
                  {doctorMessage && <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "14px" }}>{doctorMessage}</p>}
                  {doctorSearched && !doctorLoading && doctors.length > 0 && (
                    doctors.map((d) => {
                      const alreadyConnected = myDoctors.some((md) => String(md._id) === String(d._id));
                      const isConnecting = connectingId === String(d._id);
                      return (
                        <div key={d._id} className="doctor-card">
                          <h3>{d.name}</h3>
                          <p className="doctor-specialist">{d.specialist}</p>
                          <p>🏥 {d.clinicName}</p>
                          <p>📍 {d.clinicLocation}</p>
                          {d.distanceKm !== undefined && <p>📌 {d.distanceKm} km away</p>}
                          <button
                            type="button"
                            className="doctor-connect-btn"
                            onClick={() => handleConnectDoctor(d)}
                            disabled={alreadyConnected || isConnecting}
                          >
                            {alreadyConnected ? "Connected ✓" : isConnecting ? "Connecting..." : "Connect"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {detailMed && (
          <MedicineDetailModal
            family={familyForProduct(productForChatSnapshot(detailMed))}
            onClose={() => setDetailMed(null)}
          />
        )}
        {appointmentDoctor && (
          <AppointmentModal
            doctor={appointmentDoctor}
            onClose={() => setAppointmentDoctor(null)}
            onBooked={() => {
              // The booking already created the chat message server-side —
              // refresh the open conversation so the card appears at once.
              if (connectedDoctor && String(connectedDoctor._id) === String(appointmentDoctor._id)) {
                fetchConvoMessages(connectedDoctor._id);
              }
            }}
          />
        )}
        {alternateFor && (
          <AlternateTimeModal
            appointmentId={alternateFor}
            onClose={() => setAlternateFor(null)}
            onSuggested={() => {
              setAlternateFor(null);
              if (selectedPatient) fetchPatientConvo(selectedPatient.patientId);
            }}
          />
        )}
      </Layout>
    </div>
  );
}

export default Chat;
