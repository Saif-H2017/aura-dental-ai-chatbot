const twilio = require('twilio');

class NotificationService {
  constructor() {
    this.isTwilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    this.isEmailConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (this.isTwilioConfigured) {
      try {
        const twilioLib = require('twilio');
        this.twilioClient = twilioLib(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log("✅ Twilio SMS & WhatsApp Service initialized.");
      } catch (e) {
        console.error("⚠️ Twilio config error:", e.message);
        this.isTwilioConfigured = false;
      }
    }

    if (this.isEmailConfigured) {
      this._initTransporter();
    }
  }

  setEmailConfig(user, pass) {
    process.env.SMTP_USER = user;
    process.env.SMTP_PASS = pass;
    this.isEmailConfigured = true;
    this._initTransporter();
  }

  _initTransporter() {
    try {
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log(`✅ Nodemailer initialized for Doctor Email: ${process.env.SMTP_USER}`);
    } catch (e) {
      console.error("⚠️ Nodemailer init error:", e.message);
      this.isEmailConfigured = false;
    }
  }

  /**
   * Dispatch dual notifications: 
   * 1. Email FROM Doctor TO Patient (Confirmation)
   * 2. Email FROM AI Receptionist TO Doctor (Alert)
   */
  async sendAppointmentNotifications(bookingDetails) {
    const { bookingId, patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms, isEmergency } = bookingDetails;
    const doctorEmail = process.env.SURGEON_EMAIL || process.env.SMTP_USER || "dr.wright@auradental.co.uk";
    const doctorPhone = process.env.SURGEON_PHONE || "+447911123456";
    const clinicName = process.env.CLINIC_NAME || "Aura Dental Studio London";

    const logs = [];

    // 1. DOCTOR MOBILE SMS / WHATSAPP ALERT VIA TWILIO
    const doctorSmsMsg = isEmergency
      ? `🚨 URGENT EMERGENCY DENTAL APPOINTMENT!\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSymptoms: ${symptoms}\nTriage: ${triageLevel.title}\nSlot: ${date} at ${time}\nRef: ${bookingId}`
      : `📅 New Appointment Booked\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSlot: ${date} at ${time}\nType: ${triageLevel.title}\nRef: ${bookingId}`;

    let doctorSmsResult = await this._sendSms(doctorPhone, doctorSmsMsg);
    logs.push({ recipient: `Doctor SMS (${doctorPhone})`, type: "SMS", status: doctorSmsResult.status, detail: doctorSmsResult.detail });

    // 2. EMAIL 1: FROM DOCTOR TO PATIENT (Confirmation)
    const patientEmailSubject = `✨ Appointment Confirmation - ${clinicName} [Ref: ${bookingId}]`;
    const patientEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF7F2; padding: 20px; border-radius: 16px;">
        <div style="background: #0F172A; padding: 25px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">✨ ${clinicName}</h1>
          <p style="margin: 5px 0 0 0; color: #38BDF8; font-size: 14px;">Marylebone • London</p>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 12px; margin-top: 20px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0F172A; margin-top: 0;">Hello ${patientName},</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.5;">
            Your appointment with <strong>Dr. Alexander Wright, BDS</strong> has been successfully booked!
          </p>
          
          <div style="background: #F8FAFC; padding: 15px; border-radius: 8px; border-left: 4px solid #38BDF8; margin: 20px 0;">
            <p style="margin: 5px 0; color: #0F172A;"><strong>📅 Date:</strong> ${date}</p>
            <p style="margin: 5px 0; color: #0F172A;"><strong>⏰ Time:</strong> ${time}</p>
            <p style="margin: 5px 0; color: #0F172A;"><strong>📍 Location:</strong> 72 Harley Street, Marylebone, London W1G 7HG</p>
            <p style="margin: 5px 0; color: #0F172A;"><strong>🔖 Booking Ref:</strong> ${bookingId}</p>
            <p style="margin: 5px 0; color: #0F172A;"><strong>🩺 Treatment/Reason:</strong> ${symptoms}</p>
          </div>

          ${isEmergency ? `
            <div style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #EF4444; padding: 12px; border-radius: 8px; font-weight: bold; margin-bottom: 15px;">
              ⚠️ Priority Emergency Care: Please arrive 10 minutes early. Pain control protocol is prepared.
            </div>
          ` : ''}

          <p style="color: #64748B; font-size: 14px;">
            If you need to reschedule or have any questions before your visit, please call us at <strong>+44 20 7946 0912</strong>.
          </p>

          <p style="color: #0F172A; margin-bottom: 0;">Warm regards,<br><strong>Dr. Alexander Wright & Team</strong><br>Aura Dental Studio</p>
        </div>
      </div>
    `;

    let patientEmailRes = await this._sendEmail(patientEmail, patientEmailSubject, patientEmailHtml);
    logs.push({ recipient: `Patient (${patientEmail})`, type: "EMAIL TO PATIENT", status: patientEmailRes.status, detail: patientEmailRes.detail });

    // 3. EMAIL 2: FROM AI RECEPTIONIST TO DOCTOR (Booking Alert)
    const doctorEmailSubject = `${isEmergency ? '🚨 URGENT BOOKING ALERT' : '📅 NEW APPOINTMENT BOOKED'}: ${patientName} [Ref: ${bookingId}]`;
    const doctorEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; padding: 20px; border-radius: 16px; color: white;">
        <h2 style="color: ${isEmergency ? '#EF4444' : '#38BDF8'}; margin-top: 0;">
          ${isEmergency ? '🚨 URGENT EMERGENCY DENTAL APPOINTMENT' : '📅 NEW PATIENT BOOKING'}
        </h2>
        <p style="color: #cbd5e1; font-size: 15px;">A patient has just booked an appointment via the 24/7 AI Receptionist.</p>
        
        <div style="background: #1E293B; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
          <p style="margin: 6px 0;"><strong>👤 Patient Name:</strong> ${patientName}</p>
          <p style="margin: 6px 0;"><strong>📞 Phone:</strong> <a href="tel:${patientPhone}" style="color: #38BDF8;">${patientPhone}</a></p>
          <p style="margin: 6px 0;"><strong>✉️ Email:</strong> ${patientEmail}</p>
          <p style="margin: 6px 0;"><strong>🗓️ Requested Slot:</strong> ${date} at ${time}</p>
          <p style="margin: 6px 0;"><strong>🚨 Triage Severity:</strong> ${triageLevel.title}</p>
          <p style="margin: 6px 0;"><strong>🩺 Symptoms / Notes:</strong> ${symptoms}</p>
          <p style="margin: 6px 0;"><strong>🔖 Booking Ref:</strong> ${bookingId}</p>
        </div>

        <p style="color: #94a3b8; font-size: 13px; margin-top: 15px;">
          This record has been synchronized with your Google Calendar and Google Sheets database.
        </p>
      </div>
    `;

    let doctorEmailRes = await this._sendEmail(doctorEmail, doctorEmailSubject, doctorEmailHtml);
    logs.push({ recipient: `Doctor (${doctorEmail})`, type: "EMAIL TO DOCTOR", status: doctorEmailRes.status, detail: doctorEmailRes.detail });

    return {
      success: true,
      logs
    };
  }

  async _sendSms(to, body) {
    if (!this.isTwilioConfigured) {
      return { status: "SIMULATED_SUCCESS", detail: `[Demo Mode] Alert logged for ${to}` };
    }

    try {
      const message = await this.twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      return { status: "DELIVERED", detail: `Twilio SID: ${message.sid}` };
    } catch (err) {
      console.error(`Twilio SMS error to ${to}:`, err.message);
      return { status: "FAILED_FAILOVER_LOGGED", detail: err.message };
    }
  }

  async _sendEmail(to, subject, html) {
    if (!this.isEmailConfigured) {
      return { status: "SIMULATED_SUCCESS", detail: `[Demo Mode] Email queued for ${to}` };
    }

    try {
      await this.transporter.sendMail({
        from: `"${process.env.CLINIC_NAME || 'Aura Dental Studio'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html
      });
      return { status: "SENT", detail: `Nodemailer SMTP success to ${to}` };
    } catch (err) {
      console.error(`Email delivery error to ${to}:`, err.message);
      return { status: "FAILED", detail: err.message };
    }
  }
}

module.exports = new NotificationService();
