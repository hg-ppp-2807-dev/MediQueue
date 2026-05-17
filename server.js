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
        'INSERT INTO doctors (user_id, doctor_name, specialization, available_time) VALUES ($1,$2,$3,$4)',
        [user.id, name, specialization, available_time || '10:00–16:00']
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

app.get('/api/doctors', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, doctor_name, specialization, available_time FROM doctors ORDER BY doctor_name');
    res.json({ doctors: r.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

/* ── Serve role pages ──────────────────────────────────────── */
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));