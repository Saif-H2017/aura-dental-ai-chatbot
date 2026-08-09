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

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.get('/admin.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(publicDir, 'admin.html'));
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

// API: Get Slots
app.get('/api/slots', async (req, res) => {
  try {
    const isUrgent = req.query.urgent === 'true';
    const slots = await googleCalendarService.getAvailableSlots(isUrgent);
    res.json({ slots });
  } catch (error) {
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

    const calendarResult = await googleCalendarService.bookAppointment(bookingPayload);

    const sheetsResult = await googleSheetsService.logAppointment({
      ...bookingPayload,
      bookingId: calendarResult.bookingId,
      isEmergency: calendarResult.isEmergency
    });

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

// API: Save Resend API Key
app.post('/api/admin/resend-config', (req, res) => {
  const { resendApiKey } = req.body;
  if (resendApiKey) {
    notificationService.setResendApiKey(resendApiKey);
    process.env.RESEND_API_KEY = resendApiKey;
    console.log("⚡ Resend API Key updated via Admin Portal!");
    return res.json({ success: true, message: "Resend Dual Email API connected successfully!" });
  }
  res.status(400).json({ error: "Resend API key is required." });
});

// API: Mark Appointment as Completed
app.post('/api/admin/records/complete', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: "Booking ID is required." });
    const result = await googleSheetsService.completeAppointment(bookingId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark appointment as completed" });
  }
});

// API: Clear Completed History
app.delete('/api/admin/records/history', async (req, res) => {
  try {
    const result = await googleSheetsService.clearHistory();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to clear appointment history" });
  }
});

// API: Save Gemini API Key
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

// API: Patient Records
app.get('/api/admin/records', async (req, res) => {
  try {
    const records = await googleSheetsService.getAllRecords();
    res.json({ records, count: records.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin records" });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: "online",
    appMode: process.env.APP_MODE || "demo",
    clinic: process.env.CLINIC_NAME || "Aura Dental Studio London",
    surgeon: process.env.SURGEON_NAME || "Dr. Alexander Wright, BDS",
    integrations: {
      gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
      resend: Boolean(process.env.RESEND_API_KEY),
      googleCalendarServiceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      googleSheets: Boolean(process.env.GOOGLE_SPREADSHEET_ID),
      twilioSms: Boolean(process.env.TWILIO_ACCOUNT_SID)
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`✨ AURA DENTAL STUDIO AI BACKEND RUNNING`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`👨‍⚕️ Surgeon Admin Portal: http://localhost:${PORT}/admin.html`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
