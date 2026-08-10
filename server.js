require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const geminiService = require('./services/geminiService');
const googleCalendarService = require('./services/googleCalendarService');
const googleSheetsService = require('./services/googleSheetsService');
const notificationService = require('./services/notificationService');
const { evaluateTriage } = require('./services/triageRules');
const publicIndexHtml = require('./services/publicIndexHtml');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Direct Module Export HTML Stream Handler (Guarantees zero-delay updates on Vercel Edge)
const serveFreshIndexHtml = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(publicIndexHtml);
};

app.get('/', serveFreshIndexHtml);
app.get('/index.html', serveFreshIndexHtml);

// Explicit favicon route handlers
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(publicDir, 'favicon.ico'));
});
app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(publicDir, 'favicon.svg'));
});
app.get('/favicon.jpg', (req, res) => {
  res.sendFile(path.join(publicDir, 'favicon.jpg'));
});

// Admin portal routes with no-cache headers
app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.get('/admin.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// API: Surgeon Login Authentication
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const AUTHORIZED_EMAIL = process.env.SURGEON_LOGIN_EMAIL || 'saif.247ozx@gmail.com';
  const AUTHORIZED_PASS = process.env.SURGEON_LOGIN_PASS || 'SaifAsif_678';

  if (email && email.toLowerCase().trim() === AUTHORIZED_EMAIL.toLowerCase() && password === AUTHORIZED_PASS) {
    console.log(`🔐 Surgeon Login Granted for ${email}`);
    return res.json({
      success: true,
      token: "AUTH_SURGEON_GRANTED_SESSION_TOKEN_678",
      user: { name: "Dr. Alexander Wright / Muhammad Saif", email: AUTHORIZED_EMAIL }
    });
  }

  console.warn(`🔒 Failed login attempt for email: ${email}`);
  return res.status(401).json({ success: false, error: "Invalid surgeon email or password." });
});

// API: Save Google Calendar Credentials
app.post('/api/admin/calendar-config', (req, res) => {
  const { calendarId, serviceAccountEmail, privateKey } = req.body;
  
  googleCalendarService.setCalendarConfig({
    calendarId: calendarId || 'primary',
    serviceAccountEmail,
    privateKey
  });

  if (calendarId) process.env.GOOGLE_CALENDAR_ID = calendarId;
  if (serviceAccountEmail) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = serviceAccountEmail;
  if (privateKey) process.env.GOOGLE_PRIVATE_KEY = privateKey;

  console.log("📅 Google Calendar Integration Configured!");
  return res.json({
    success: true,
    message: "Google Calendar connected successfully!",
    calendarId: calendarId || 'primary'
  });
});

// API: Process Chat Message
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory, bookingDraft } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    const result = await geminiService.processMessage(chatHistory || [], message, bookingDraft || {});
    res.json(result);
  } catch (error) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: "Failed to process chat message", details: error.message });
  }
});

// API: Get Slots with No-Cache Headers & Live Real-Time PKT Sync
app.get('/api/slots', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const isUrgent = req.query.urgent === 'true';
    const slots = await googleCalendarService.getAvailableSlots(isUrgent);
    res.json({ slots, total: slots.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// API: Book Appointment (Dispatches Email + Add to Google Calendar)
app.post('/api/appointments/book', async (req, res) => {
  try {
    const { patientName, patientPhone, patientEmail, date, time, symptoms, painScore } = req.body;

    if (!patientName || !patientPhone || !patientEmail || !date || !time) {
      return res.status(400).json({ error: "Missing required booking fields" });
    }

    const triageLevel = evaluateTriage(symptoms || "", painScore);

    // 1. Book in Google Calendar Service
    const calendarResult = await googleCalendarService.bookAppointment({
      patientName,
      patientPhone,
      patientEmail,
      date,
      time,
      triageLevel,
      symptoms: symptoms || "General Consultation"
    });

    const appointmentRecord = {
      id: calendarResult.bookingId,
      patientName,
      patientPhone,
      patientEmail,
      date,
      time,
      symptoms: symptoms || "General Consultation",
      triageLevel: triageLevel.title,
      triageCode: triageLevel.code,
      status: "Confirmed",
      gcalUrl: calendarResult.gcalUrl,
      createdAt: new Date().toISOString()
    };

    // 2. Append to Database / Demo Memory
    googleSheetsService.addAppointment(appointmentRecord);

    // 3. Dispatch Dual Email Notifications (Patient Confirmation + Doctor Alert)
    await notificationService.sendDualBookingNotifications(appointmentRecord);

    res.json({
      success: true,
      bookingId: calendarResult.bookingId,
      date,
      time,
      gcalUrl: calendarResult.gcalUrl,
      message: "Appointment confirmed! Email & Google Calendar link dispatched."
    });

  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ error: "Failed to process booking", details: error.message });
  }
});

// API: Get Admin Appointments List (Supported on both /api/admin/appointments & /api/admin/records)
const getAdminAppointmentsHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const records = await googleSheetsService.getAllAppointments();
  res.json({ success: true, records, appointments: records });
};
app.get('/api/admin/appointments', getAdminAppointmentsHandler);
app.get('/api/admin/records', getAdminAppointmentsHandler);

// API: Complete Appointment
const completeAppointmentHandler = async (req, res) => {
  const id = req.body.id || req.body.bookingId;
  if (!id) return res.status(400).json({ error: "Booking ID is required" });
  
  const result = await googleSheetsService.completeAppointment(id);
  res.json({ success: true, id, result });
};
app.post('/api/admin/appointments/complete', completeAppointmentHandler);
app.post('/api/admin/records/complete', completeAppointmentHandler);

// API: Delete Completed History
const deleteHistoryHandler = async (req, res) => {
  const result = await googleSheetsService.deleteCompletedHistory();
  const count = (result && (result.deletedCount || result.count)) || 0;
  res.json({ success: true, count, deletedCount: count });
};
app.post('/api/admin/appointments/delete-history', deleteHistoryHandler);
app.post('/api/admin/records/history', deleteHistoryHandler);
app.delete('/api/admin/records/history', deleteHistoryHandler);

// API: Save Dynamic Gemini API Key
app.post('/api/admin/config', (req, res) => {
  const { geminiKey } = req.body;
  if (geminiKey) {
    geminiService.setApiKey(geminiKey);
    process.env.GEMINI_API_KEY = geminiKey;
    res.json({ success: true, message: "Gemini API key updated successfully!" });
  } else {
    res.status(400).json({ error: "Invalid API key" });
  }
});

// API: URGENT RECEPTION CALLBACK HANDLER
app.post('/api/admin/callback', async (req, res) => {
  try {
    const { patientName, patientPhone } = req.body;
    if (!patientName || !patientPhone) {
      return res.status(400).json({ error: "Patient name and phone number required" });
    }

    console.log(`🚨 RECEPTION CALLBACK REQUESTED BY: ${patientName} (${patientPhone})`);

    const callbackRecord = {
      id: `CB-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName,
      patientPhone,
      patientEmail: "N/A (Callback Request)",
      date: new Date().toISOString().split('T')[0],
      time: "IMMEDIATE CALLBACK",
      symptoms: "🚨 Urgent Phone Callback Requested via AI Receptionist",
      triageLevel: "Urgent Callback",
      triageCode: "SAME_DAY_URGENT",
      status: "Pending Callback",
      createdAt: new Date().toISOString()
    };

    googleSheetsService.addAppointment(callbackRecord);
    await notificationService.sendDualBookingNotifications(callbackRecord);

    res.json({ success: true, message: "Callback request registered!" });
  } catch (err) {
    console.error("Error handling callback request:", err);
    res.status(500).json({ error: "Failed to process callback" });
  }
});

// Catch-all route to serve fresh index.html
app.get('*', serveFreshIndexHtml);

// Start Server locally
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally at http://localhost:${PORT}`);
    console.log(`🔐 Surgeon Admin Portal at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
