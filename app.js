// Smart Healthcare Appointment & Queue Management (Front‑end only UI)
// Data comes from Node.js + PostgreSQL APIs

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin'
};

let currentUser = null;
let weekChartInst = null;

/* ── Local helpers (only for feedback) ─────────────────────── */
function getData(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
function setData(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function getNextId(key) { const n = getData(key, 1); setData(key, n + 1); return n; }
function getFeedback() { return getData('hc_feedback', []); }

/* ── API helpers ───────────────────────────────────────────── */
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function fetchSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch { return null; }
}

/* ── Init ─────────────────────────────────────────────────── */
function getPageRole() { return document.body?.dataset?.role || 'all'; }

async function init() {
  const pageRole = getPageRole();
  if (pageRole !== 'all') {
    const user = await fetchSession();
    if (!user || user.role !== pageRole) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
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

/* ── Sidebar & Panels ──────────────────────────────────────── */
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
        <h3>Appointments (All Status)</h3>
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
        <h3>Doctor Requests</h3>
        <div id="doctor-requests"></div>
      </div>

      <div class="card">
        <h3>Manage Doctors (Approved)</h3>
        <div class="form-row">
          <input id="doc-name" placeholder="Doctor Name" />
          <input id="doc-spec" placeholder="Specialization" />
          <input id="doc-avail" placeholder="Available Time" />
          <input id="doc-email" placeholder="Email (optional)" />
          <input id="doc-pass" type="password" placeholder="Password (optional)" />
          <button id="btn-add-doc">Add Doctor</button>
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
async function renderDashboard() {
  try {
    const stats = await api('/api/stats');
    setText('m-patients', stats.totalPatients);
    setText('m-doctors', stats.totalDoctors);
    setText('m-today', stats.todayAppointments);
    setText('m-queue', stats.queueLength);
  } catch {
    setText('m-patients', '—');
    setText('m-doctors', '—');
    setText('m-today', '—');
    setText('m-queue', '—');
  }
  renderWeekChart();
  updateSidebarUser();
}

async function renderWeekChart() {
  const ctx = document.getElementById('weekChart');
  if (!ctx || !window.Chart) return;
  if (weekChartInst) weekChartInst.destroy();

  let appts = [];
  try {
    const data = await api('/api/appointments');
    appts = data.appointments || [];
  } catch {}

  const data = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    const key = dateKey(dd);
    data.push({
      label: DAYS[dd.getDay()],
      val: appts.filter(a => a.appointment_date === key).length
    });
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
    if (e.target?.id === 'btn-book')     bookAppointment();
    if (e.target?.id === 'btn-fb')       submitFeedback();
    if (e.target?.id === 'btn-add-doc')  addDoctor();

    if (e.target?.dataset?.action === 'cancel-appt') cancelAppointment(parseInt(e.target.dataset.id, 10));
    if (e.target?.dataset?.action === 'appt-status') updateAppointmentStatus(parseInt(e.target.dataset.id, 10), e.target.dataset.status);
    if (e.target?.dataset?.action === 'approve-doc') approveDoctor(parseInt(e.target.dataset.id, 10));
    if (e.target?.dataset?.action === 'reject-doc')  rejectDoctor(parseInt(e.target.dataset.id, 10));
  });
}

async function renderPatient() {
  await fillDoctorOptions();
  await renderPatientAppointments();
  updateSidebarUser();
}

async function fillDoctorOptions() {
  const sel = document.getElementById('book-doctor');
  if (!sel) return;

  try {
    const data = await api('/api/doctors');
    const doctors = data.doctors || [];
    sel.innerHTML = doctors.map(d => `<option value="${d.id}">${d.doctor_name} — ${d.specialization}</option>`).join('');
  } catch {
    sel.innerHTML = `<option value="">No approved doctors</option>`;
  }
}

async function bookAppointment() {
  const doctor_id = parseInt(val('book-doctor'), 10);
  const date  = val('book-date');
  const time  = val('book-time');
  if (!doctor_id || !date || !time) return setText('book-status', 'Select doctor, date, and time.');

  try {
    const data = await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctor_id, date, time })
    });
    setText('book-status', `Booked. Queue No: ${data.appointment.queue_no}`);
    await renderPatientAppointments();
    renderDashboard();
  } catch (e) {
    setText('book-status', e?.error || 'Booking failed.');
  }
}

async function renderPatientAppointments() {
  const el = document.getElementById('patient-appointments');
  if (!el) return;

  try {
    const data = await api('/api/appointments');
    const appts = data.appointments || [];
    if (!appts.length) return el.innerHTML = `<div class="empty-state">No appointments yet.</div>`;

    el.innerHTML = appts.map(a => `
      <div class="list-row">
        <div>
          <strong>${a.doctor_name || 'Doctor'}</strong> — ${a.appointment_date} ${a.appointment_time}
          <span class="badge" data-status="${a.status}">${a.status}</span>
          <span class="badge">Queue #${a.queue_no}</span>
        </div>
        ${a.status === 'Pending' ? `<button data-action="cancel-appt" data-id="${a.id}">Cancel</button>` : ''}
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load appointments.</div>`;
  }
}

async function cancelAppointment(id) {
  try {
    await api(`/api/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Cancelled' }) });
    await renderPatientAppointments();
    renderDashboard();
  } catch {}
}

function submitFeedback() {
  const msg = val('fb-text');
  if (!msg) return setText('fb-status', 'Please write feedback.');

  const fb = getFeedback();
  fb.unshift({ id: getNextId('hc_fbid'), message: msg, createdAt: new Date().toISOString() });
  setData('hc_feedback', fb);
  setText('fb-status', 'Thanks for your feedback!');
}

/* ── Doctor Module ─────────────────────────────────────────── */
async function renderDoctor() {
  await renderDoctorAppointments();
  updateSidebarUser();
}

async function renderDoctorAppointments() {
  const el = document.getElementById('doctor-appointments');
  if (!el) return;

  try {
    const data = await api('/api/appointments');
    const appts = data.appointments || [];
    if (!appts.length) return el.innerHTML = `<div class="empty-state">No appointments.</div>`;

    el.innerHTML = appts.map(a => `
      <div class="list-row">
        <div>
          <strong>${a.patient_name || 'Patient'}</strong> (${a.patient_email || '—'}) — ${a.appointment_date} ${a.appointment_time}
          <span class="badge" data-status="${a.status}">${a.status}</span>
          <span class="badge">Queue #${a.queue_no}</span>
        </div>
        <div>
          <button data-action="appt-status" data-id="${a.id}" data-status="Accepted">Accept</button>
          <button data-action="appt-status" data-id="${a.id}" data-status="Rejected">Reject</button>
          <button data-action="appt-status" data-id="${a.id}" data-status="Completed">Complete</button>
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load appointments.</div>`;
  }
}

async function updateAppointmentStatus(id, status) {
  try {
    await api(`/api/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await renderDoctorAppointments();
    await renderPatientAppointments();
    renderDashboard();
  } catch {}
}

/* ── Admin Module ──────────────────────────────────────────── */
async function renderAdmin() {
  await renderDoctorRequests();
  await renderDoctorList();
  await renderQueueMonitor();
  updateSidebarUser();
}

async function renderDoctorRequests() {
  const el = document.getElementById('doctor-requests');
  if (!el) return;

  try {
    const data = await api('/api/doctor-requests');
    const reqs = data.requests || [];
    if (!reqs.length) return el.innerHTML = `<div class="empty-state">No pending requests.</div>`;

    el.innerHTML = reqs.map(d => `
      <div class="list-row">
        <div><strong>${d.doctor_name}</strong> — ${d.specialization} (${d.available_time}) • ${d.email || 'no email'}</div>
        <div>
          <button data-action="approve-doc" data-id="${d.id}">Approve</button>
          <button data-action="reject-doc" data-id="${d.id}">Reject</button>
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load requests.</div>`;
  }
}

async function approveDoctor(id) {
  await api(`/api/doctors/${id}/approve`, { method: 'PATCH' });
  renderAdmin();
}

async function rejectDoctor(id) {
  await api(`/api/doctors/${id}/reject`, { method: 'PATCH' });
  renderAdmin();
}

async function renderDoctorList() {
  const el = document.getElementById('doctor-list');
  if (!el) return;

  try {
    const data = await api('/api/doctors/all');
    const docs = data.doctors || [];
    if (!docs.length) return el.innerHTML = `<div class="empty-state">No doctors yet.</div>`;

    el.innerHTML = docs.map(d => `
      <div class="list-row">
        <div>
          <strong>${d.doctor_name}</strong> — ${d.specialization} (${d.available_time})
          <span class="badge" data-status="${d.status}">${d.status}</span>
          ${d.email ? `<span class="badge">${d.email}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load doctors.</div>`;
  }
}

async function addDoctor() {
  const name = val('doc-name');
  const specialization = val('doc-spec');
  const available_time = val('doc-avail');
  const email = val('doc-email');
  const password = val('doc-pass');

  if (!name || !specialization) return;

  try {
    await api('/api/doctors', {
      method: 'POST',
      body: JSON.stringify({ name, specialization, available_time, email, password })
    });
    renderAdmin();
    fillDoctorOptions();
    renderDashboard();
  } catch {}
}

async function renderQueueMonitor() {
  const el = document.getElementById('queue-monitor');
  if (!el) return;

  try {
    const data = await api('/api/appointments');
    const appts = (data.appointments || []).filter(a => a.appointment_date === dateKey(new Date()) && a.status !== 'Cancelled');
    if (!appts.length) return el.innerHTML = `<div class="empty-state">No queue for today.</div>`;

    el.innerHTML = appts.map(a => `
      <div class="list-row">
        <div>${a.patient_name || 'Patient'} → ${a.doctor_name || 'Doctor'}</div>
        <div>Queue #${a.queue_no} | ${a.status}</div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load queue.</div>`;
  }
}

/* ── Reports ───────────────────────────────────────────────── */
async function renderReports() {
  const el = document.getElementById('reports-summary');
  if (!el) return;

  try {
    const stats = await api('/api/stats');
    el.innerHTML = `
      <div class="list-row"><div>Total Patients</div><div>${stats.totalPatients}</div></div>
      <div class="list-row"><div>Total Doctors</div><div>${stats.totalDoctors}</div></div>
      <div class="list-row"><div>Appointments Today</div><div>${stats.todayAppointments}</div></div>
      <div class="list-row"><div>Queue Length</div><div>${stats.queueLength}</div></div>
    `;
  } catch {
    el.innerHTML = `<div class="empty-state">Failed to load reports.</div>`;
  }
}

/* ── Helpers ──────────────────────────────────────────────── */
function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function updateSidebarUser() {
  const u = currentUser;
  const el = document.getElementById('sidebar-user');
  if (el) el.textContent = u ? `${u.name} (${u.role})` : 'Guest';
}