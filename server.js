const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/* ── Auth APIs ─────────────────────────────────────────────── */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, specialization, available_time } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role',
      [name, email, hash, role]
    );

    const user = result.rows[0];

    if (role === 'doctor') {
      if (!specialization) return res.status(400).json({ error: 'Specialization required' });
      await pool.query(
        'INSERT INTO doctors (user_id, doctor_name, specialization, available_time, status) VALUES ($1,$2,$3,$4,$5)',
        [user.id, name, specialization, available_time || '10:00–16:00', 'pending']
      );
    }

    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    return res.json({ user });
  } catch (err) {
    if (String(err).includes('unique')) return res.status(409).json({ error: 'Email already exists' });
    return res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email=$1 AND role=$2', [email, role]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

/* ── Doctors ──────────────────────────────────────────────── */
app.get('/api/doctors', authRequired, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, doctor_name, specialization, available_time FROM doctors WHERE status=$1 ORDER BY doctor_name',
      ['approved']
    );
    res.json({ doctors: r.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

app.get('/api/doctors/all', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.id, d.doctor_name, d.specialization, d.available_time, d.status, u.email
       FROM doctors d
       LEFT JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );
    res.json({ doctors: r.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

app.get('/api/doctor-requests', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.id, d.doctor_name, d.specialization, d.available_time, u.email
       FROM doctors d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.status='pending'
       ORDER BY d.created_at DESC`
    );
    res.json({ requests: r.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

app.post('/api/doctors', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { name, specialization, available_time, email, password } = req.body || {};
    if (!name || !specialization) return res.status(400).json({ error: 'Missing fields' });

    let userId = null;
    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      const u = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id',
        [name, email, hash, 'doctor']
      );
      userId = u.rows[0].id;
    }

    const r = await pool.query(
      'INSERT INTO doctors (user_id, doctor_name, specialization, available_time, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [userId, name, specialization, available_time || '10:00–16:00', 'approved']
    );

    res.json({ doctor: r.rows[0] });
  } catch (err) {
    if (String(err).includes('unique')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to add doctor' });
  }
});

app.patch('/api/doctors/:id/approve', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query('UPDATE doctors SET status=$1 WHERE id=$2 RETURNING *', ['approved', req.params.id]);
    res.json({ doctor: r.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to approve' });
  }
});

app.patch('/api/doctors/:id/reject', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query('UPDATE doctors SET status=$1 WHERE id=$2 RETURNING *', ['rejected', req.params.id]);
    res.json({ doctor: r.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

/* ── Appointments ──────────────────────────────────────────── */
app.post('/api/appointments', authRequired, requireRole('patient'), async (req, res) => {
  try {
    const { doctor_id, date, time } = req.body || {};
    if (!doctor_id || !date || !time) return res.status(400).json({ error: 'Missing fields' });

    const count = await pool.query(
      'SELECT COUNT(*)::int AS c FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND status != $3',
      [doctor_id, date, 'Cancelled']
    );

    const queueNo = (count.rows[0]?.c || 0) + 1;

    const r = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, queue_no)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, doctor_id, date, time, 'Pending', queueNo]
    );

    res.json({ appointment: r.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

app.get('/api/appointments', authRequired, async (req, res) => {
  try {
    if (req.user.role === 'patient') {
      const r = await pool.query(
        `SELECT a.*, d.doctor_name, d.specialization
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.patient_id=$1
         ORDER BY a.created_at DESC`,
        [req.user.id]
      );
      return res.json({ appointments: r.rows });
    }

    if (req.user.role === 'doctor') {
      const d = await pool.query('SELECT id FROM doctors WHERE user_id=$1', [req.user.id]);
      const doctorId = d.rows[0]?.id;
      if (!doctorId) return res.json({ appointments: [] });

      const r = await pool.query(
        `SELECT a.*, u.name AS patient_name, u.email AS patient_email
         FROM appointments a
         JOIN users u ON a.patient_id = u.id
         WHERE a.doctor_id=$1
         ORDER BY a.created_at DESC`,
        [doctorId]
      );
      return res.json({ appointments: r.rows });
    }

    // admin
    const r = await pool.query(
      `SELECT a.*, u.name AS patient_name, u.email AS patient_email, d.doctor_name
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       ORDER BY a.created_at DESC`
    );
    return res.json({ appointments: r.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load appointments' });
  }
});

app.patch('/api/appointments/:id/status', authRequired, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Missing status' });

    if (req.user.role === 'patient') {
      const r = await pool.query(
        'UPDATE appointments SET status=$1 WHERE id=$2 AND patient_id=$3 AND status=$4 RETURNING *',
        ['Cancelled', req.params.id, req.user.id, 'Pending']
      );
      return res.json({ appointment: r.rows[0] || null });
    }

    if (req.user.role === 'doctor') {
      const d = await pool.query('SELECT id FROM doctors WHERE user_id=$1', [req.user.id]);
      const doctorId = d.rows[0]?.id;
      if (!doctorId) return res.status(403).json({ error: 'Not a doctor' });

      const r = await pool.query(
        'UPDATE appointments SET status=$1 WHERE id=$2 AND doctor_id=$3 RETURNING *',
        [status, req.params.id, doctorId]
      );
      return res.json({ appointment: r.rows[0] || null });
    }

    // admin
    const r = await pool.query(
      'UPDATE appointments SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    return res.json({ appointment: r.rows[0] || null });
  } catch {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/* ── Stats ────────────────────────────────────────────────── */
app.get('/api/stats', authRequired, async (req, res) => {
  try {
    const patients = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role='patient'");
    const doctors  = await pool.query("SELECT COUNT(*)::int AS c FROM doctors WHERE status='approved'");
    const today    = await pool.query("SELECT COUNT(*)::int AS c FROM appointments WHERE appointment_date = CURRENT_DATE");
    const queue    = await pool.query("SELECT COUNT(*)::int AS c FROM appointments WHERE appointment_date = CURRENT_DATE AND status IN ('Pending','Accepted')");

    res.json({
      totalPatients: patients.rows[0].c,
      totalDoctors: doctors.rows[0].c,
      todayAppointments: today.rows[0].c,
      queueLength: queue.rows[0].c
    });
  } catch {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

/* ── Serve pages ───────────────────────────────────────────── */
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));