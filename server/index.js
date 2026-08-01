require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createDatabase } = require("./database");

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const SALT_ROUNDS = 10;

const db = createDatabase();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function signToken(userRow) {
  return jwt.sign(
    {
      sub: userRow.id,
      university_id: userRow.university_id,
      full_name: userRow.full_name,
      role: userRow.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    next();
  };
}

function getUserRow(id) {
  return db.prepare("SELECT id, university_id, full_name, role FROM users WHERE id = ?").get(id);
}

function addNotification(userId, title, message) {
  db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)").run(
    userId,
    title,
    message
  );
}

// --- Auth ---
app.post("/api/auth/register", (req, res) => {
  const { university_id, full_name, password, role } = req.body || {};
  const uid = typeof university_id === "string" ? university_id.trim() : "";
  const name = typeof full_name === "string" ? full_name.trim() : "";
  const pw = typeof password === "string" ? password : "";

  if (!uid || !name || !pw || !role) {
    return res.status(400).json({ error: "university_id, full_name, password, and role are required." });
  }
  const validRoles = ["student", "faculty", "doctor", "pharmacist"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  if (role === "doctor") {
    const doc = db.prepare("SELECT id FROM doctors WHERE name = ?").get(name);
    if (!doc) {
      db.prepare("INSERT INTO doctors (name, specialty, slots_json) VALUES (?, ?, ?)").run(
        name,
        "General Physician",
        JSON.stringify(["09:00", "11:00", "14:00", "16:00"])
      );
    }
  }

  const existing = db.prepare("SELECT id FROM users WHERE university_id = ?").get(uid);
  if (existing) {
    return res.status(409).json({ error: "University ID is already registered." });
  }

  const password_hash = bcrypt.hashSync(pw, SALT_ROUNDS);
  const info = db
    .prepare(
      "INSERT INTO users (university_id, full_name, role, password_hash) VALUES (?, ?, ?, ?)"
    )
    .run(uid, name, role, password_hash);

  const userRow = getUserRow(info.lastInsertRowid);
  const token = signToken(userRow);
  res.status(201).json({ token, user: userRow });
});

app.post("/api/auth/login", (req, res) => {
  const { university_id, password } = req.body || {};
  const uid = typeof university_id === "string" ? university_id.trim() : "";
  const pw = typeof password === "string" ? password : "";
  if (!uid || !pw) {
    return res.status(400).json({ error: "university_id and password are required." });
  }

  const row = db.prepare("SELECT * FROM users WHERE university_id = ?").get(uid);
  if (!row || !bcrypt.compareSync(pw, row.password_hash)) {
    return res.status(401).json({ error: "Invalid university ID or password." });
  }

  const userRow = getUserRow(row.id);
  const token = signToken(userRow);
  res.json({ token, user: userRow });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const row = getUserRow(req.user.sub);
  if (!row) return res.status(404).json({ error: "User not found." });
  res.json({ user: row });
});

// --- Doctors (directory + slots) ---
app.get("/api/doctors", authMiddleware, (_req, res) => {
  const rows = db.prepare("SELECT id, name, specialty, slots_json FROM doctors ORDER BY name").all();
  const doctors = rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    specialty: r.specialty,
    slots: JSON.parse(r.slots_json)
  }));
  res.json({ doctors });
});

// --- Appointments ---
app.get("/api/appointments", authMiddleware, (req, res) => {
  const user = getUserRow(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  let rows;
  if (user.role === "doctor") {
    rows = db
      .prepare(
        `SELECT a.id, a.appointment_date, a.time_slot, a.status, a.created_at,
                u.university_id AS patient_university_id, d.name AS doctor_name
         FROM appointments a
         JOIN users u ON u.id = a.user_id
         JOIN doctors d ON d.id = a.doctor_id
         WHERE d.name = ? AND a.appointment_date >= date('now', '-365 day')
         ORDER BY a.appointment_date, a.time_slot`
      )
      .all(user.full_name);
  } else if (user.role === "student" || user.role === "faculty") {
    rows = db
      .prepare(
        `SELECT a.id, a.appointment_date, a.time_slot, a.status, a.created_at,
                u.university_id AS patient_university_id, d.name AS doctor_name
         FROM appointments a
         JOIN users u ON u.id = a.user_id
         JOIN doctors d ON d.id = a.doctor_id
         WHERE a.user_id = ?
         ORDER BY a.appointment_date DESC, a.time_slot`
      )
      .all(user.id);
  } else {
    rows = [];
  }

  const appointments = rows.map((r) => ({
    id: r.id,
    doctor: r.doctor_name,
    date: r.appointment_date,
    time: r.time_slot,
    status: r.status,
    user: r.patient_university_id
  }));

  res.json({ appointments });
});

app.post("/api/appointments", authMiddleware, (req, res) => {
  const user = getUserRow(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (user.role !== "student" && user.role !== "faculty") {
    return res.status(403).json({ error: "Only students and faculty can book appointments." });
  }

  const { doctorId, appointment_date, time_slot } = req.body || {};
  const docId = parseInt(String(doctorId), 10);
  const date = typeof appointment_date === "string" ? appointment_date.trim() : "";
  const time = typeof time_slot === "string" ? time_slot.trim() : "";

  if (!docId || !date || !time) {
    return res.status(400).json({ error: "doctorId, appointment_date, and time_slot are required." });
  }

  const doctor = db.prepare("SELECT id, name, slots_json FROM doctors WHERE id = ?").get(docId);
  if (!doctor) {
    return res.status(400).json({ error: "Invalid doctor." });
  }

  const slots = JSON.parse(doctor.slots_json);
  if (!slots.includes(time)) {
    return res.status(400).json({ error: "Invalid time slot for this doctor." });
  }

  const taken = db
    .prepare(
      "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ?"
    )
    .get(docId, date, time);

  if (taken) {
    return res.status(409).json({ error: "That slot is already booked." });
  }

  const id = `APPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  try {
    db.prepare(
      `INSERT INTO appointments (id, user_id, doctor_id, appointment_date, time_slot, status)
       VALUES (?, ?, ?, ?, ?, 'Confirmed')`
    ).run(id, user.id, docId, date, time);
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "That slot is already booked." });
    }
    throw e;
  }

  addNotification(
    user.id,
    "Appointment confirmed",
    `Your appointment with ${doctor.name} is confirmed for ${time} on ${date}.`
  );

  const doctorUser = db.prepare("SELECT id FROM users WHERE role = 'doctor' AND full_name = ?").get(doctor.name);
  if (doctorUser) {
    addNotification(
      doctorUser.id,
      "New appointment",
      `Patient ${user.university_id} booked ${date} at ${time}.`
    );
  }

  res.status(201).json({
    appointment: {
      id,
      doctor: doctor.name,
      date,
      time,
      status: "Confirmed",
      user: user.university_id
    }
  });
});

// --- Medical records ---
app.get("/api/medical-records", authMiddleware, (req, res) => {
  const user = getUserRow(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  let rows;
  if (user.role === "doctor") {
    rows = db
      .prepare(
        `SELECT m.record_date, pu.university_id AS patient,
                m.diagnosis, m.prescription, m.notes
         FROM medical_records m
         JOIN users pu ON pu.id = m.patient_user_id
         ORDER BY m.record_date DESC`
      )
      .all();
  } else {
    rows = db
      .prepare(
        `SELECT m.record_date, pu.university_id AS patient,
                m.diagnosis, m.prescription, m.notes
         FROM medical_records m
         JOIN users pu ON pu.id = m.patient_user_id
         WHERE m.patient_user_id = ?
         ORDER BY m.record_date DESC`
      )
      .all(user.id);
  }

  res.json({ records: rows });
});

app.post("/api/medical-records", authMiddleware, requireRole("doctor", "student", "faculty"), (req, res) => {
  const user = getUserRow(req.user.sub);
  const { patient_university_id, record_date, diagnosis, prescription, notes } = req.body || {};
  
  let pid;
  let doctorId = null;

  if (user.role === "doctor") {
    pid = typeof patient_university_id === "string" ? patient_university_id.trim() : "";
    doctorId = user.id;
  } else {
    pid = user.university_id;
  }

  const d = typeof record_date === "string" ? record_date.trim() : "";
  if (!pid || !d) {
    return res.status(400).json({ error: "patient_university_id and record_date are required." });
  }

  const patient = db.prepare("SELECT id FROM users WHERE university_id = ?").get(pid);
  if (!patient) {
    return res.status(400).json({ error: "No user found with that university ID." });
  }

  const info = db
    .prepare(
      `INSERT INTO medical_records (patient_user_id, doctor_user_id, record_date, diagnosis, prescription, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      patient.id,
      doctorId,
      d,
      diagnosis || "",
      prescription || "",
      notes || ""
    );

  if (user.role === "doctor") {
    addNotification(
      patient.id,
      "Medical record added",
      `A new visit was recorded on ${d}${diagnosis ? `: ${diagnosis}` : ""}.`
    );
  }

  res.status(201).json({ id: info.lastInsertRowid });
});

// --- Inventory ---
app.get("/api/inventory", authMiddleware, requireRole("doctor", "pharmacist"), (_req, res) => {
  const rows = db.prepare("SELECT id, name, quantity, threshold FROM medicines ORDER BY name").all();
  res.json({ items: rows });
});

app.patch("/api/inventory/:id", authMiddleware, requireRole("pharmacist"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const quantity = Number(req.body?.quantity);
  if (!id || Number.isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Valid medicine id and non-negative quantity required." });
  }

  const med = db.prepare("SELECT id, name FROM medicines WHERE id = ?").get(id);
  if (!med) return res.status(404).json({ error: "Medicine not found." });

  db.prepare("UPDATE medicines SET quantity = ? WHERE id = ?").run(quantity, id);

  const user = getUserRow(req.user.sub);
  addNotification(user.id, "Stock updated", `${med.name} stock set to ${quantity}.`);

  res.json({ ok: true, id, quantity });
});

// --- Hospitals & referrals ---
app.get("/api/hospitals", authMiddleware, (_req, res) => {
  const rows = db.prepare("SELECT id, name, facility, contact FROM hospitals ORDER BY name").all();
  res.json({ hospitals: rows });
});

app.post("/api/referrals", authMiddleware, requireRole("doctor", "pharmacist"), (req, res) => {
  const user = getUserRow(req.user.sub);
  const hospitalId = parseInt(String(req.body?.hospital_id), 10);
  const patient_id = req.body?.patient_id;

  if (!hospitalId || !patient_id) {
    return res.status(400).json({ error: "hospital_id and patient_id are required." });
  }

  const patient = db.prepare("SELECT * FROM users WHERE university_id = ?").get(patient_id);
  if (!patient) return res.status(404).json({ error: "Patient not found." });

  const hospital = db.prepare("SELECT * FROM hospitals WHERE id = ?").get(hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found." });

  db.prepare("INSERT INTO referrals (user_id, hospital_id) VALUES (?, ?)").run(patient.id, hospitalId);

  addNotification(
    patient.id,
    "Emergency Referral",
    `Emergency referral logged for ${hospital.name} by ${user.full_name}. Contact: ${hospital.contact}.`
  );

  res.status(201).json({
    referral: {
      hospital: hospital.name,
      facility: hospital.facility,
      contact: hospital.contact,
      patient: patient.university_id
    }
  });
});

// --- Notifications ---
app.get("/api/notifications", authMiddleware, (req, res) => {
  const user = getUserRow(req.user.sub);
  const rows = db
    .prepare(
      `SELECT id, title, message, created_at FROM notifications
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 100`
    )
    .all(user.id);

  res.json({ notifications: rows });
});

// Static frontend (open http://localhost:PORT after starting the server)
const root = path.join(__dirname, "..");
app.use(express.static(root));

const server = app.listen(PORT, () => {
  console.log(`UDMS server listening at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use (another app or an old server is still running).\n` +
        `Close that process, or start on a different port:\n` +
        `  PowerShell: $env:PORT=3001; npm run dev\n` +
        `  cmd.exe:      set PORT=3001&& npm run dev`
    );
    process.exit(1);
  }
  throw err;
});
