const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_FILE = path.join(os.tmpdir(), 'aura_booked_appointments.json');

function loadTmpBookings() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = fs.readFileSync(TMP_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    // Ignore tmp read errors
  }
  return [];
}

function saveTmpBooking(record) {
  try {
    const existing = loadTmpBookings();
    if (record.clear) {
      fs.writeFileSync(TMP_FILE, JSON.stringify([], null, 2), 'utf8');
    } else {
      existing.unshift(record);
      fs.writeFileSync(TMP_FILE, JSON.stringify(existing, null, 2), 'utf8');
    }
  } catch (e) {
    // Ignore tmp write errors
  }
}

let DEMO_PATIENT_RECORDS = process.env.DISABLE_DEMO_DATA === 'true' ? [] : [
  {
    timestamp: "2026-08-07T14:20:00Z",
    bookingId: "LND-DEN-882103",
    patientName: "Sarah Jenkins",
    patientPhone: "+44 7700 900123",
    patientEmail: "sarah.j@example.co.uk",
    triageCategory: "SAME_DAY_URGENT",
    symptoms: "Severe throbbing pain in upper right molar (Score 8/10)",
    date: "2026-08-08",
    time: "11:00 AM",
    doctorAlertSent: "YES (Priority SMS & WhatsApp)",
    status: "ACTIVE"
  },
  {
    timestamp: "2026-08-07T15:05:12Z",
    bookingId: "LND-DEN-491204",
    patientName: "Marcus Vance",
    patientPhone: "+44 7911 123456",
    patientEmail: "marcus.v@example.co.uk",
    triageCategory: "ROUTINE_CARE",
    symptoms: "Routine consultation & hygiene airflow cleaning",
    date: "2026-08-08",
    time: "02:15 PM",
    doctorAlertSent: "YES (Standard Notification)",
    status: "ACTIVE"
  },
  {
    timestamp: "2026-08-07T16:11:45Z",
    bookingId: "LND-DEN-302918",
    patientName: "Priya Sharma",
    patientPhone: "+44 7700 900888",
    patientEmail: "priya.s@example.co.uk",
    triageCategory: "SAME_DAY_URGENT",
    symptoms: "Chipped front incisor from accidental injury (Score 7/10)",
    date: "2026-08-08",
    time: "03:30 PM",
    doctorAlertSent: "YES (Priority SMS & WhatsApp)",
    status: "ACTIVE"
  },
  {
    timestamp: "2026-08-07T17:40:02Z",
    bookingId: "LND-DEN-710293",
    patientName: "David Miller",
    patientPhone: "+44 7911 987654",
    patientEmail: "david.m@example.co.uk",
    triageCategory: "ROUTINE_CARE",
    symptoms: "Laser teeth whitening consultation & shade assessment",
    date: "2026-08-10",
    time: "10:00 AM",
    doctorAlertSent: "YES (Standard Notification)",
    status: "ACTIVE"
  },
  {
    timestamp: "2026-08-07T18:02:30Z",
    bookingId: "LND-DEN-951024",
    patientName: "Emma Watson",
    patientPhone: "+44 7700 912345",
    patientEmail: "emma.w@example.co.uk",
    triageCategory: "ROUTINE_CARE",
    symptoms: "Invisalign alignment evaluation & 3D scan",
    date: "2026-08-10",
    time: "11:30 AM",
    doctorAlertSent: "YES (Standard Notification)",
    status: "ACTIVE"
  }
];

const INITIAL_SEED_DATA = [...DEMO_PATIENT_RECORDS];

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    this.isProduction = process.env.APP_MODE === 'production' && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && this.spreadsheetId;

    if (this.isProduction) {
      try {
        const { google } = require('googleapis');
        const auth = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          null,
          process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        this.sheets = google.sheets({ version: 'v4', auth });
        console.log("✅ Google Sheets Service Account initialized successfully.");
      } catch (err) {
        console.error("⚠️ Google Sheets Auth failed. Falling back to Demo Mode:", err.message);
        this.isProduction = false;
      }
    } else {
      console.log("ℹ️ Google Sheets running in Pre-populated Demo Database Mode.");
    }
  }

  async logAppointment(bookingData) {
    if (!bookingData) return { success: false, error: "No booking data provided" };

    const bookingId = bookingData.bookingId || bookingData.id || `LND-DEN-${Math.floor(100000 + Math.random() * 900000)}`;
    const triageCategory = (typeof bookingData.triageLevel === 'object' && bookingData.triageLevel !== null)
      ? (bookingData.triageLevel.code || "ROUTINE_CARE")
      : (bookingData.triageCategory || bookingData.triageCode || bookingData.triageLevel || "ROUTINE_CARE");

    const record = {
      timestamp: bookingData.timestamp || new Date().toISOString(),
      bookingId: bookingId,
      patientName: bookingData.patientName || "Unknown Patient",
      patientPhone: bookingData.patientPhone || "N/A",
      patientEmail: bookingData.patientEmail || "N/A",
      triageCategory: triageCategory,
      symptoms: bookingData.symptoms || "General Consultation",
      date: bookingData.date || new Date().toISOString().split('T')[0],
      time: bookingData.time || "10:00 AM",
      doctorAlertSent: (bookingData.isEmergency || (typeof triageCategory === 'string' && triageCategory.includes('URGENT'))) ? "YES (PRIORITY SMS)" : "YES (STANDARD)",
      status: bookingData.status || "ACTIVE"
    };

    DEMO_PATIENT_RECORDS.unshift(record);
    saveTmpBooking(record);

    if (!this.isProduction) {
      return { success: true, mode: "demo", record };
    }

    try {
      const values = [
        [
          record.timestamp,
          record.bookingId,
          record.patientName,
          record.patientPhone,
          record.patientEmail,
          record.triageCategory,
          record.symptoms,
          record.date,
          record.time,
          record.doctorAlertSent,
          record.status
        ]
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Appointments!A:K',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      return { success: true, mode: "production", record };
    } catch (error) {
      console.error("Google Sheets append failed:", error.message);
      return { success: true, mode: "fallback", record };
    }
  }

  async completeAppointment(bookingId) {
    const item = DEMO_PATIENT_RECORDS.find(r => r.bookingId === bookingId);
    if (item) {
      item.status = "COMPLETED";
      item.completedAt = new Date().toISOString();
      return { success: true, record: item };
    }
    return { success: false, error: "Record not found" };
  }

  async clearHistory() {
    let count = 0;
    for (let i = DEMO_PATIENT_RECORDS.length - 1; i >= 0; i--) {
      if (DEMO_PATIENT_RECORDS[i].status === "COMPLETED") {
        DEMO_PATIENT_RECORDS.splice(i, 1);
        count++;
      }
    }
    return { success: true, deletedCount: count };
  }

  async getAllRecords() {
    let records = [...DEMO_PATIENT_RECORDS];
    const tmp = loadTmpBookings();
    if (tmp.length > 0) {
      tmp.forEach(r => {
        if (!records.some(existing => existing.bookingId === r.bookingId)) {
          records.unshift(r);
        }
      });
    }

    if (!this.isProduction) {
      return records;
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Appointments!A2:K100'
      });

      const rows = response.data.values || [];
      const sheetRecords = rows.map(r => ({
        timestamp: r[0],
        bookingId: r[1],
        patientName: r[2],
        patientPhone: r[3],
        patientEmail: r[4],
        triageCategory: r[5],
        symptoms: r[6],
        date: r[7],
        time: r[8],
        doctorAlertSent: r[9],
        status: r[10] || "ACTIVE"
      }));

      return [...sheetRecords, ...records.filter(r => !sheetRecords.some(s => s.bookingId === r.bookingId))];
    } catch (error) {
      console.error("Failed to read Google Sheets:", error.message);
      return records;
    }
  }

  clearAllRecords() {
    DEMO_PATIENT_RECORDS.length = 0;
    saveTmpBooking({ clear: true });
    return { success: true, count: 0, message: "Database reset to clean client mode." };
  }

  restoreDemoRecords() {
    DEMO_PATIENT_RECORDS.length = 0;
    DEMO_PATIENT_RECORDS.push(...INITIAL_SEED_DATA);
    return { success: true, count: DEMO_PATIENT_RECORDS.length, message: "Sample demo patient records restored." };
  }

  // Aliases for seamless route compatibility across server.js endpoints
  addAppointment(bookingData) {
    return this.logAppointment(bookingData);
  }

  getAllAppointments() {
    return this.getAllRecords();
  }

  deleteCompletedHistory() {
    return this.clearHistory();
  }
}

module.exports = new GoogleSheetsService();
