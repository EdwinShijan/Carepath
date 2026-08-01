const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function getDbPath() {
  const custom = process.env.DB_PATH;
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(__dirname, "..", custom);
  }
  return path.join(__dirname, "..", "data", "udms.sqlite");
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'doctor', 'pharmacist')),
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      specialty TEXT NOT NULL,
      slots_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      UNIQUE (doctor_id, appointment_date, time_slot)
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_user_id INTEGER NOT NULL,
      doctor_user_id INTEGER,
      record_date TEXT NOT NULL,
      diagnosis TEXT,
      prescription TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_user_id) REFERENCES users(id),
      FOREIGN KEY (doctor_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL,
      threshold INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      facility TEXT NOT NULL,
      contact TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records(patient_user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
}

function seed(db) {
  const medCount = db.prepare("SELECT COUNT(*) AS c FROM medicines").get().c;
  if (medCount === 0) {
    const insertMed = db.prepare(
      "INSERT INTO medicines (name, quantity, threshold) VALUES (?, ?, ?)"
    );
    [
      ["Paracetamol", 42, 10],
      ["Cough Syrup", 12, 6],
      ["Amoxicillin", 5, 8],
      ["Antihistamine", 22, 10]
    ].forEach((row) => insertMed.run(...row));
  }

  const hospCount = db.prepare("SELECT COUNT(*) AS c FROM hospitals").get().c;
  if (hospCount === 0) {
    const insertH = db.prepare(
      "INSERT INTO hospitals (name, facility, contact) VALUES (?, ?, ?)"
    );
    [
      ["City General Hospital", "Emergency, ICU, Labs", "+91 98765 43210"],
      ["Northside Medical Center", "Trauma, Radiology", "+91 87654 32109"],
      ["Green Valley Hospital", "Cardiology, Pediatrics", "+91 76543 21098"]
    ].forEach((row) => insertH.run(...row));
  }
}

function createDatabase() {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  seed(db);
  return db;
}

module.exports = { createDatabase, getDbPath };
