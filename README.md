# Healthcare App — Your Care Hub

Find nearby doctors, chat with an AI health assistant, consult doctors in live chat, book appointments, browse medicine information, and learn from a health library with exercise & yoga guides.

> General health information only — not a diagnosis, prescription, or substitute for professional medical care.

## Features

- **Auth:** Signup / Login (JWT, 7-day expiry), Forgot / Reset password via email link (15-min expiry), protected routes
- **AI Health Chat:** Symptom → structured guidance (Possible Condition, Why This Happens, Home Precautions, Which Doctor, Urgent Help)
- **Doctor Discovery:** Specialty search + geolocation-based nearby doctors (10 km default, 2dsphere `$geoNear`)
- **Patient–Doctor Chat:** Text + image (JPG/PNG/WebP, 5 MB) + PDF (10 MB) attachments, connection-gated conversations
- **Appointments:** Instant patient confirmation from doctor-configured availability, visit reasons, cancellation/rescheduling/completion, appointment history, and linked chat cards
- **Medicine Directory (frontend-only):** 15 categories, ingredient → brand-family grouping, search, detail modal, doctor-only `/med/` autocomplete in chat (medicine cards, no dosage)
- **Health Library (frontend-only):** 8 categories + 16 health topics + 20 exercises/yoga poses with steps, goals filter, and safety notes
- **Profiles & Roles:** Patient / Doctor roles, Admin / Root Owner dashboard access, doctor registration upgrades role, location save

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
                  AppointmentModal, AppointmentDashboard, AppointmentCard,
                  AlternateTimeModal,
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
    utils/ aiService, sendEmail, appointmentAvailability, appointmentSlotLock
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
ROOT_OWNER_EMAIL=
ROOT_OWNER_CONFIRM=
MIGRATE_SUPER_ADMINS=
MIGRATE_SUPER_ADMINS_CONFIRM=
```

- `MONGODB` — Mongo connection string (fallback `mongodb://localhost:27017/Signup_data`)
- `JWT_SECRET` — JWT signing secret
- `EMAIL_USER` / `EMAIL_PASS` — Gmail SMTP credentials for reset emails
- `CLIENT_URL` — frontend URL, e.g. `http://localhost:5173`
- `GEMINI_API_KEY` — Google Gemini API key
- `ROOT_OWNER_EMAIL` — exact email of the previously verified account to designate
- `ROOT_OWNER_CONFIRM` — explicit confirmation string required to apply owner setup
- `MIGRATE_SUPER_ADMINS` — optional `true` to explicitly migrate verified legacy accounts
- `MIGRATE_SUPER_ADMINS_CONFIRM` — exact confirmation required for legacy migration

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

GET   /doctor/:id/availability?date=YYYY-MM-DD (bookable slots for an approved, active doctor)
GET   /doctor/availability (doctor's own settings)
PUT   /doctor/availability {slotDurationMinutes,workingHours,breaks,blockedDates,unavailablePeriods}
POST  /appointment/book {doctorId,appointmentDate:YYYY-MM-DD,appointmentTime:"09:00 AM",visitReason}
GET   /appointment/mine (patient)  GET /appointment/doctor (doctor)
PATCH /appointment/:id/cancel (patient or assigned doctor, before start)
PATCH /appointment/:id/reschedule {appointmentDate,appointmentTime}
PATCH /appointment/:id/complete (assigned doctor, after start)
PATCH /appointment/:id/respond and /appointment/:id/accept-alternate (legacy pending requests)

Admin endpoints (all require a current database-backed session for an active
`admin` or `root_owner` account): `GET /admin/stats`, `GET /admin/users`,
`GET /admin/users/:id`, `PATCH /admin/users/:id/status`,
`PATCH /admin/users/:id/role` (Root Owner only),
`GET /admin/doctors`, `GET /admin/doctors/:id`,
`PATCH /admin/doctors/:id/approval`, `GET /admin/appointments`, and
`PATCH /admin/appointments/:id/status`.
```

Doctor registration is stored on the user's existing doctor profile. Reapplying
after removal or rejection resets the application to `pending`, records a new
submission time, and clears prior review metadata; doctor access returns only
after Admin or Root Owner approval. Legacy profiles without an approval status
remain approved unless their explicit `isActive` removal flag is false.

Uploads: `multipart/form-data` field `file`, served at `GET /uploads/*`.

## Key Implementation Notes

- **AI:** `backend/utils/aiService.js` + `controllers/message.js`. AI runs only for doctor-less messages. System prompt enforces 5-section format and exactly one specialty from the 15-item allowlist shared with `frontend/src/utils/specialties.js`.
- **Location:** `navigator.geolocation` → `GET /doctor/nearby` → `$geoNear` (distance in km, max 50 results). No map SDK.
- **Chat realtime:** No WebSocket — REST + refetch after each action.
- **Medicine `/med/`:** `pages/chat.jsx` `DoctorMedComposer` — `/med/` → categories → `/med/<Category>/` → products. Sends `type:"medicine"` snapshot; backend whitelists display fields only.
- **Appointments:** New bookings are confirmed immediately using the existing `accepted` status. Doctors configure weekly hours, slot duration, breaks, date blocks, and unavailable periods; the server generates slots and excludes active appointments. A per-slot lock and the appointment model's unique partial index prevent concurrent duplicate bookings. Lifecycle changes append history and update linked chat cards. Dates follow the existing server-local calendar convention; no clinic timezone is configured.

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

## Root Owner setup and legacy migration

The application never chooses an owner or converts `super_admin` records at startup.
The unique partial index `unique_root_owner_role` and bootstrap checks enforce one
Root Owner. `super_admin` remains a read-compatible legacy value, but those accounts
cannot use the new dashboard or change roles until explicitly migrated.

Perform initial setup only during a maintenance window, with a verified owner account
and a current database backup. Stop the backend and other writers before executing
the role changes; do not use production patient data for testing.

1. Review existing roles using a read-only Mongo shell query:
   `db.users.find({ role: { $in: ["root_owner", "admin", "super_admin"] } }, { _id: 1, email: 1, role: 1, accountStatus: 1, roleBeforeSuperAdmin: 1, roleBeforeAdmin: 1 })`.
   Select the trusted owner explicitly, confirm the account identity out-of-band,
   ensure it is active, and verify that you can sign in. Do not select an account
   merely because it is the first user or already has `super_admin`.
2. Set `ROOT_OWNER_EMAIL` in the private `backend/.env` to that exact account email.
   Leave `ROOT_OWNER_CONFIRM` unset and run `node scripts/bootstrap-super-admin.js`
   from `backend`. This is a read-only preview that reports the selected masked
   account and count of legacy accounts.
3. If legacy `super_admin` accounts exist, inspect each account's saved
   `roleBeforeSuperAdmin`. The script only migrates an account when its saved role
   is explicitly `patient` or `doctor`; it refuses to infer a missing role. Resolve
   invalid/missing roles manually after reviewing the account and doctor profile:
   have the owner approve the role, update only that account's `roleBeforeSuperAdmin`
   to the verified normal role, then re-run the read-only query and independently
   verify every value before opting in to migration.
   To migrate all verified legacy accounts to operational `admin`, explicitly set
   `MIGRATE_SUPER_ADMINS=true` and
   `MIGRATE_SUPER_ADMINS_CONFIRM="MIGRATE ALL LEGACY SUPER ADMINS TO ADMIN"`.
   Leave these variables unset to preserve all legacy records unchanged.
4. After verifying the preview, set
   `ROOT_OWNER_CONFIRM="DESIGNATE ROOT OWNER <exact ROOT_OWNER_EMAIL>"` and rerun
   the script. It designates only the configured account and revokes its sessions.
   Only with the separate migration opt-in does it convert other verified legacy
   accounts to `admin`, preserving saved normal role and account status. Bootstrap
   role changes are written to the `[admin-audit]` log. If migration stops partway,
   keep the service offline, inspect remaining roles, then rerun the confirmed script.
5. Remove the one-time confirmation variables. Before restarting the backend,
   verify with read-only queries that exactly one account has `role: "root_owner"`
   and it is the selected account. Verify each migrated Admin has a correct saved
   normal role; verify other legacy records are unchanged if migration was not used.
6. Sign in as Root Owner and test role changes. Sign in as Admin and verify
   operational pages remain available while Admin Management is absent. Use
   disposable accounts for promotion, demotion, suspension, reactivation, and
   revoked-session checks.

## Admin role permissions

| Action | Root Owner | Admin |
|---|---|---|
| View/manage users, doctors, appointments | Yes | Yes |
| Suspend/reactivate normal patient/doctor accounts | Yes | Yes |
| Suspend/reactivate another Admin | Yes | No |
| Promote normal account to Admin or restore Admin role | Yes | No |
| Change Root Owner role, status, or permissions | No | No |
| Assign `root_owner` through dashboard APIs | No | No |

Doctor approval and reapplication state is database-backed. New and resubmitted
applications remain patient accounts while pending; only Admin or Root Owner
approval activates doctor access. The backend checks current database roles on
protected requests; role changes revoke existing sessions and are audited.
Runtime API behavior and database-backed concurrency still require manual
testing and were not exercised locally.

The automated checks available in this repository are frontend build/lint and backend syntax checks. Runtime API behavior, database-backed state changes, and concurrent-slot contention still require a running MongoDB and server; they were not exercised as part of the local build checks. Do not use production records for the manual workflow.

## Disclaimer

Educational project. Medicine / library / AI content is general information only. Always consult a qualified professional for diagnosis and treatment.
