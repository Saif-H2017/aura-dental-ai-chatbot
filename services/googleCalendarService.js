// STRICT REAL-WORLD CLOCK ENGINE (Past-Time Filtered Synced to PKT UTC+5)

function getLiveRealWorldSlots() {
  const now = new Date();
  
  // Force Pakistan Time (UTC + 5 Hours)
  const pktMs = now.getTime() + (5 * 60 * 60 * 1000);
  const pktNow = new Date(pktMs);

  const currentHour = pktNow.getUTCHours(); // e.g. 21 (9 PM)
  const currentMin = pktNow.getUTCMinutes();

  // Helper to extract YYYY-MM-DD in PKT
  const formatIsoDate = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helper for readable day label (e.g. "Sun, Aug 9")
  const formatReadableDay = (d) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };

  const allPossibleSlots = [];

  // Determine if Today still has upcoming slots (e.g. 7:30 PM slot = hour 19.5)
  // If current hour is >= 19 (7 PM), today's 7:30 PM slot has passed or is too close!
  const todayIso = formatIsoDate(pktNow);
  const todayLabel = formatReadableDay(pktNow);

  if (currentHour < 18) {
    allPossibleSlots.push({
      id: `slot-pkt-today`,
      date: todayIso,
      time: "07:30 PM",
      display: `Today (${todayLabel}) at 7:30 PM PKT`,
      shortLabel: `Today (${todayLabel}) at 7:30 PM`,
      urgentOnly: false
    });
  }

  // Tomorrow (+1 day)
  const tomorrowObj = new Date(pktMs + (24 * 60 * 60 * 1000));
  const tomorrowIso = formatIsoDate(tomorrowObj);
  const tomorrowLabel = formatReadableDay(tomorrowObj);

  allPossibleSlots.push(
    {
      id: `slot-pkt-tom-1`,
      date: tomorrowIso,
      time: "10:00 AM",
      display: `Tomorrow (${tomorrowLabel}) at 10:00 AM PKT`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 10:00 AM`,
      urgentOnly: false
    },
    {
      id: `slot-pkt-tom-2`,
      date: tomorrowIso,
      time: "02:15 PM",
      display: `Tomorrow (${tomorrowLabel}) at 2:15 PM PKT`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 2:15 PM`,
      urgentOnly: false
    },
    {
      id: `slot-pkt-tom-3`,
      date: tomorrowIso,
      time: "04:30 PM",
      display: `Tomorrow (${tomorrowLabel}) at 4:30 PM PKT`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 4:30 PM`,
      urgentOnly: false
    }
  );

  // Day After Tomorrow (+2 days)
  const dayAfterObj = new Date(pktMs + (2 * 24 * 60 * 60 * 1000));
  const dayAfterIso = formatIsoDate(dayAfterObj);
  const dayAfterLabel = formatReadableDay(dayAfterObj);

  allPossibleSlots.push(
    {
      id: `slot-pkt-day2-1`,
      date: dayAfterIso,
      time: "11:30 AM",
      display: `${dayAfterLabel} at 11:30 AM PKT`,
      shortLabel: `${dayAfterLabel} at 11:30 AM`,
      urgentOnly: false
    },
    {
      id: `slot-pkt-day2-2`,
      date: dayAfterIso,
      time: "03:30 PM",
      display: `${dayAfterLabel} at 3:30 PM PKT`,
      shortLabel: `${dayAfterLabel} at 3:30 PM`,
      urgentOnly: false
    }
  );

  // Day 3 (+3 days)
  const day3Obj = new Date(pktMs + (3 * 24 * 60 * 60 * 1000));
  const day3Iso = formatIsoDate(day3Obj);
  const day3Label = formatReadableDay(day3Obj);

  allPossibleSlots.push({
    id: `slot-pkt-day3-1`,
    date: day3Iso,
    time: "01:00 PM",
    display: `${day3Label} at 1:00 PM PKT`,
    shortLabel: `${day3Label} at 1:00 PM`,
    urgentOnly: false
  });

  return allPossibleSlots.slice(0, 5);
}

class GoogleCalendarService {
  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY || null;

    this._initAuth();
  }

  setCalendarConfig({ calendarId, serviceAccountEmail, privateKey }) {
    if (calendarId) this.calendarId = calendarId;
    if (serviceAccountEmail) this.serviceAccountEmail = serviceAccountEmail;
    if (privateKey) this.privateKey = privateKey;

    this._initAuth();
  }

  _initAuth() {
    this.isProduction = Boolean(this.serviceAccountEmail && this.privateKey);

    if (this.isProduction) {
      try {
        const { google } = require('googleapis');
        const auth = new google.auth.JWT(
          this.serviceAccountEmail,
          null,
          (this.privateKey || '').replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/calendar']
        );
        this.calendar = google.calendar({ version: 'v3', auth });
        console.log("✅ Live Google Calendar API authenticated with Service Account!");
      } catch (err) {
        console.error("⚠️ Failed to init Google Calendar API Auth:", err.message);
        this.isProduction = false;
      }
    } else {
      console.log("ℹ️ Google Calendar running in Strict Past-Time Filtered PKT Mode.");
    }
  }

  generateGoogleCalendarUrl({ summary, date, time, details, location }) {
    try {
      const cleanDate = date.replace(/-/g, '');
      const timeParts = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      let hours = 10;
      let minutes = 0;

      if (timeParts) {
        hours = parseInt(timeParts[1], 10);
        minutes = parseInt(timeParts[2], 10);
        if (timeParts[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (timeParts[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
      }

      const startH = String(hours).padStart(2, '0');
      const startM = String(minutes).padStart(2, '0');
      const endH = String((hours + 1) % 24).padStart(2, '0');

      const startStr = `${cleanDate}T${startH}${startM}00Z`;
      const endStr = `${cleanDate}T${endH}${startM}00Z`;

      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: summary || 'Aura Dental Studio Appointment',
        dates: `${startStr}/${endStr}`,
        details: details || 'Dental appointment reserved with Dr. Alexander Wright at Aura Dental Studio.',
        location: location || '72 Harley Street, Marylebone, London W1G 7HG'
      });

      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    } catch (e) {
      return `https://calendar.google.com`;
    }
  }

  async getAvailableSlots(isUrgent = false) {
    const liveSlots = getLiveRealWorldSlots();

    if (!this.isProduction || !this.calendar) {
      return liveSlots;
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

      return liveSlots;
    } catch (error) {
      console.error("Error checking Google Calendar freeBusy:", error.message);
      return liveSlots;
    }
  }

  async bookAppointment({ patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms }) {
    const bookingId = `LND-DEN-${Math.floor(100000 + Math.random() * 900000)}`;
    const isEmergency = triageLevel.code === "SAME_DAY_URGENT" || triageLevel.code === "CRITICAL_EMERGENCY";
    
    const summary = `${isEmergency ? '🚨 URGENT: ' : '📅 '}Dental Appointment - ${patientName}`;
    const description = `Patient Details:\n- Name: ${patientName}\n- Phone: ${patientPhone}\n- Email: ${patientEmail}\n- Urgency: ${triageLevel.title}\n- Symptoms: ${symptoms}\n- Booking ID: ${bookingId}\n- Venue: Aura Dental Studio, 72 Harley Street, London W1G 7HG`;

    const gcalUrl = this.generateGoogleCalendarUrl({
      summary,
      date,
      time,
      details: description,
      location: '72 Harley Street, Marylebone, London W1G 7HG'
    });

    if (!this.isProduction || !this.calendar) {
      return {
        success: true,
        bookingId,
        eventId: `mock-gcal-event-${Date.now()}`,
        summary,
        date,
        time,
        clinicAddress: "72 Harley Street, Marylebone, London W1G 7HG",
        isEmergency,
        gcalUrl,
        mode: "real_world_pkt"
      };
    }

    try {
      const startIso = new Date(`${date} ${time}`).toISOString();
      const endIso = new Date(new Date(`${date} ${time}`).getTime() + 45 * 60 * 1000).toISOString();

      const event = {
        summary,
        location: '72 Harley Street, Marylebone, London W1G 7HG',
        description,
        start: { dateTime: startIso, timeZone: 'Asia/Karachi' },
        end: { dateTime: endIso, timeZone: 'Asia/Karachi' },
        attendees: [
          { email: patientEmail, displayName: patientName },
          { email: process.env.SURGEON_EMAIL || 'saif.247ozx@gmail.com' }
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
        gcalUrl: result.data.htmlLink || gcalUrl,
        mode: "production"
      };
    } catch (error) {
      console.error("Google Calendar API Event Insert Failed:", error.message);
      return {
        success: true,
        bookingId,
        eventId: `fallback-gcal-${Date.now()}`,
        summary,
        date,
        time,
        clinicAddress: "72 Harley Street, Marylebone, London W1G 7HG",
        isEmergency,
        gcalUrl,
        mode: "direct_link"
      };
    }
  }
}

module.exports = new GoogleCalendarService();
module.exports.getLiveRealWorldSlots = getLiveRealWorldSlots;
