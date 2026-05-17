CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('patient','doctor','admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  doctor_name VARCHAR(120) NOT NULL,
  specialization VARCHAR(120) NOT NULL,
  available_time VARCHAR(120) DEFAULT '10:00–16:00',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Accepted','Rejected','Completed','Cancelled')),
  queue_no INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);