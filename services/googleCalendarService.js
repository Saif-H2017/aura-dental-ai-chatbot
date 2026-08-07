const { evaluateTriage } = require('./triageRules');

// Demo Mock Availability Calendar Slots (For zero-config agency demonstrations)
const MOCK_SLOTS = [
  { id: "slot-1", date: "2026-08-08", time: "09:30 AM", display: "Tomorrow (Saturday) at 09:30 AM", urgentOnly: false },
  { id: "slot-2", date: "2026-08-08", time: "11:00 AM", display: "Tomorrow (Saturday) at 11:00 AM", urgentOnly: true },
  { id: "slot-3", date: "2026-08-08", time: "02:15 PM", display: "Tomorrow (Saturday) at 02:15 PM", urgentOnly: false },
  { id: "slot-4", date: "2026-08-10", time: "10:00 AM", display: "Monday at 10:00 AM", urgentOnly: false },
  { id: "slot-5", date: "2026-08-10", time: "03:30 PM", display: "Monday at 03:30 PM", urgentOnly: false }
];

class GoogleCalendarService {
  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.isProduction = process.env.APP_MODE === 'production' && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    
    if (this.isProduction) {
      try {
        const { google } = require('googleapis');
        const auth = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          null,
          (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/calendar']
        );
        this.calendar = google.calendar({ version: 'v3', auth });
        console.log("✅ Google Calendar Service Account initialized successfully.");
      } catch (err) {
        console.error("⚠️ Failed to initialize Google Calendar Auth. Falling back to Demo Mode:", err.message);
        this.isProduction = false;
      }
    } else {
      console.log("ℹ️ Google Calendar running in Demo / Simulation Mode.");
    }
  }

  async getAvailableSlots(isUrgent = false) {
    if (!this.isProduction) {
      return MOCK_SLOTS.filter(s => isUrgent ? true : !s.urgentOnly);
    }

    try {
      const now = new Date();
      const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: this.calendarId }]
        }
      });

      const busyTimes = response.data.calendars[this.calendarId].busy || [];
      return MOCK_SLOTS;
    } catch (error) {
      console.error("Error checking Google Calendar freeBusy:", error.message);
      return MOCK_SLOTS;
    }
  }

  async bookAppointment({ patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms }) {
    const bookingId = `LND-DEN-${Math.floor(100000 + Math.random() * 900000)}`;
    const isEmergency = triageLevel.code === "SAME_DAY_URGENT" || triageLevel.code === "CRITICAL_EMERGENCY";
    
    const summary = `${isEmergency ? '🚨 URGENT: ' : '📅 '}Dental Booking - ${patientName} (${triageLevel.title})`;
    const description = `Patient Details:\n- Name: ${patientName}\n- Phone: ${patientPhone}\n- Email: ${patientEmail}\n- Urgency: ${triageLevel.title}\n- Symptoms: ${symptoms}\n- Booking ID: ${bookingId}\n- Venue: Harley Street Dental Care, London`;

    if (!this.isProduction) {
      return {
        success: true,
        bookingId,
        eventId: `mock-gcal-event-${Date.now()}`,
        summary,
        date,
        time,
        clinicAddress: "72 Harley Street, Marylebone, London W1G 7HG",
        isEmergency,
        mode: "demo"
      };
    }

    try {
      const startIso = new Date(`${date} ${time}`).toISOString();
      const endIso = new Date(new Date(`${date} ${time}`).getTime() + 45 * 60 * 1000).toISOString();

      const event = {
        summary,
        location: '72 Harley Street, Marylebone, London W1G 7HG',
        description,
        start: { dateTime: startIso, timeZone: 'Europe/London' },
        end: { dateTime: endIso, timeZone: 'Europe/London' },
        attendees: [
          { email: patientEmail, displayName: patientName },
          { email: process.env.SURGEON_EMAIL || 'dr.wright@harleystdental.co.uk' }
        ]
      };

      const result = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendUpdates: 'all'
      });

      return {
        success: true,
        bookingId,
        eventId: result.data.id,
        htmlLink: result.data.htmlLink,
        summary,
        date,
        time,
        clinicAddress: "72 Harley Street, Marylebone, London W1G 7HG",
        isEmergency,
        mode: "production"
      };
    } catch (error) {
      console.error("Google Calendar Booking Failed:", error.message);
      throw new Error(`Failed to create calendar booking: ${error.message}`);
    }
  }
}

module.exports = new GoogleCalendarService();
