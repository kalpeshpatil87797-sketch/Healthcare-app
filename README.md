# Healthcare App — Your Care Hub

Find nearby doctors, chat with an AI health assistant, consult doctors in live chat, book appointments, browse medicine information, and learn from a health library with exercise & yoga guides.

> General health information only — not a diagnosis, prescription, or substitute for professional medical care.

## Features

- **Auth:** Signup / Login (JWT, 7-day expiry), Forgot / Reset password via email link (15-min expiry), protected routes
- **AI Health Chat:** Symptom → structured guidance (Possible Condition, Why This Happens, Home Precautions, Which Doctor, Urgent Help)
- **Doctor Discovery:** Specialty search + geolocation-based nearby doctors (10 km default, 2dsphere `$geoNear`)
- **Patient–Doctor Chat:** Text + image (JPG/PNG/WebP, 5 MB) + PDF (10 MB) attachments, connection-gated conversations
- **Appointments:** Date picker + morning/afternoon slots, patient booking, doctor accept / reject / alternate-time, patient accept-alternate / cancel, auto appointment card in chat
- **Medicine Directory (frontend-only):** 15 categories, ingredient → brand-family grouping, search, detail modal, doctor-only `/med/` autocomplete in chat (medicine cards, no dosage)
- **Health Library (frontend-only):** 8 categories + 16 health topics + 20 exercises/yoga poses with steps, goals filter, and safety notes
- **Profiles & Roles:** Patient / Doctor roles, doctor registration upgrades role, location save

## Tech Stack

**Frontend (`/frontend`):**
React 19.2.8, React-DOM 19.2.8, Vite 8.2.0, react-router-dom 7.18.2, axios 1.19.0. Custom CSS only (no UI framework). State: React hooks + `localStorage` JWT.

**Backend (`/backend`):**
Node.js + Express 4.18.2, Mongoose 6.9.0, jsonwebtoken 9.0.2, bcrypt 6.0.0, multer 1.4.5-lts.1, cors 2.8.5, helmet 8.3.0, express-mongo-sanitize 2.2.0, express-rate-limit 8.6.2, dotenv 16.4.5, nodemailer 6.9.13, @google/generative-ai 0.24.1 (installed; actual AI call uses REST `fetch`).

**Database:** MongoDB (`Signup_data`), Mongoose ODM. Models: `user`, `doctor` (2dsphere), `message`, `appointment` (partial unique slot index), `connection`.

**External services:** Google Gemini REST, Gmail SMTP (Nodemailer), OpenStreetMap Nominatim reverse-geocode (no key, frontend only).

## Project Structure

```
Healthcare-app/
  frontend/
    index.html  vite.config.js  package.json
    src/
      main.jsx  App.jsx
      components/ Layout, Navbar, Sidebar, ProtectedRoute,
                  AppointmentModal, AppointmentCard, AlternateTimeModal,
                  MedicineDetailModal, HealthTopicModal, ExerciseDetailModal
      pages/ Landing, Signup, Login, ForgotPassword, ResetPassword,
             Home (/dashboard), chat (/chat), Look (/look), Medicine (/medicine),
             ImDoctor, NearbyDoctors, Profile
      admin/ Admin access gate, overview, users, doctor review, appointments
      data/ medicines.js  healthLibrary.js
      utils/ specialties.js  location.js  theme.js
  backend/
    index.js  connect.js  .env
    routes/ user, doctor, message, appointment, admin
    controllers/ user, doctor, message, appointment, admin
    models/ user, doctor, message, appointment, connection, adminActionLock
    middlewares/ auth, upload, rateLimiter
    utils/ aiService, sendEmail, appointmentSlotLock
    scripts/ bootstrap-super-admin
    uploads/
```

Routes (frontend): `/`, `/signup`, `/login`, `/forgot-password`, `/reset-password/:token`, `/dashboard`, `/chat`, `/look`, `/medicine`, `/im-doctor`, `/nearby-doctors`, `/profile`, `/admin`.

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (default `mongodb://localhost:27017/Signup_data`)
- Gmail app password (for reset emails) + Gemini API key (for AI chat)

### 1. Backend
```bash
cd backend
npm install
# create .env (see below)
npm start   # nodemon index.js -> http://localhost:8001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev   # -> http://localhost:5173
```

Build: `npm run build` / `npm run preview`. Lint: `npm run lint`.

## Environment Variables (`backend/.env`)

Create `backend/.env` with these variable names:

```
MONGODB=
JWT_SECRET=
EMAIL_USER=
EMAIL_PASS=
CLIENT_URL=
GEMINI_API_KEY=
```

- `MONGODB` — Mongo connection string (fallback `mongodb://localhost:27017/Signup_data`)
- `JWT_SECRET` — JWT signing secret
- `EMAIL_USER` / `EMAIL_PASS` — Gmail SMTP credentials for reset emails
- `CLIENT_URL` — frontend URL, e.g. `http://localhost:5173`
- `GEMINI_API_KEY` — Google Gemini API key
- `SUPER_ADMIN_EMAIL` — optional, used only by the one-time Super Admin bootstrap script

The backend refuses to start without `JWT_SECRET`; provide a private, strong value in the local environment. Never use a public/default signing key or commit environment files.

Never commit `.env`. Only variable names are listed here — no values.

## API Overview

Base: `http://localhost:8001`. Auth: `Authorization: Bearer <JWT>` (except signup/login/forgot/reset).

```
POST /user/signup {name,email,password,age,phone,address,latitude?,longitude?}
POST /user/login {email,password} (rate-limited 10/15min)
POST /user/forgot-password {email}
POST /user/reset-password/:token {password}
GET  /user/me
PUT  /user/location {latitude,longitude}

POST /doctor/register {name,clinicName,degree,specialist,clinicLocation,latitude?,longitude?}
GET  /doctor/nearby?latitude&longitude&radiusKm=10&specialty?
POST /doctor/connect {doctorId}
GET  /doctor/my-patients (doctor)  GET /doctor/my-doctors (patient)

POST /message/send {text,doctorId?,patientId?(doctor side),type?,medicine?,medicines?} (+ optional file)
GET  /message/all[?doctorId&patientId?]

POST  /appointment/book {doctorId,appointmentDate:YYYY-MM-DD,appointmentTime:"09:00 AM"}
GET   /appointment/mine (patient)  GET /appointment/doctor (doctor)
PATCH /appointment/:id/respond {action:accept|reject|alternate,alternateDate?,alternateTime?}
PATCH /appointment/:id/cancel (patient, pending only)
PATCH /appointment/:id/accept-alternate (patient)

Super Admin endpoints (all require a valid session for an active `super_admin`
account): `GET /admin/stats`, `GET /admin/users`, `GET /admin/users/:id`,
`PATCH /admin/users/:id/status`, `GET /admin/doctors`, `GET /admin/doctors/:id`,
`PATCH /admin/doctors/:id/approval`, `GET /admin/appointments`, and
`PATCH /admin/appointments/:id/status`.
```

Uploads: `multipart/form-data` field `file`, served at `GET /uploads/*`.

## Key Implementation Notes

- **AI:** `backend/utils/aiService.js` + `controllers/message.js`. AI runs only for doctor-less messages. System prompt enforces 5-section format and exactly one specialty from the 15-item allowlist shared with `frontend/src/utils/specialties.js`.
- **Location:** `navigator.geolocation` → `GET /doctor/nearby` → `$geoNear` (distance in km, max 50 results). No map SDK.
- **Chat realtime:** No WebSocket — REST + refetch after each action.
- **Medicine `/med/`:** `pages/chat.jsx` `DoctorMedComposer` — `/med/` → categories → `/med/<Category>/` → products. Sends `type:"medicine"` snapshot; backend whitelists display fields only.
- **Slots:** `AppointmentModal.jsx` `MORNING_SLOTS` / `AFTERNOON_SLOTS` (12 × 30-min). Backend validates `YYYY-MM-DD` + `hh:mm AM/PM`, rejects past dates, 409 on occupied slot.

## Important Dependencies

Frontend: `react ^19.2.8`, `react-dom ^19.2.8`, `react-router-dom ^7.18.2`, `axios ^1.19.0`, `vite ^8.2.0`, `@vitejs/plugin-react ^6.0.4`.

Backend: `express ^4.18.2`, `mongoose ^6.9.0`, `jsonwebtoken ^9.0.2`, `bcrypt ^6.0.0`, `multer ^1.4.5-lts.1`, `cors ^2.8.5`, `helmet ^8.3.0`, `express-mongo-sanitize ^2.2.0`, `express-rate-limit ^8.6.2`, `dotenv ^16.4.5`, `nodemailer ^6.9.13`, `@google/generative-ai ^0.24.1`.

## Architecture

```
React (5173) --axios REST/JWT--> Express API (8001) --> MongoDB (Signup_data)
                                          |---> Gemini REST (AI chat)
                                          |---> Gmail SMTP (reset emails)
                                          |---> Local uploads/ (/uploads static)
React --fetch--> OSM Nominatim (reverse-geocode, no key)
```

## Super Admin demo checklist

1. Start MongoDB and the backend with a configured `JWT_SECRET`, then start the frontend.
2. Create a normal account, set `SUPER_ADMIN_EMAIL` to its exact login email in the backend environment, and run `node scripts/bootstrap-super-admin.js` from `backend`.
3. Sign in with that account and confirm it opens `/admin`; check Overview, Users, Doctor verification, and Appointments navigation and refresh.
4. Suspend a disposable test account. Confirm it cannot log in or use its existing token; reactivate it and confirm the old token remains revoked until the user signs in again.
5. Submit a doctor registration as a separate account. Confirm it is pending and unavailable, then approve it as Super Admin. Repeat with a separate registration and reject it with a reason.
6. As a patient connected to an approved, available doctor, book a slot; verify the doctor can accept, reject, or propose an alternate, the patient can accept/cancel the supported state, and the chat appointment card reflects the latest status.
7. Try `/admin` and each `/admin/*` endpoint without a token, with a patient/doctor token, with a suspended admin, and with a revoked token. Confirm none can read or mutate admin data.

The automated checks available in this repository are frontend build/lint and backend syntax checks. Runtime API behavior, database-backed state changes, and concurrent-slot contention still require a running MongoDB and server; they were not exercised as part of the local build checks. Do not use production records for the manual workflow.

## Disclaimer

Educational project. Medicine / library / AI content is general information only. Always consult a qualified professional for diagnosis and treatment.
