# Campus Events: College Event Management System

A full-stack web app where students discover and register for college events, organizers create and manage them, and admins oversee everything.

**Stack:** React (Vite) · Node.js + Express · MongoDB (Mongoose) · JWT auth · Git/GitHub

- Live app: `<paste your Render URL here>`
- Repository: `<paste your GitHub URL here>`

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | student@college.edu | Student@123 |
| Organizer | organizer@college.edu | Organizer@123 |
| Admin | admin@college.edu | Admin@123 |

The login page has one-click buttons that fill these in.

## Features

| Requirement | What's implemented |
|---|---|
| **Authentication** | Sign up / log in with hashed passwords (bcrypt) and JWT sessions; three roles (student, organizer, admin); role-based route protection on both API and UI |
| **CRUD** | Events: create, read, update, delete (owner or admin only). Users: list, change role, delete (admin). Registrations: create and cancel |
| **Search** | Debounced text search across title, description and venue (regex-escaped) |
| **Filtering & sorting** | Category, upcoming/past/all, date range, "open seats only", sort by date or popularity, pagination. Filters live in the URL so views are shareable |
| **Dashboards** | Student: upcoming/past registrations. Organizer: events, registrations, fill rate, attendee lists with CSV export. Admin: platform totals, events-by-category chart, most popular events |
| **Business rules** | Capacity enforced atomically (no overbooking under concurrent requests), one registration per person, no registering for cancelled/ended events, capacity can't drop below current registrations |
| **Quality** | Server-side validation with per-field errors, centralized error handling, Helmet + CORS + auth rate limiting, CSV formula-injection guard, accessible forms, responsive layout |

## Project structure

```
client/                 React app (Vite)
  src/pages/            Events, EventDetail, EventForm, Attendees, Dashboard, AdminUsers, Auth
  src/components/       Layout, EventCard, ProtectedRoute, shared UI
server/
  src/models/           User, Event, Registration
  src/controllers/      auth, events, registrations, dashboard, admin
  src/routes/           REST routes (mounted at /api)
  src/middleware/       JWT auth + roles, error handler
  src/seed.js           Demo data
  tests/api.test.js     39 integration tests (Jest + Supertest, real MongoDB)
render.yaml             One-click Render blueprint
```

## Run locally

Prerequisites: Node 18+ and MongoDB running locally (or a free MongoDB Atlas cluster).

```bash
git clone <your-repo-url> && cd <repo>
npm run install:all

cp server/.env.example server/.env        # edit MONGODB_URI / JWT_SECRET if needed
npm run seed                              # optional: load demo users and events

npm run dev:server                        # API on http://localhost:5000
npm run dev:client                        # UI on  http://localhost:5173 (proxies /api)
```

Production-style (single process serving the built UI): `npm run build && npm start`, then open http://localhost:5000.

## Tests

```bash
npm test
```

Runs 39 API integration tests against a real MongoDB (`mongodb://127.0.0.1:27017/cems_test` by default; override with `MONGODB_URI_TEST`). They cover auth, role permissions, CRUD, validation, search/filter/sort/pagination, capacity limits (including a concurrent-registration race), attendee export, dashboards and admin operations. The test database is dropped when the run finishes.

## API overview

| Method & path | Access | Purpose |
|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | public | Create account / log in |
| `GET /api/auth/me`, `PUT /api/auth/me` | user | Current profile |
| `GET /api/events` | public | List with `q, category, when, from, to, available, sort, page, limit` |
| `GET /api/events/:id` | public | Event details (+ `isRegistered`, `canManage`) |
| `POST /api/events` | organizer, admin | Create |
| `PUT/DELETE /api/events/:id` | owner, admin | Update / delete |
| `POST/DELETE /api/events/:id/register` | user | Register / cancel |
| `GET /api/events/:id/attendees(.csv)` | owner, admin | Attendee list / CSV |
| `GET /api/registrations/mine` | user | My registrations |
| `GET /api/dashboard` | user | Role-specific dashboard data |
| `GET /api/admin/users`, `PATCH .../:id/role`, `DELETE .../:id` | admin | User management |

## Deploy (Render + MongoDB Atlas, free tiers)

The API serves the built React app, so one Render web service hosts everything.

1. **Database:** create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas). Add a database user, and under *Network Access* allow `0.0.0.0/0` (Render's free tier has no fixed IP). Copy the connection string (`mongodb+srv://...`) and add a database name, e.g. `.../college_events`.
2. **Push to GitHub** (see below).
3. **Render:** *New → Blueprint* (or *New → Web Service*) and select the repo. With the blueprint, `render.yaml` supplies the settings. Manually, use Build `npm run build`, Start `npm start`, health check `/api/health`.
4. Set environment variables: `MONGODB_URI` (Atlas string), `JWT_SECRET` (long random string; the blueprint generates one), optionally `ADMIN_EMAIL` / `ADMIN_PASSWORD` (guarantees an admin account on boot), and `SEED_DEMO_DATA=true` to fill an empty database with sample data.
5. Deploy, open the URL, and log in with a demo account. Free instances sleep when idle, so the first request after a pause takes about 30 seconds.

After your demo or submission, set `SEED_DEMO_DATA` to `false`, since the demo accounts have public passwords.

## Push to GitHub

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Design notes and limits

- Anyone can sign up as a student or an organizer; admins are created via `ADMIN_EMAIL`/`ADMIN_PASSWORD` or the seed script and can change roles. A production system would likely add organizer approval.
- Seat counts are kept on the event and updated with an atomic conditional write, which avoids transactions (so it works on a standalone MongoDB as well as Atlas).
- The JWT is stored in `localStorage` for simplicity; httpOnly cookies are the stricter alternative.
