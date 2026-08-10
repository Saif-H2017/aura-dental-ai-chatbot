// STRICT REAL-WORLD CLOCK ENGINE (Europe/London UK Time GMT/BST)

function getLondonTimeComponents(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = {};
  formatter.formatToParts(date).forEach(p => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    isoDate: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function getLiveRealWorldSlots() {
  const now = new Date();
  const londonNow = getLondonTimeComponents(now);

  const formatIsoDate = (d) => {
    return getLondonTimeComponents(d).isoDate;
  };

  const formatReadableDay = (d) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(d);
  };

  const allPossibleSlots = [];

  const todayIso = londonNow.isoDate;
  const todayLabel = formatReadableDay(now);

  // If London hour < 17 (5 PM), today's 5:30 PM slot is still available
  if (londonNow.hour < 17) {
    allPossibleSlots.push({
      id: `slot-uk-today`,
      date: todayIso,
      time: "5:30 PM",
      display: `Today (${todayLabel}) at 5:30 PM UK Time`,
      shortLabel: `Today (${todayLabel}) at 5:30 PM`,
      urgentOnly: false
    });
  }

  // Tomorrow (+1 day)
  const tomorrowObj = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const tomorrowIso = formatIsoDate(tomorrowObj);
  const tomorrowLabel = formatReadableDay(tomorrowObj);

  allPossibleSlots.push(
    {
      id: `slot-uk-tom-1`,
      date: tomorrowIso,
      time: "10:00 AM",
      display: `Tomorrow (${tomorrowLabel}) at 10:00 AM UK Time`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 10:00 AM`,
      urgentOnly: false
    },
    {
      id: `slot-uk-tom-2`,
      date: tomorrowIso,
      time: "2:15 PM",
      display: `Tomorrow (${tomorrowLabel}) at 2:15 PM UK Time`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 2:15 PM`,
      urgentOnly: false
    },
    {
      id: `slot-uk-tom-3`,
      date: tomorrowIso,
      time: "4:30 PM",
      display: `Tomorrow (${tomorrowLabel}) at 4:30 PM UK Time`,
      shortLabel: `Tomorrow (${tomorrowLabel}) at 4:30 PM`,
      urgentOnly: false
    }
  );

  // Day After Tomorrow (+2 days)
  const dayAfterObj = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  const dayAfterIso = formatIsoDate(dayAfterObj);
  const dayAfterLabel = formatReadableDay(dayAfterObj);

  allPossibleSlots.push(
    {
      id: `slot-uk-day2-1`,
      date: dayAfterIso,
      time: "11:30 AM",
      display: `${dayAfterLabel} at 11:30 AM UK Time`,
      shortLabel: `${dayAfterLabel} at 11:30 AM`,
      urgentOnly: false
    },
    {
      id: `slot-uk-day2-2`,
      date: dayAfterIso,
      time: "3:30 PM",
      display: `${dayAfterLabel} at 3:30 PM UK Time`,
      shortLabel: `${dayAfterLabel} at 3:30 PM`,
      urgentOnly: false
    }
  );

  // Day 3 (+3 days)
  const day3Obj = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
  const day3Iso = formatIsoDate(day3Obj);
  const day3Label = formatReadableDay(day3Obj);

  allPossibleSlots.push({
    id: `slot-uk-day3-1`,
    date: day3Iso,
    time: "1:00 PM",
    display: `${day3Label} at 1:00 PM UK Time`,
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
      console.log("ℹ️ Google Calendar running in Strict Past-Time Filtered Europe/London Mode.");
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

      const startStr = `${cleanDate}T${startH}${startM}00`;
      const endStr = `${cleanDate}T${endH}${startM}00`;

      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: summary || 'Aura Dental Studio Appointment',
        dates: `${startStr}/${endStr}`,
        ctz: 'Europe/London',
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

    // 1. Filter out active booked appointments from googleSheetsService
    let available = liveSlots;
    try {
      const googleSheetsService = require('./googleSheetsService');
      const allBookings = await googleSheetsService.getAllAppointments();
      const activeBookings = Array.isArray(allBookings) ? allBookings.filter(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED') : [];

      available = liveSlots.filter(slot => {
        const isBooked = activeBookings.some(b => {
          const dateMatch = b.date === slot.date;
          const bTime = (b.time || '').toLowerCase().replace(/^0/, '').trim();
          const sTime = (slot.time || '').toLowerCase().replace(/^0/, '').trim();
          return dateMatch && bTime === sTime;
        });
        return !isBooked;
      });
    } catch (e) {
      console.warn("Unable to check active bookings filter:", e.message);
    }

    // 2. If Google Calendar API is connected, also filter out busy times from Google Calendar
    if (this.isProduction && this.calendar) {
      try {
        const now = new Date();
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const response = await this.calendar.events.list({
          calendarId: this.calendarId,
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });

        const busyEvents = response.data.items || [];
        const busyTimes = busyEvents.map(e => e.start.dateTime || e.start.date);

        available = available.filter(slot => !busyTimes.some(b => b.includes(slot.date) && b.includes(slot.time)));
      } catch (err) {
        console.error("Failed to sync live Google Calendar events:", err.message);
      }
    }

    return available;
  }

  async bookAppointment({ patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms }) {
    const isEmergency = Boolean(triageLevel && (triageLevel.code === 'EMERGENCY' || triageLevel.isEmergency));
    const bookingId = `LND-DEN-${Math.floor(100000 + Math.random() * 900000)}`;

    const summary = `${isEmergency ? '🚨 URGENT' : '✨'} Dental Appt: ${patientName} (${triageLevel ? triageLevel.title || triageLevel : 'General'})`;
    const description = `Patient: ${patientName}\nPhone: ${patientPhone}\nEmail: ${patientEmail}\nSymptoms: ${symptoms}\nTriage: ${triageLevel ? triageLevel.title || triageLevel : 'General'}\nBooking Ref: ${bookingId}`;

    const gcalUrl = this.generateGoogleCalendarUrl({
      summary,
      date,
      time,
      details: description,
      location: "72 Harley Street, Marylebone, London W1G 7HG"
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
        mode: "europe_london"
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
