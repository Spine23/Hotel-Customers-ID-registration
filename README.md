# Hotel Guest ID Capture + Security Receiver (MVP)

This is a complete, ready-to-run full-stack project:
- **Hotel PWA** (camera capture, timestamp overlay, daily send)
- **Security Receiver Dashboard** (reports list, detail, image viewer)
- **Backend API** (Node + Express + SQLite + Multer)

## Quick Start (Local)
```bash
# 1) Install deps
npm install

# 2) Initialize database
npm run init:db

# 3) Start the app
npm run dev
# Server: http://localhost:4000
# Hotel App:     http://localhost:4000/hotel
# Security App:  http://localhost:4000/security
```

## Deploy to Render (Free)
1. Create a new **Web Service** on Render.
2. Repository root is this project.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add a **Persistent Disk** (optional) if you want uploads saved between deploys.
6. Add environment variables:
```
PORT=10000              # Render sets its own; leave empty to use theirs
DATABASE_URL=./data/app.db
UPLOAD_DIR=./uploads
STATIC_HOTEL_PATH=./client-hotel
STATIC_SECURITY_PATH=./client-security
ALLOWED_ORIGINS=https://<your-render-domain>
```
7. Open:
   - `https://<your-render-domain>/hotel`
   - `https://<your-render-domain>/security`

## Play Store
Wrap the Hotel PWA as a TWA (Trusted Web Activity) or use Capacitor to ship as an Android app.

## API (MVP)
- `GET /api/v1/health` → `{ ok: true }`
- `POST /api/v1/reports/begin` `{ hotelCode, hotelName, reportDate }` → `{ reportId, status }`
- `POST /api/v1/images` (multipart/form-data) fields: `reportId, hotelCode, reportDate, capturedAtISO, overlayText, image`
- `POST /api/v1/reports/finalize` `{ reportId }` → `{ status, totalCount, reportId }`
- `GET /api/v1/reports?date=YYYY-MM-DD&hotelCode=52`
- `GET /api/v1/reports/:id`
- `GET /api/v1/reports/:id/manifest`
- `GET /uploads/*` (serves uploaded images for demo)

> **Note:** This MVP has no auth (for simplicity). Add JWT before going to production.
"# Hotel-Customers-ID-registration" 
