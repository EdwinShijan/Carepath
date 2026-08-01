/** Relative API base — run the site via `npm start` so requests hit the Express server */
const API_BASE = "";

let authToken = sessionStorage.getItem("udms_token") || null;
/** @type {{ role: string, userId: string, userName: string, numericId?: number } | null} */
let currentUser = null;

/** Loaded from GET /api/doctors after login */
let doctorsCatalog = [];

const loginModal = document.getElementById("login-modal");
const btnOpenLogin = document.getElementById("btn-open-login");
const closeLogin = document.getElementById("close-login");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const dashboard = document.getElementById("dashboard");
const profileName = document.getElementById("profile-name");
const profileRole = document.getElementById("profile-role");
const mainTitle = document.getElementById("main-title");
const mainDescription = document.getElementById("main-description");
const sessionMessage = document.getElementById("session-message");
const navLinks = document.querySelectorAll(".nav-link");

const doctorSelect = document.getElementById("doctor-select");
const appointmentDate = document.getElementById("appointment-date");
const timeSlot = document.getElementById("time-slot");
const bookButton = document.getElementById("book-appointment");
const appointmentStatus = document.getElementById("appointment-status");
const appointmentsList = document.getElementById("appointments-list");

const historyList = document.getElementById("history-list");
const inventorySearch = document.getElementById("inventory-search");
const inventoryList = document.getElementById("inventory-list");
const updateMedicine = document.getElementById("update-medicine");
const updateQuantity = document.getElementById("update-quantity");
const updateStockButton = document.getElementById("update-stock");
const inventoryStatus = document.getElementById("inventory-status");
const hospitalList = document.getElementById("hospital-list");
const referralStatus = document.getElementById("referral-status");
const notificationFeedEl = document.getElementById("notification-feed");
const logoutBtn = document.getElementById("logout-btn");
const heroBook = document.getElementById("hero-book");

const authModeLogin = document.getElementById("auth-mode-login");
const authModeRegister = document.getElementById("auth-mode-register");
const loginStatus = document.getElementById("login-status");
const registerStatus = document.getElementById("register-status");

const doctorRecordCard = document.getElementById("doctor-record-card");
const submitMedicalRecordBtn = document.getElementById("submit-medical-record");
const recordStatus = document.getElementById("record-status");

function setToken(token) {
  authToken = token;
  if (token) sessionStorage.setItem("udms_token", token);
  else sessionStorage.removeItem("udms_token");
}

function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function openLogin() {
  loginModal.classList.remove("hidden");
  loginStatus.textContent = "";
  registerStatus.textContent = "";
  setAuthMode("login");
}

function closeLoginModal() {
  loginModal.classList.add("hidden");
}

function showDashboard() {
  dashboard.classList.remove("hidden");
  document.querySelector(".app-shell").classList.add("hidden");
}

function hideDashboard() {
  dashboard.classList.add("hidden");
  document.querySelector(".app-shell").classList.remove("hidden");
}

function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  authModeLogin.classList.toggle("active", isLogin);
  authModeRegister.classList.toggle("active", !isLogin);
}

function setActiveView(view) {
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${view}`);
  });
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  
  const mainEl = document.querySelector(".dashboard-main");
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: "smooth" });
  }

  const descriptions = {
    appointments: "Manage bookings, view available doctors, and confirm your schedule.",
    history: "Review patient medical history and prescriptions based on your access role.",
    inventory: "Monitor medicine stock, update quantities, and see availability status.",
    referrals: "Access emergency hospital details and record urgent referrals.",
    notifications: "Receive confirmations, reminders, and inventory alerts."
  };

  mainTitle.textContent = view.charAt(0).toUpperCase() + view.slice(1);
  mainDescription.textContent = descriptions[view];
}

function renderDoctorOptions() {
  doctorSelect.innerHTML = "";
  doctorsCatalog.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = `${doc.name} — ${doc.specialty}`;
    doctorSelect.appendChild(option);
  });
}

function renderTimeSlots() {
  const doctor = doctorsCatalog.find((doc) => doc.id === doctorSelect.value);
  timeSlot.innerHTML = "";
  if (!doctor || !doctor.slots) return;

  doctor.slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    timeSlot.appendChild(option);
  });
}

async function fetchAndRenderAppointments() {
  appointmentsList.innerHTML = "";
  const res = await api("/api/appointments");
  const data = await parseJson(res);
  if (!res.ok) {
    appointmentsList.innerHTML = `<tr><td colspan="5">${data.error || "Could not load appointments."}</td></tr>`;
    return;
  }

  const list = data.appointments || [];
  list.forEach((appointment) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${appointment.id}</td>
      <td>${appointment.doctor}</td>
      <td>${appointment.date}</td>
      <td>${appointment.time}</td>
      <td>${appointment.status}</td>
    `;
    appointmentsList.appendChild(row);
  });
}

async function fetchAndRenderHistory() {
  historyList.innerHTML = "";
  const res = await api("/api/medical-records");
  const data = await parseJson(res);
  if (!res.ok) {
    historyList.innerHTML = `<tr><td colspan="5">${data.error || "Could not load records."}</td></tr>`;
    return;
  }

  const records = data.records || [];
  records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.record_date}</td>
      <td>${record.patient}</td>
      <td>${record.diagnosis || ""}</td>
      <td>${record.prescription || ""}</td>
      <td>${record.notes || ""}</td>
    `;
    historyList.appendChild(row);
  });
}

async function fetchAndRenderInventory(query = "") {
  inventoryList.innerHTML = "";
  const res = await api("/api/inventory");
  const data = await parseJson(res);
  if (!res.ok) {
    inventoryList.innerHTML = `<tr><td colspan="4">${data.error || "Could not load inventory."}</td></tr>`;
    return;
  }

  const items = data.items || [];
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  filtered.forEach((item) => {
    const row = document.createElement("tr");
    const status =
      item.quantity <= 0 ? "Out of Stock" : item.quantity <= item.threshold ? "Low Stock" : "Available";
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${status}</td>
      <td>${status === "Out of Stock" ? "Notify dispensary" : "—"}</td>
    `;
    inventoryList.appendChild(row);
  });

  renderUpdateMedicineOptions(items);
}

function renderUpdateMedicineOptions(items) {
  updateMedicine.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    updateMedicine.appendChild(option);
  });
}

function setInventoryPermission() {
  const canUpdate = currentUser && currentUser.role === "pharmacist";
  updateMedicine.disabled = !canUpdate;
  updateQuantity.disabled = !canUpdate;
  updateStockButton.disabled = !canUpdate;

  if (!canUpdate) {
    inventoryStatus.textContent = "Only pharmacists can update medicine stock.";
  } else {
    inventoryStatus.textContent = "Enter quantity and press Update Stock.";
  }
}

async function fetchAndRenderHospitals() {
  hospitalList.innerHTML = "";
  const res = await api("/api/hospitals");
  const data = await parseJson(res);
  if (!res.ok) {
    hospitalList.innerHTML = `<tr><td colspan="4">${data.error || "Could not load hospitals."}</td></tr>`;
    return;
  }

  const hospitals = data.hospitals || [];
  hospitals.forEach((hospital) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${hospital.name}</td>
      <td>${hospital.facility}</td>
      <td>${hospital.contact}</td>
      <td><button type="button" class="btn btn-primary" data-hospital-id="${hospital.id}">Refer</button></td>
    `;
    hospitalList.appendChild(row);
  });
}

async function fetchAndRenderNotifications() {
  notificationFeedEl.innerHTML = "";
  const res = await api("/api/notifications");
  const data = await parseJson(res);
  if (!res.ok) {
    notificationFeedEl.textContent = data.error || "Could not load notifications.";
    return;
  }

  const notes = data.notifications || [];
  if (notes.length === 0) {
    notificationFeedEl.innerHTML = '<p class="muted">No notifications yet.</p>';
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement("div");
    card.className = "notification-card";
    card.innerHTML = `<strong>${note.title}</strong><p>${note.message}</p>`;
    notificationFeedEl.appendChild(card);
  });
}

async function refreshNotificationsAfterAction() {
  await fetchAndRenderNotifications();
}

async function loadDoctorsCatalog() {
  const res = await api("/api/doctors");
  const data = await parseJson(res);
  if (!res.ok) return false;
  doctorsCatalog = data.doctors || [];
  return true;
}

function applyRoleVisibility(role) {
  const inventoryNav = document.querySelector('[data-view="inventory"]');
  const inventoryView = document.getElementById("view-inventory");
  const appointmentsNav = document.querySelector('[data-view="appointments"]');
  const appointmentsView = document.getElementById("view-appointments");

  if (role === "student" || role === "faculty") {
    if (inventoryNav) inventoryNav.style.display = "none";
    if (inventoryView) inventoryView.style.display = "none";
  } else {
    if (inventoryNav) inventoryNav.style.display = "block";
    if (inventoryView) inventoryView.style.display = "block";
  }

  if (role === "pharmacist") {
    if (appointmentsNav) appointmentsNav.style.display = "none";
    if (appointmentsView) appointmentsView.style.display = "none";
  } else {
    if (appointmentsNav) appointmentsNav.style.display = "block";
    if (appointmentsView) appointmentsView.style.display = "block";
  }

  const appointmentBookingCard = document.querySelector("#view-appointments .panel-card:first-child");
  const appointmentsGrid = document.querySelector("#view-appointments .panel-grid");

  if (role === "doctor") {
    if (appointmentBookingCard) appointmentBookingCard.style.display = "none";
    if (appointmentsGrid) appointmentsGrid.classList.add("single");
  } else {
    if (appointmentBookingCard) appointmentBookingCard.style.display = "block";
    if (appointmentsGrid) appointmentsGrid.classList.remove("single");
  }

  const stockUpdateCard = document.querySelector(".stock-update-card");
  if (role === "doctor") {
    if (stockUpdateCard) stockUpdateCard.style.display = "none";
  } else {
    if (stockUpdateCard) stockUpdateCard.style.display = "block";
  }

  const historyNav = document.querySelector('[data-view="history"]');
  const historyView = document.getElementById("view-history");
  const referralsNav = document.querySelector('[data-view="referrals"]');
  const referralsView = document.getElementById("view-referrals");

  if (role === "pharmacist") {
    if (historyNav) historyNav.style.display = "none";
    if (historyView) historyView.style.display = "none";
  } else {
    if (historyNav) historyNav.style.display = "block";
    if (historyView) historyView.style.display = "block";
  }

  if (role === "student" || role === "faculty") {
    if (referralsNav) referralsNav.style.display = "none";
    if (referralsView) referralsView.style.display = "none";
  } else {
    if (referralsNav) referralsNav.style.display = "block";
    if (referralsView) referralsView.style.display = "block";
  }

  if (doctorRecordCard) {
    doctorRecordCard.classList.toggle("hidden", role === "pharmacist");
  }

  const patientIdGroup = document.getElementById("patient-id-group");
  if (patientIdGroup) {
    patientIdGroup.style.display = role === "doctor" ? "grid" : "none";
  }

  const recordCardTitle = document.querySelector("#doctor-record-card h3");
  if (recordCardTitle) {
    recordCardTitle.textContent = role === "doctor" ? "Log patient visit" : "Add Medical Note";
  }

  const historyGrid = document.querySelector("#view-history .panel-grid");
  if (historyGrid) {
    historyGrid.classList.toggle("single", role === "pharmacist");
  }
}

async function bootstrapAuthenticatedSession(user) {
  currentUser = {
    role: user.role,
    userId: user.university_id,
    userName: user.full_name,
    numericId: user.id
  };

  profileName.textContent = `Hello, ${user.full_name}`;
  profileRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  sessionMessage.textContent = `Signed in as ${user.role} · ${user.university_id}`;
  showDashboard();

  applyRoleVisibility(user.role);

  const doctorsOk = await loadDoctorsCatalog();
  if (doctorsOk) {
    renderDoctorOptions();
    renderTimeSlots();
  }

  await fetchAndRenderAppointments();
  await fetchAndRenderHistory();

  if (user.role !== "student" && user.role !== "faculty") {
    await fetchAndRenderInventory();
    setInventoryPermission();
  }

  await fetchAndRenderHospitals();
  await fetchAndRenderNotifications();

  setActiveView(user.role === "pharmacist" ? "inventory" : "appointments");
}

async function tryRestoreSession() {
  if (!authToken) return;
  const res = await api("/api/auth/me");
  const data = await parseJson(res);
  if (!res.ok || !data.user) {
    setToken(null);
    return;
  }
  await bootstrapAuthenticatedSession(data.user);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  loginStatus.textContent = "";
  const universityId = document.getElementById("login-user-id").value.trim();
  const password = document.getElementById("login-password").value;

  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ university_id: universityId, password })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    loginStatus.textContent = data.error || "Login failed.";
    return;
  }

  setToken(data.token);
  await bootstrapAuthenticatedSession(data.user);
  closeLoginModal();
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  registerStatus.textContent = "";

  const role = document.getElementById("reg-role").value;
  const full_name = document.getElementById("reg-name").value.trim();
  const university_id = document.getElementById("reg-user-id").value.trim();
  const password = document.getElementById("reg-password").value;

  const res = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ role, full_name, university_id, password })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    registerStatus.textContent = data.error || "Registration failed.";
    return;
  }

  setToken(data.token);
  await bootstrapAuthenticatedSession(data.user);
  closeLoginModal();
}

async function bookAppointment() {
  appointmentStatus.textContent = "";

  if (!currentUser) {
    appointmentStatus.textContent = "Please log in to book an appointment.";
    return;
  }

  if (currentUser.role === "doctor") {
    appointmentStatus.textContent =
      "Doctors cannot book appointments. This feature is for students and faculty only.";
    return;
  }

  const doctorId = doctorSelect.value;
  const date = appointmentDate.value;
  const time = timeSlot.value;

  if (!doctorId || !date || !time) {
    appointmentStatus.textContent = "Please select a valid doctor, date, and time slot.";
    return;
  }

  const res = await api("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      doctorId,
      appointment_date: date,
      time_slot: time
    })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    appointmentStatus.textContent = data.error || "Booking failed.";
    return;
  }

  const appt = data.appointment;
  appointmentStatus.textContent = `Booking confirmed! Appointment ID: ${appt.id}`;
  await fetchAndRenderAppointments();
  await refreshNotificationsAfterAction();
}

async function updateInventory() {
  inventoryStatus.textContent = "";

  if (!currentUser || currentUser.role !== "pharmacist") {
    inventoryStatus.textContent = "Access denied. Only pharmacists can update inventory.";
    return;
  }

  const medicineId = updateMedicine.value;
  const quantity = Number(updateQuantity.value);

  if (!medicineId || Number.isNaN(quantity) || quantity < 0) {
    inventoryStatus.textContent = "Please select a medicine and enter a valid quantity.";
    return;
  }

  const res = await api(`/api/inventory/${medicineId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    inventoryStatus.textContent = data.error || "Update failed.";
    return;
  }

  inventoryStatus.textContent = "Stock updated successfully.";
  await fetchAndRenderInventory(inventorySearch.value);
  await refreshNotificationsAfterAction();
}

async function referHospital(hospitalId) {
  referralStatus.textContent = "";
  const patientId = document.getElementById("referral-patient-id")?.value.trim();

  if (!patientId) {
    referralStatus.textContent = "Please enter the Patient University ID to refer.";
    return;
  }

  const res = await api("/api/referrals", {
    method: "POST",
    body: JSON.stringify({ hospital_id: hospitalId, patient_id: patientId })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    referralStatus.textContent = data.error || "Could not record referral.";
    return;
  }

  const r = data.referral;
  referralStatus.textContent = `Emergency referral recorded to ${r.hospital}. Contact ${r.contact}.`;
  await refreshNotificationsAfterAction();
}

async function submitMedicalRecord() {
  if (!currentUser || currentUser.role === "pharmacist") return;
  recordStatus.textContent = "";

  let patient_university_id = "";
  if (currentUser.role === "doctor") {
    patient_university_id = document.getElementById("record-patient-id").value.trim();
    if (!patient_university_id) {
      recordStatus.textContent = "Patient university ID is required.";
      return;
    }
  }

  const record_date = document.getElementById("record-date").value;
  const diagnosis = document.getElementById("record-diagnosis").value.trim();
  const prescription = document.getElementById("record-prescription").value.trim();
  const notes = document.getElementById("record-notes").value.trim();

  if (!record_date) {
    recordStatus.textContent = "Visit date is required.";
    return;
  }

  const res = await api("/api/medical-records", {
    method: "POST",
    body: JSON.stringify({
      patient_university_id,
      record_date,
      diagnosis,
      prescription,
      notes
    })
  });
  const data = await parseJson(res);

  if (!res.ok) {
    recordStatus.textContent = data.error || "Could not save record.";
    return;
  }

  recordStatus.textContent = "Medical history updated.";
  document.getElementById("record-diagnosis").value = "";
  document.getElementById("record-prescription").value = "";
  document.getElementById("record-notes").value = "";

  await fetchAndRenderHistory();
  await refreshNotificationsAfterAction();
}

btnOpenLogin.addEventListener("click", openLogin);
closeLogin.addEventListener("click", closeLoginModal);
heroBook.addEventListener("click", openLogin);

authModeLogin.addEventListener("click", () => setAuthMode("login"));
authModeRegister.addEventListener("click", () => setAuthMode("register"));

logoutBtn.addEventListener("click", () => {
  currentUser = null;
  setToken(null);
  doctorsCatalog = [];
  hideDashboard();
  closeLoginModal();
});

loginForm.addEventListener("submit", handleLoginSubmit);
registerForm.addEventListener("submit", handleRegisterSubmit);

doctorSelect.addEventListener("change", renderTimeSlots);
bookButton.addEventListener("click", bookAppointment);
inventorySearch.addEventListener("input", (event) => fetchAndRenderInventory(event.target.value));
updateStockButton.addEventListener("click", updateInventory);
submitMedicalRecordBtn.addEventListener("click", submitMedicalRecord);

hospitalList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-hospital-id]");
  if (!button) return;
  referHospital(button.dataset.hospitalId);
});

navLinks.forEach((link) => {
  link.addEventListener("click", async () => {
    if (link.dataset.view === "inventory" && currentUser && (currentUser.role === "student" || currentUser.role === "faculty")) {
      return;
    }
    if (link.dataset.view === "appointments" && currentUser && currentUser.role === "pharmacist") {
      return;
    }
    setActiveView(link.dataset.view);

    if (!currentUser) return;

    if (link.dataset.view === "appointments") await fetchAndRenderAppointments();
    if (link.dataset.view === "history") await fetchAndRenderHistory();
    if (link.dataset.view === "inventory") await fetchAndRenderInventory(inventorySearch.value);
    if (link.dataset.view === "referrals") await fetchAndRenderHospitals();
    if (link.dataset.view === "notifications") await fetchAndRenderNotifications();
  });
});

tryRestoreSession();
