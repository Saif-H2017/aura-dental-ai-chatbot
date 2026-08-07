require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const geminiService = require('./services/geminiService');
const googleCalendarService = require('./services/googleCalendarService');
const googleSheetsService = require('./services/googleSheetsService');
const notificationService = require('./services/notificationService');
const { evaluateTriage } = require('./services/triageRules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Process Chat Message with Gemini & Triage Engine
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory, bookingDraft } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await geminiService.processMessage(chatHistory || [], message, bookingDraft || {});
    res.json(result);
  } catch (error) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: "Failed to process chat message", details: error.message });
  }
});

// API: Get Available Calendar Slots
app.get('/api/slots', async (req, res) => {
  try {
    const isUrgent = req.query.urgent === 'true';
    const slots = await googleCalendarService.getAvailableSlots(isUrgent);
    res.json({ slots });
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// API: Complete Appointment Booking
app.post('/api/appointments/book', async (req, res) => {
  try {
    const { patientName, patientPhone, patientEmail, date, time, symptoms, painScore } = req.body;

    if (!patientName || !patientPhone || !patientEmail || !date || !time) {
      return res.status(400).json({ error: "Missing required patient or slot details." });
    }

    // Evaluate Clinical Triage
    const triageLevel = evaluateTriage(symptoms || "", painScore);

    const bookingPayload = {
      patientName,
      patientPhone,
      patientEmail,
      date,
      time,
      triageLevel,
      symptoms: symptoms || "Routine dental consultation",
      painScore: painScore || 0
    };

    // 1. Book in Google Calendar
    const calendarResult = await googleCalendarService.bookAppointment(bookingPayload);

    // 2. Log in Google Sheets Database
    const sheetsResult = await googleSheetsService.logAppointment({
      ...bookingPayload,
      bookingId: calendarResult.bookingId,
      isEmergency: calendarResult.isEmergency
    });

    // 3. Dispatch SMS / WhatsApp to Doctor Phone & Patient Confirmation
    const notificationResult = await notificationService.sendAppointmentNotifications({
      ...bookingPayload,
      bookingId: calendarResult.bookingId,
      isEmergency: calendarResult.isEmergency
    });

    res.json({
      success: true,
      bookingId: calendarResult.bookingId,
      summary: calendarResult.summary,
      date,
      time,
      clinicAddress: calendarResult.clinicAddress,
      triageLevel,
      notifications: notificationResult.logs,
      sheetsLogged: sheetsResult.success,
      mode: calendarResult.mode
    });

  } catch (error) {
    console.error("Error in /api/appointments/book:", error);
    res.status(500).json({ error: "Booking execution failed", details: error.message });
  }
});

// API: Save Gemini API Key runtime
app.post('/api/admin/config', (req, res) => {
  const { apiKey } = req.body;
  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
    geminiService.setApiKey(apiKey);
    console.log("🔑 Gemini API Key updated via Admin Portal!");
    return res.json({ success: true, message: "Gemini API key updated successfully." });
  }
  res.status(400).json({ error: "API key is required." });
});

// API: Doctor Admin Portal Patient Records
app.get('/api/admin/records', async (req, res) => {
  try {
    const records = await googleSheetsService.getAllRecords();
    res.json({ records, count: records.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin records" });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: "online",
    appMode: process.env.APP_MODE || "demo",
    clinic: process.env.CLINIC_NAME || "Aura Dental Studio London",
    surgeon: process.env.SURGEON_NAME || "Dr. Alexander Wright, BDS",
    integrations: {
      gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
      googleCalendarServiceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      googleSheets: Boolean(process.env.GOOGLE_SPREADSHEET_ID),
      twilioSms: Boolean(process.env.TWILIO_ACCOUNT_SID)
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`✨ AURA DENTAL STUDIO AI BACKEND RUNNING`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`👨‍⚕️ Surgeon Admin Portal: http://localhost:${PORT}/admin.html`);
  console.log(`==================================================\n`);
});
