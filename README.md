# 🌾 KisanSetu — किसानसेतू

**Digital Marketplace connecting Farmers directly with Verified Buyers**
Government of Maharashtra Initiative · Smart India Hackathon 2026 · Problem Statement ID: 26132

---

## Overview

KisanSetu removes middleman brokers from India's agricultural supply chain. Farmers list produce lots with grade/quantity/location, see government MSP/mandi reference prices alongside their asking price, and negotiate directly with KYC-verified buyers inside the app. A deal locks with a unique handoff token, confirmed by both parties at physical pickup, which releases escrowed payment minus a 2.5–3% platform commission.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router + Recharts |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL 15 (primary) + Redis 7 (price-feed cache) |
| ORM | Prisma 5 |
| Auth | JWT + Mobile OTP (mock — console/response) |
| Notifications | Mock SMS/WhatsApp (console + DB) |
| e-KYC | Mock Aadhaar provider (interface-ready for UIDAI) |
| Payments | Mock escrow (interface-ready for Razorpay Route) |
| i18n | react-i18next · English / Hindi / Marathi |
| Container | Docker + docker-compose |

---

## Quick Start (Docker — Recommended)

### Prerequisites
- Docker Desktop installed and running

```bash
# 1. Clone / unzip the project
cd KisaanSetu

# 2. Start everything with one command
docker-compose up --build

# 3. Backend runs on   http://localhost:4000
#    Frontend runs on  http://localhost:3000
#    API health:       http://localhost:4000/health
```

The backend automatically runs `prisma migrate deploy` and `prisma db seed` on startup. Wait ~30 seconds for the first run.

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 15 running locally
- Redis running locally (optional — app works without it)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env .env.local
# Edit .env — set DATABASE_URL and REDIS_URL

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed sample data
npx prisma db seed

# Start dev server (nodemon)
npm run dev
# → http://localhost:4000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://kisansetu:kisansetu_secret@localhost:5432/kisansetu_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL (optional) |
| `JWT_SECRET` | `kisansetu_jwt_super_secret_2026` | **Change in production** |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry |
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | `development` returns OTP in API response |
| `COMMISSION_RATE` | `0.025` | 2.5% platform commission |
| `HANDOFF_WINDOW_DAYS` | `3` | Days to confirm handoff after deal |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` (proxied to 4000) | Backend API base URL |

---

## Demo Accounts (seeded)

| Role | Mobile | Password / OTP |
|---|---|---|
| **Admin** | `9000000000` | `admin@123` (password login) |
| **Farmer 1** | `9111111111` | OTP returned in API response |
| **Farmer 2** | `9111111112` | OTP returned in API response |
| **Buyer 1** | `9222222221` | OTP returned in API response (verified) |
| **Buyer 2** | `9222222222` | OTP returned in API response (verified) |

> **Dev OTP:** In `NODE_ENV=development`, the `/api/auth/send-otp` response includes `dev_otp` field with the actual OTP. The login screen displays it automatically.

---

## Key User Flows

### 1. Farmer Flow
1. Login with mobile → OTP → JWT issued
2. Aadhaar e-KYC (mock: enter any 12-digit number)
3. Create lot — see MSP + mandi reference price + trend recommendation before publishing
4. Receive offers → Accept / Reject / Counter
5. On accept: deal token generated, escrow held, both parties notified
6. Confirm physical handoff → escrow released to farmer (minus 2.5% commission)

### 2. Buyer Flow
1. Login → OTP → e-KYC
2. Upload business proof (GST / Mandi licence / etc.) → auto-verified in dev
3. Search & filter active lots (commodity, grade, district, price range)
4. Make offer (with govt. MSP visible) → negotiate via counter-offers
5. Confirm handoff at physical pickup → payment released

### 3. Admin Flow
1. Login at `9000000000` / `admin@123`
2. Dashboard: transaction volume, avg farmer realisation vs MSP, open disputes, fraud flags
3. Resolve disputes (Release to Farmer / Refund Buyer / Partial Settlement)
4. View immutable audit log of all state changes

---

## API Endpoints Summary

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/send-otp` | Send OTP to mobile |
| POST | `/api/auth/verify-otp` | Verify OTP, issue JWT |
| POST | `/api/auth/admin-login` | Admin password login |
| GET | `/api/auth/me` | Current user |
| POST | `/api/farmers/kyc` | Aadhaar e-KYC |
| POST | `/api/farmers/lots` | Create lot |
| GET | `/api/buyers/lots/search` | Search lots with filters |
| POST | `/api/buyers/lots/:id/offers` | Make offer |
| PATCH | `/api/lots/:id/offers/:oid/accept` | Farmer accepts offer |
| PATCH | `/api/lots/:id/offers/:oid/counter` | Counter offer |
| POST | `/api/deals/:id/confirm-handoff` | Confirm physical handoff |
| POST | `/api/disputes` | Raise dispute |
| PATCH | `/api/disputes/:id/resolve` | Admin resolves dispute |
| GET | `/api/price/trend` | 30/60/90-day price trend |
| GET | `/api/price/recommendation` | Sale-window recommendation |
| GET | `/api/admin/dashboard` | Admin stats |
| GET | `/api/admin/fraud-flags` | Anomaly detection |
| GET | `/api/admin/audit-log` | Immutable audit trail |

---

## Architecture Notes

### Mock Services (Swap-in Points)

All external integrations are behind clean interfaces:

| File | Interface | Real Provider |
|---|---|---|
| `backend/src/services/mock-ekyc.js` | `verifyAadhaar(aadhaarNumber)` | UIDAI e-KYC API / Digilocker |
| `backend/src/services/mock-payment.js` | `holdEscrow / releaseEscrow / refundEscrow` | Razorpay Route |
| `backend/src/services/mock-notify.js` | `send({ channel, message, ... })` | Twilio / MSG91 / WhatsApp Business API |

### Security
- Raw Aadhaar numbers are **never** stored — only `aadhaar_verified` boolean + timestamp
- JWT authentication on all protected routes
- RBAC middleware: `FARMER` / `BUYER` / `ADMIN` roles
- Input validation (Joi) on every endpoint
- Escrow state transitions are atomic DB transactions

### Price Intelligence
- `node-cron` job runs daily at 00:05 IST to ingest mock Agmarknet prices
- Redis caches latest prices (1-hour TTL) — falls back to DB if Redis unavailable
- Sale-window recommendation compares 7-day rolling average to detect UP/DOWN/STABLE trends
- 90-day historical data seeded for 5 commodities × 3 regions each

### Audit Log
- Append-only `AuditLog` table — no updates or deletes ever
- Every deal state change, price shown at negotiation time, and dispute resolution is logged

---

## Project Structure

```
KisaanSetu/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Full data model
│   │   └── seed.js                # 90-day price data + sample users/lots/deals
│   └── src/
│       ├── index.js               # Express app entry point
│       ├── middleware/
│       │   ├── auth.js            # JWT verification
│       │   ├── rbac.js            # Role-based access control
│       │   ├── validate.js        # Joi schemas
│       │   └── error-handler.js   # Global error handler
│       ├── routes/
│       │   ├── auth.js            # OTP + JWT auth
│       │   ├── farmers.js         # Farmer profile + lot CRUD
│       │   ├── buyers.js          # Buyer profile + search + offers
│       │   ├── lots.js            # Public lots + offer management
│       │   ├── deals.js           # Deal handoff + token
│       │   ├── disputes.js        # Dispute raise + resolve
│       │   ├── price.js           # Price trend + recommendation
│       │   └── admin.js           # Admin dashboard + fraud flags
│       └── services/
│           ├── mock-ekyc.js       # Aadhaar e-KYC mock
│           ├── mock-payment.js    # Escrow hold/release/refund mock
│           ├── mock-notify.js     # SMS/WhatsApp notification mock
│           ├── price-ingestion.js # Cron + trend + recommendation
│           └── audit.js           # Immutable audit log writer
└── frontend/
    └── src/
        ├── App.jsx                # Router + auth guards
        ├── api/client.js          # Axios API client
        ├── context/AuthContext.jsx
        ├── i18n/
        │   ├── en.json            # English (fully populated)
        │   ├── hi.json            # Hindi
        │   └── mr.json            # Marathi
        ├── components/
        │   ├── Layout.jsx         # Nav + language switcher
        │   ├── StatCard.jsx
        │   ├── StatusBadge.jsx
        │   ├── Alert.jsx
        │   └── Spinner.jsx
        └── pages/
            ├── Login.jsx          # OTP auth + admin password
            ├── KycPage.jsx        # Aadhaar e-KYC
            ├── BusinessProof.jsx  # Buyer business verification
            ├── FarmerDashboard.jsx
            ├── LotCreate.jsx      # With MSP + recommendation
            ├── LotEdit.jsx
            ├── FarmerLotDetail.jsx # Accept/reject/counter offers
            ├── FarmerDeals.jsx
            ├── BuyerDashboard.jsx
            ├── LotSearch.jsx      # Filter by commodity/grade/district/price
            ├── LotDetail.jsx      # Offer + negotiation thread
            ├── BuyerOffers.jsx
            ├── BuyerDeals.jsx
            ├── DealHandoff.jsx    # Token + confirm + dispute raise
            ├── DisputeFlow.jsx
            ├── DisputeDetail.jsx  # Admin resolve panel
            ├── PriceChart.jsx     # Recharts line chart 30/60/90d
            ├── AdminDashboard.jsx # Stats + charts + fraud flags
            ├── AdminDisputes.jsx
            └── AdminAudit.jsx     # Immutable audit log viewer
```

---

## Out of Scope (MVP)

Per problem statement guardrails:
- No IoT/physical automated grading
- No real logistics booking — informational display only
- No multi-buyer live auction — single-buyer negotiation only
- No IVR voice listing
- No automated customs-duty/subsidy disbursal — export flag only

---

## Hackathon Context

- **Event:** Smart India Hackathon 2026
- **Problem Statement ID:** 26132
- **Ministry/Organisation:** Government of Maharashtra
- **Theme:** Agriculture & Rural Development
