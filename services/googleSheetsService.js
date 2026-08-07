const DEMO_PATIENT_RECORDS = [
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
    status: "CONFIRMED"
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
    status: "CONFIRMED"
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
    status: "CONFIRMED"
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
    status: "CONFIRMED"
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
    status: "CONFIRMED"
  }
];

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
          (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
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
    const record = {
      timestamp: new Date().toISOString(),
      bookingId: bookingData.bookingId,
      patientName: bookingData.patientName,
      patientPhone: bookingData.patientPhone,
      patientEmail: bookingData.patientEmail,
      triageCategory: bookingData.triageLevel.code,
      symptoms: bookingData.symptoms,
      date: bookingData.date,
      time: bookingData.time,
      doctorAlertSent: bookingData.isEmergency ? "YES (PRIORITY SMS)" : "YES (STANDARD)",
      status: "CONFIRMED"
    };

    DEMO_PATIENT_RECORDS.unshift(record);

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

  async getAllRecords() {
    if (!this.isProduction) {
      return DEMO_PATIENT_RECORDS;
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Appointments!A2:K100'
      });

      const rows = response.data.values || [];
      return rows.map(r => ({
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
        status: r[10]
      }));
    } catch (error) {
      console.error("Failed to read Google Sheets:", error.message);
      return DEMO_PATIENT_RECORDS;
    }
  }
}

module.exports = new GoogleSheetsService();
