# Carepath: University Dispensary Management System (UDMS)

A comprehensive, role-based platform designed to streamline dispensary operations at universities. Carepath manages everything from student appointments to inventory and hospital referrals, backed by a lightweight Express.js API and built-in SQLite database.

**Disclaimer:** Educational and portfolio use only. The data and hospitals provided are for demonstration purposes.

## Features
- **Role-based Dashboards** — Distinct interfaces and permissions for Students, Faculty, Doctors, and Pharmacists.
- **Appointment Booking** — Students/Faculty can book available slots with doctors; doctors can manage their schedules.
- **Medical Records & Prescriptions** — Doctors can add diagnoses and prescriptions, which patients can securely view.
- **Inventory Management** — Pharmacists track medicine quantities and receive alerts for low stock thresholds.
- **Emergency Referrals** — Quick referral system to external hospitals with automated notifications to patients.
- **In-App Notifications** — Alerts for appointment confirmations, referrals, and stock updates.

## Tech stack
| Layer | Choice |
| --- | --- |
| **UI** | HTML5, CSS, JavaScript |
| **Server** | Express.js (Node.js) |
| **Database** | SQLite (`node:sqlite`) |
| **Auth** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Config** | `dotenv` (`.env`) |

## Repository layout
```text
Carepath/
├── index.html          # Main application UI
├── styles.css          # CSS styling
├── script.js           # Frontend logic and API integration
├── server/
│   ├── index.js        # Express server entrypoint & API routes
│   └── database.js     # SQLite connection, migrations, and seeding
├── data/               # SQLite database directory (auto-generated, ignored by Git)
├── .env.example        # Environment variables template
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```

## Prerequisites
- **Node.js 22.5.0+** (Required for the built-in `node:sqlite` module)
- **Git**

## Quick start

### 1. Clone and install dependencies
```bash
git clone https://github.com/YOUR-USERNAME/Carepath.git
cd Carepath
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
```
Edit `.env` and configure your `PORT` (default 3000), `JWT_SECRET`, and `DB_PATH` if needed.

### 3. Start the server
The server automatically initializes the SQLite database (creating the schema and seeding default medicines/hospitals) when it starts.

```bash
npm start
```
*(For development with hot-reloading)*:
```bash
npm run dev
```

### 4. Run the app
Open your browser and navigate to the URL shown in the terminal (typically [http://localhost:3000](http://localhost:3000)).

## How the system works (short)
- **Database Initialization:** On startup, `database.js` checks for the SQLite database. If missing, it creates it, runs migrations, and inserts default dummy data (medicines and hospitals).
- **Authentication:** Users register/login based on their University ID and role. The server returns a JWT token which is stored in `localStorage` and sent in the `Authorization` header for subsequent API calls.
- **Role Permissions:** API endpoints check the user's role encoded in the JWT token (e.g., only pharmacists can update inventory, only doctors can prescribe).
- **Notifications:** Key actions (booking an appointment, updating stock, creating a referral) automatically trigger an insert into the `notifications` table, which the user can view from their dashboard.

## Configuration reference
| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Port for the Express server (default: 3000) |
| `JWT_SECRET` | No | Secret key for signing JSON Web Tokens |
| `DB_PATH` | No | Path to the SQLite database file (default: `./data/udms.sqlite`) |
