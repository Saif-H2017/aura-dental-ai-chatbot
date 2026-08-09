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
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.get('/admin.html', (req, res) => {
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

// API: Save Formspree Webhook Endpoint
app.post('/api/admin/formspree-config', (req, res) => {
  const { formspreeUrl } = req.body;
  if (formspreeUrl) {
    notificationService.setFormspreeUrl(formspreeUrl);
    console.log("💌 Formspree Endpoint updated:", formspreeUrl);
    return res.json({ success: true, message: "Formspree Email Webhook configured successfully!" });
  }
  res.status(400).json({ error: "Formspree endpoint URL is required." });
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

// API: Save Email SMTP credentials
app.post('/api/admin/email-config', async (req, res) => {
  const { doctorEmail, emailPassword, testPatientEmail } = req.body;
  if (!doctorEmail || !emailPassword) {
    return res.status(400).json({ error: "Doctor email and App password are required." });
  }

  process.env.SMTP_USER = doctorEmail;
  process.env.SMTP_PASS = emailPassword;
  process.env.SURGEON_EMAIL = doctorEmail;

  notificationService.setEmailConfig(doctorEmail, emailPassword);

  if (testPatientEmail) {
    try {
      const testResult = await notificationService.sendAppointmentNotifications({
        bookingId: "TEST-EMAIL-001",
        patientName: "Diagnostic Test Patient",
        patientPhone: "+447700900000",
        patientEmail: testPatientEmail,
        date: "2026-08-08",
        time: "10:00 AM",
        triageLevel: { code: "ROUTINE_CARE", title: "Routine Consultation Test" },
        symptoms: "Live SMTP Connection Diagnostic Test",
        isEmergency: false
      });

      const patientLog = testResult.logs.find(l => l.type.includes("EMAIL"));
      if (patientLog && patientLog.status === "SENT") {
        return res.json({
          success: true,
          message: `✅ LIVE EMAIL SUCCESS! Test email delivered to ${testPatientEmail} and ${doctorEmail}.`
        });
      } else {
        return res.status(500).json({
          error: `Email failed. Status: ${patientLog ? patientLog.detail : 'Unknown error'}`
        });
      }
    } catch (err) {
      return res.status(500).json({ error: `SMTP Transport Exception: ${err.message}` });
    }
  }

  return res.json({ success: true, message: `Email credentials set for ${doctorEmail}` });
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
      formspree: Boolean(process.env.FORMSPREE_URL),
      emailConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
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
