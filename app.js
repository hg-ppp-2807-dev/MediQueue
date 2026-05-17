// Smart Healthcare Appointment & Queue Management (Front‑end only)
// LocalStorage data model, no PHP/DB

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin'
};

let currentUser = null;
let weekChartInst = null;

/* ── Storage Helpers ────────────────────────────────────────── */
function getData(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
function setData(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function getUsers()        { return getData('hc_users', []); }
function getDoctors()      { return getData('hc_doctors', []); }
function getAppointments() { return getData('hc_appointments', []); }
function getFeedback()     { return getData('hc_feedback', []); }
function getCurrentUser()  { return getData('hc_current_user', null); }

function setCurrentUser(u) { currentUser = u; setData('hc_current_user', u); }
function getNextId(key)    { const n = getData(key, 1); setData(key, n + 1); return n; }

/* ── Seed Data ──────────────────────────────────────────────── */
function seedIfEmpty() {
  if (!getUsers().length) {
    const admin = { id: 1, name: 'Admin', email: 'admin@demo.com', password: 'admin', role: ROLES.ADMIN };
    const doc1  = { id: 2, name: 'Dr. Kavya Rao', email: 'kavya@demo.com', password: 'doctor', role: ROLES.DOCTOR };
    const doc2  = { id: 3, name: 'Dr. Arjun Mehta', email: 'arjun@demo.com', password: 'doctor', role: ROLES.DOCTOR };
    const pat1  = { id: 4, name: 'Riya Sharma', email: 'riya@demo.com', password: 'patient', role: ROLES.PATIENT };
    setData('hc_users', [admin, doc1, doc2, pat1]);
    setData('hc_doctors', [
      { id: 1, name: 'Dr. Kavya Rao', specialization: 'Cardiology', available: '10:00–16:00' },
      { id: 2, name: 'Dr. Arjun Mehta', specialization: 'Orthopedics', available: '12:00–18:00' }
    ]);
  }
}

/* ── Init ───────────────────────────────────────────────────── */
async function fetchSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

function getPageRole() {
  return document.body?.dataset?.role || 'all';
}

async function init() {
  seedIfEmpty();

  const pageRole = getPageRole();
  if (pageRole !== 'all') {
    const user = await fetchSession();
    if (!user || user.role !== pageRole) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    setData('hc_current_user', user);
  } else {
    currentUser = getCurrentUser();
  }

  buildSidebar();
  buildPanels();
  renderDashboard();

  if (pageRole === 'patient') return switchTab('journal');
  if (pageRole === 'doctor')  return switchTab('breathe');
  if (pageRole === 'admin')   return switchTab('habits');
  switchTab('dashboard');
}
document.addEventListener('DOMContentLoaded', init);

/* ── Sidebar & Panels ───────────────────────────────────────── */
function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const role = getPageRole();

  const navItems = [
    { id: 'dashboard', icon: 'fa-gauge', label: 'Dashboard', roles: ['all','patient','doctor','admin'] },
    { id: 'journal',   icon: 'fa-calendar-check', label: 'Patient',  roles: ['all','patient'] },
    { id: 'breathe',   icon: 'fa-user-doctor',    label: 'Doctor',   roles: ['all','doctor'] },
    { id: 'habits',    icon: 'fa-shield',         label: 'Admin',    roles: ['all','admin'] },
    { id: 'insights',  icon: 'fa-chart-line',     label: 'Reports',  roles: ['all','patient','doctor','admin'] },
  ];

  const navHtml = navItems
    .filter(n => n.roles.includes(role))
    .map(n => `<button class="nav-btn" data-tab="${n.id}"><i class="fa-solid ${n.icon}"></i> ${n.label}</button>`)
    .join('');

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">🩺</div>
      <div>
        <div class="brand-name">Smart Healthcare</div>
        <div class="brand-sub">Appointment & Queue</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <div class="today-date" id="sidebar-date"></div>
      <div class="streak-display" id="sidebar-user"></div>
    </div>
  `;

  const dateEl = document.getElementById('sidebar-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function buildPanels() {
  setPanel('panel-dashboard', dashboardTemplate());
  setPanel('panel-journal',   patientTemplate());
  setPanel('panel-breathe',   doctorTemplate());
  setPanel('panel-habits',    adminTemplate());
  setPanel('panel-insights',  reportsTemplate());
  wireGlobalActions();
}

function setPanel(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + tabId);
  if (panel) panel.classList.add('active');

  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'journal')   renderPatient();
  if (tabId === 'breathe')   renderDoctor();
  if (tabId === 'habits')    renderAdmin();
  if (tabId === 'insights')  renderReports();
}

/* ── Templates ─────────────────────────────────────────────── */
function dashboardTemplate() {
  return `
    <section class="panel-inner">
      <h2>Dashboard</h2>
      <div class="metrics">
        <div class="metric-card"><div class="metric-label">Total Patients</div><div id="m-patients" class="metric-val">—</div></div>
        <div class="metric-card"><div class="metric-label">Total Doctors</div><div id="m-doctors" class="metric-val">—</div></div>
        <div class="metric-card"><div class="metric-label">Appointments Today</div><div id="m-today" class="metric-val">—</div></div>
        <div class="metric-card"><div class="metric-label">Queue Length</div><div id="m-queue" class="metric-val">—</div></div>
      </div>
      <div class="chart-card">
        <h3>Last 7 Days Appointments</h3>
        <canvas id="weekChart" height="180"></canvas>
      </div>
    </section>
  `;
}

function patientTemplate() {
  return `
    <section class="panel-inner">
      <h2>Patient Module</h2>

      <div class="auth-box">
        <div class="auth-row">
          <input id="reg-name" placeholder="Name" />
          <input id="reg-email" placeholder="Email" />
          <input id="reg-pass" type="password" placeholder="Password" />
          <button id="btn-register">Register</button>
        </div>
        <div class="auth-row">
          <input id="log-email" placeholder="Email" />
          <input id="log-pass" type="password" placeholder="Password" />
          <button id="btn-login">Login</button>
          <button id="btn-logout">Logout</button>
        </div>
        <div id="auth-status" class="status-text"></div>
      </div>

      <div class="card">
        <h3>Book Appointment</h3>
        <div class="form-row">
          <select id="book-doctor"></select>
          <input id="book-date" type="date" />
          <input id="book-time" type="time" />
          <button id="btn-book">Book</button>
        </div>
        <div id="book-status" class="status-text"></div>
      </div>

      <div class="card">
        <h3>My Appointments</h3>
        <div id="patient-appointments"></div>
      </div>

      <div class="card">
        <h3>Feedback</h3>
        <div class="form-row">
          <textarea id="fb-text" placeholder="Share feedback..."></textarea>
          <button id="btn-fb">Submit</button>
        </div>
        <div id="fb-status" class="status-text"></div>
      </div>
    </section>
  `;
}

function doctorTemplate() {
  return `
    <section class="panel-inner">
      <h2>Doctor Module</h2>
      <div class="card">
        <h3>My Appointments</h3>
        <div id="doctor-appointments"></div>
      </div>
    </section>
  `;
}

function adminTemplate() {
  return `
    <section class="panel-inner">
      <h2>Admin Module</h2>
      <div class="card">
        <h3>Manage Doctors</h3>
        <div class="form-row">
          <input id="doc-name" placeholder="Doctor Name" />
          <input id="doc-spec" placeholder="Specialization" />
          <input id="doc-avail" placeholder="Available Time" />
          <button id="btn-add-doc">Add</button>
        </div>
        <div id="doctor-list"></div>
      </div>

      <div class="card">
        <h3>Queue Monitor (Today)</h3>
        <div id="queue-monitor"></div>
      </div>
    </section>
  `;
}

function reportsTemplate() {
  return `
    <section class="panel-inner">
      <h2>Reports</h2>
      <div id="reports-summary"></div>
    </section>
  `;
}

/* ── Dashboard ─────────────────────────────────────────────── */
function renderDashboard() {
  const users = getUsers();
  const doctors = getDoctors();
  const appts = getAppointments();

  const today = dateKey(new Date());
  const todays = appts.filter(a => a.date === today);

  setText('m-patients', users.filter(u => u.role === ROLES.PATIENT).length);
  setText('m-doctors', doctors.length);
  setText('m-today', todays.length);
  setText('m-queue', todays.filter(a => a.status === 'Accepted' || a.status === 'Pending').length);

  renderWeekChart();
  updateSidebarUser();
}

function renderWeekChart() {
  const ctx = document.getElementById('weekChart');
  if (!ctx || !window.Chart) return;
  if (weekChartInst) weekChartInst.destroy();

  const appts = getAppointments();
  const data = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    const key = dateKey(dd);
    data.push({ label: DAYS[dd.getDay()], val: appts.filter(a => a.date === key).length });
  }

  weekChartInst = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: { labels: data.map(x => x.label), datasets: [{ label: 'Appointments', data: data.map(x => x.val), backgroundColor: '#7f8cfa' }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

/* ── Patient Module ────────────────────────────────────────── */
function wireGlobalActions() {
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'btn-register') registerUser();
    if (e.target?.id === 'btn-login')    loginUser();
    if (e.target?.id === 'btn-logout')   logoutUser();
    if (e.target?.id === 'btn-book')     bookAppointment();
    if (e.target?.id === 'btn-fb')       submitFeedback();

    if (e.target?.dataset?.action === 'cancel-appt') cancelAppointment(parseInt(e.target.dataset.id, 10));
    if (e.target?.dataset?.action === 'appt-status') updateAppointmentStatus(parseInt(e.target.dataset.id, 10), e.target.dataset.status);
    if (e.target?.dataset?.action === 'del-doc')     deleteDoctor(parseInt(e.target.dataset.id, 10));
  });
}

function renderPatient() {
  fillDoctorOptions();
  renderPatientAppointments();
  updateSidebarUser();
}

function registerUser() {
  const name = val('reg-name');
  const email= val('reg-email');
  const pass = val('reg-pass');
  if (!name || !email || !pass) return setText('auth-status', 'All fields required.');

  const users = getUsers();
  if (users.some(u => u.email === email)) return setText('auth-status', 'Email already exists.');

  const user = { id: getNextId('hc_uid'), name, email, password: pass, role: ROLES.PATIENT };
  users.push(user);
  setData('hc_users', users);
  setCurrentUser(user);

  setText('auth-status', 'Registered & logged in.');
  renderPatient();
}

function loginUser() {
  const email= val('log-email');
  const pass = val('log-pass');
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === pass);
  if (!user) return setText('auth-status', 'Invalid credentials.');

  setCurrentUser(user);
  setText('auth-status', `Logged in as ${user.name}.`);
  renderPatient();
}

function logoutUser() {
  setCurrentUser(null);
  setText('auth-status', 'Logged out.');
  renderPatient();
}

async function fillDoctorOptions() {
  const sel = document.getElementById('book-doctor');
  if (!sel) return;

  try {
    const res = await fetch('/api/doctors');
    const data = await res.json();
    const doctors = data.doctors || [];
    sel.innerHTML = doctors.map(d => `<option value="${d.id}">${d.doctor_name} — ${d.specialization}</option>`).join('');
  } catch {
    sel.innerHTML = `<option value="">Failed to load doctors</option>`;
  }
}

function bookAppointment() {
  if (!currentUser || currentUser.role !== ROLES.PATIENT) return setText('book-status', 'Please login as patient.');

  const docId = parseInt(val('book-doctor'), 10);
  const date  = val('book-date');
  const time  = val('book-time');
  if (!docId || !date || !time) return setText('book-status', 'Select doctor, date, and time.');

  const appts = getAppointments();
  const queueNo = appts.filter(a => a.doctorId === docId && a.date === date).length + 1;

  appts.unshift({
    id: getNextId('hc_apptid'),
    patientId: currentUser.id,
    doctorId: docId,
    date,
    time,
    status: 'Pending',
    queueNo
  });

  setData('hc_appointments', appts);
  setText('book-status', `Booked. Queue No: ${queueNo}`);
  renderPatientAppointments();
  renderDashboard();
}

function renderPatientAppointments() {
  const el = document.getElementById('patient-appointments');
  if (!el) return;

  if (!currentUser) return el.innerHTML = `<div class="empty-state">Login to view appointments.</div>`;
  const appts = getAppointments().filter(a => a.patientId === currentUser.id);
  if (!appts.length) return el.innerHTML = `<div class="empty-state">No appointments yet.</div>`;

  el.innerHTML = appts.map(a => {
    const doc = getDoctors().find(d => d.id === a.doctorId);
    return `
      <div class="list-row">
        <div>
          <strong>${doc?.name || 'Doctor'}</strong> — ${a.date} ${a.time}
          <span class="badge">${a.status}</span>
          <span class="badge">Queue #${a.queueNo}</span>
        </div>
        ${a.status === 'Pending' ? `<button data-action="cancel-appt" data-id="${a.id}">Cancel</button>` : ''}
      </div>
    `;
  }).join('');
}

function cancelAppointment(id) {
  const appts = getAppointments();
  const idx = appts.findIndex(a => a.id === id);
  if (idx > -1) {
    appts[idx].status = 'Cancelled';
    setData('hc_appointments', appts);
    renderPatientAppointments();
    renderDoctorAppointments();
    renderDashboard();
  }
}

function submitFeedback() {
  if (!currentUser) return setText('fb-status', 'Login first.');
  const msg = val('fb-text');
  if (!msg) return setText('fb-status', 'Please write feedback.');

  const fb = getFeedback();
  fb.unshift({ id: getNextId('hc_fbid'), patientId: currentUser.id, message: msg, createdAt: new Date().toISOString() });
  setData('hc_feedback', fb);
  setText('fb-status', 'Thanks for your feedback!');
}

/* ── Doctor Module ─────────────────────────────────────────── */
function renderDoctor() {
  renderDoctorAppointments();
  updateSidebarUser();
}

function renderDoctorAppointments() {
  const el = document.getElementById('doctor-appointments');
  if (!el) return;

  if (!currentUser || currentUser.role !== ROLES.DOCTOR) {
    el.innerHTML = `<div class="empty-state">Login as doctor to view appointments.</div>`;
    return;
  }

  const appts = getAppointments().filter(a => a.doctorId === mapDoctorId(currentUser));
  if (!appts.length) return el.innerHTML = `<div class="empty-state">No appointments.</div>`;

  el.innerHTML = appts.map(a => {
    const patient = getUsers().find(u => u.id === a.patientId);
    return `
      <div class="list-row">
        <div>
          <strong>${patient?.name || 'Patient'}</strong> — ${a.date} ${a.time}
          <span class="badge">${a.status}</span>
          <span class="badge">Queue #${a.queueNo}</span>
        </div>
        <div>
          <button data-action="appt-status" data-id="${a.id}" data-status="Accepted">Accept</button>
          <button data-action="appt-status" data-id="${a.id}" data-status="Rejected">Reject</button>
          <button data-action="appt-status" data-id="${a.id}" data-status="Completed">Complete</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateAppointmentStatus(id, status) {
  const appts = getAppointments();
  const idx = appts.findIndex(a => a.id === id);
  if (idx > -1) {
    appts[idx].status = status;
    setData('hc_appointments', appts);
    renderDoctorAppointments();
    renderPatientAppointments();
    renderDashboard();
  }
}

/* ── Admin Module ──────────────────────────────────────────── */
function renderAdmin() {
  renderDoctorList();
  renderQueueMonitor();
  updateSidebarUser();
}

function renderDoctorList() {
  const el = document.getElementById('doctor-list');
  if (!el) return;

  const docs = getDoctors();
  el.innerHTML = docs.map(d => `
    <div class="list-row">
      <div><strong>${d.name}</strong> — ${d.specialization} (${d.available})</div>
      <button data-action="del-doc" data-id="${d.id}">Delete</button>
    </div>
    `).join('');
  
    const btn = document.getElementById('btn-add-doc');
    if (btn) btn.addEventListener('click', addDoctor);
  }
  
  function addDoctor() {
    const name = val('doc-name');
    const spec = val('doc-spec');
    const avail = val('doc-avail');
    if (!name || !spec || !avail) return;
  
    const docs = getDoctors();
    docs.push({ id: getNextId('hc_docid'), name, specialization: spec, available: avail });
    setData('hc_doctors', docs);
    renderDoctorList();
    fillDoctorOptions();
  }
  
  function deleteDoctor(id) {
    const docs = getDoctors().filter(d => d.id !== id);
    setData('hc_doctors', docs);
    renderDoctorList();
    fillDoctorOptions();
  }
  
  function renderQueueMonitor() {
    const el = document.getElementById('queue-monitor');
    if (!el) return;
  
    const today = dateKey(new Date());
    const appts = getAppointments().filter(a => a.date === today && (a.status === 'Pending' || a.status === 'Accepted'));
  
    if (!appts.length) return el.innerHTML = `<div class="empty-state">Queue is empty.</div>`;
  
    el.innerHTML = appts.sort((a,b) => a.queueNo - b.queueNo).map(a => {
      const doc = getDoctors().find(d => d.id === a.doctorId);
      const patient = getUsers().find(u => u.id === a.patientId);
      return `
        <div class="list-row">
          <div>
            <strong>#${a.queueNo} ${patient?.name || 'Patient'}</strong> for ${doc?.name || 'Doctor'}
            <span class="badge">${a.status}</span>
          </div>
        </div>
      `;
    }).join('');
  }
  
  /* ── Reports Module ────────────────────────────────────────── */
  function renderReports() {
    const el = document.getElementById('reports-summary');
    if (!el) return;
  
    const users = getUsers();
    const doctors = getDoctors();
    const appts = getAppointments();
    const feedback = getFeedback();
  
    el.innerHTML = `
      <div class="metrics">
        <div class="metric-card"><div class="metric-label">Total Patients</div><div class="metric-val">${users.filter(u => u.role === ROLES.PATIENT).length}</div></div>
        <div class="metric-card"><div class="metric-label">Total Doctors</div><div class="metric-val">${doctors.length}</div></div>
        <div class="metric-card"><div class="metric-label">Total Appointments</div><div class="metric-val">${appts.length}</div></div>
        <div class="metric-card"><div class="metric-label">Feedback Count</div><div class="metric-val">${feedback.length}</div></div>
      </div>
    `;
  }
  
  /* ── Helpers ───────────────────────────────────────────────── */
  function val(id) { return document.getElementById(id)?.value || ''; }
  function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
  function dateKey(d) { return d.toISOString().slice(0, 10); }
  
  function updateSidebarUser() {
    const el = document.getElementById('sidebar-user');
    if (!el) return;
    el.textContent = currentUser ? `Welcome, ${currentUser.name}` : 'Not Logged In';
  }
  
  function mapDoctorId(user) {
    if (!user || user.role !== ROLES.DOCTOR) return -1;
    const doc = getDoctors().find(d => d.name === user.name);
    return doc ? doc.id : -1;
  }