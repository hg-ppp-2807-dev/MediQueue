# MediQueue 🏥
## Web-Based Smart Healthcare Appointment & Queue Management System

MediQueue is a full-stack healthcare management platform designed to simplify hospital appointment booking and doctor-patient coordination. The system provides separate dashboards for Patients, Doctors, and Admins with secure authentication and role-based access control.

---

# 🚀 Features

## 👤 Patient Module
- Patient Signup/Login
- View approved doctors
- Book appointments
- View appointment history
- Track appointment status

---

## 🩺 Doctor Module
- Doctor Signup/Login
- Profile management
- Appointment management
- Update appointment status
- Pending approval workflow

---

## 🛡️ Admin Module
- Admin dashboard
- Approve/reject doctor registrations
- View all appointments
- Manage doctors and patients
- Monitor healthcare workflow

---

# 🔐 Authentication
- JWT Authentication
- httpOnly Cookie-based session handling
- Protected role-based routes
- Secure login/signup system

---

# 🏗️ Tech Stack

## Frontend
- HTML5
- CSS3
- JavaScript
- React.js
- Tailwind CSS / Bootstrap

## Backend
- Node.js
- Express.js

## Database
- PostgreSQL

## Authentication
- JWT (JSON Web Token)
- bcrypt.js

---

# 📂 Project Structure

```plaintext
MediQueue/
│
├── client/                 # Frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── layouts/
│   │   └── services/
│
├── server/                 # Backend
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── models/
│   ├── config/
│   └── database/
│
├── README.md
└── package.json