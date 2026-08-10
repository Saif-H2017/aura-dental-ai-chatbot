const https = require('https');

class NotificationService {
  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY || null;
    this.isTwilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    
    if (this.isTwilioConfigured) {
      try {
        const twilioLib = require('twilio');
        this.twilioClient = twilioLib(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      } catch (e) {
        this.isTwilioConfigured = false;
      }
    }
  }

  setResendApiKey(key) {
    this.resendApiKey = key;
    process.env.RESEND_API_KEY = key;
  }

  /**
   * Dispatch dual notifications via Resend API: 
   * 1. Email FROM Aura Dental TO Patient (Confirmation)
   * 2. Email FROM AI Receptionist TO Doctor (Alert)
   */
  async sendAppointmentNotifications(bookingDetails) {
    if (!bookingDetails) return { success: false, error: "No booking details provided" };

    const { bookingId, patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms, isEmergency } = bookingDetails;
    const doctorEmail = process.env.SURGEON_EMAIL || "dr.wright@auradental.co.uk";
    const doctorPhone = process.env.SURGEON_PHONE || "+447911123456";
    const clinicName = process.env.CLINIC_NAME || "Aura Dental Studio London";

    const triageTitle = (typeof triageLevel === 'object' && triageLevel !== null)
      ? (triageLevel.title || triageLevel.name || "Routine Consultation")
      : (triageLevel || "Routine Consultation");

    const logs = [];

    // 1. DOCTOR MOBILE SMS ALERT VIA TWILIO
    const doctorSmsMsg = isEmergency
      ? `🚨 URGENT EMERGENCY DENTAL APPOINTMENT!\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSymptoms: ${symptoms}\nTriage: ${triageTitle}\nSlot: ${date} at ${time}\nRef: ${bookingId}`
      : `📅 New Appointment Booked\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSlot: ${date} at ${time}\nType: ${triageTitle}\nRef: ${bookingId}`;

    let doctorSmsResult = await this._sendSms(doctorPhone, doctorSmsMsg);
    logs.push({ recipient: `Doctor SMS (${doctorPhone})`, type: "SMS", status: doctorSmsResult.status, detail: doctorSmsResult.detail });

    // 2. EMAIL 1: TO PATIENT (Confirmation)
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

    const patientRes = await this._sendEmail(patientEmail, patientEmailSubject, patientEmailHtml);
    logs.push({ recipient: `Patient (${patientEmail})`, type: "EMAIL TO PATIENT", status: patientRes.status, detail: patientRes.detail });

    // 3. EMAIL 2: TO DOCTOR (Alert)
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
          <p style="margin: 6px 0;"><strong>🚨 Triage Severity:</strong> ${triageTitle}</p>
          <p style="margin: 6px 0;"><strong>🩺 Symptoms / Notes:</strong> ${symptoms}</p>
          <p style="margin: 6px 0;"><strong>🔖 Booking Ref:</strong> ${bookingId}</p>
        </div>
      </div>
    `;

    const doctorRes = await this._sendEmail(doctorEmail, doctorEmailSubject, doctorEmailHtml);
    logs.push({ recipient: `Doctor (${doctorEmail})`, type: "EMAIL TO DOCTOR", status: doctorRes.status, detail: doctorRes.detail });

    return {
      success: true,
      logs
    };
  }

  // Alias method for backward compatibility
  async sendDualBookingNotifications(bookingDetails) {
    return this.sendAppointmentNotifications(bookingDetails);
  }

  async _sendEmail(to, subject, html) {
    const doctorEmail = process.env.SURGEON_EMAIL || 'saif.247ozx@gmail.com';
    const apiKey = this.resendApiKey || process.env.RESEND_API_KEY;

    // 1. Try Nodemailer SMTP (if configured via env vars)
    const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const smtpPass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: process.env.GMAIL_USER ? 'gmail' : undefined,
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: smtpUser, pass: smtpPass }
        });

        const info = await transporter.sendMail({
          from: `"Aura Dental Studio" <${smtpUser}>`,
          to,
          subject,
          html
        });
        return { status: "SENT_NODEMAILER", detail: `Nodemailer messageId: ${info.messageId}` };
      } catch (err) {
        console.error("Nodemailer SMTP failed, falling back to Resend API:", err.message);
      }
    }

    // 2. Try Resend API
    if (apiKey) {
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'Aura Dental Studio <onboarding@resend.dev>';
      
      const sendResendPromise = (targetRecipient) => {
        return new Promise((resolve) => {
          const postData = JSON.stringify({
            from: fromAddress,
            to: [targetRecipient],
            subject,
            html
          });

          const options = {
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ status: "SENT_RESEND", detail: `Resend API success: ${body}` });
              } else {
                resolve({ status: "FAILED", statusCode: res.statusCode, detail: body });
              }
            });
          });

          req.on('error', (e) => {
            resolve({ status: "FAILED", detail: e.message });
          });

          req.write(postData);
          req.end();
        });
      };

      // Try sending to target patient email
      let result = await sendResendPromise(to);

      // If Resend rejected because of onboarding domain testing restriction (only allowed to send to owner email saif.247ozx@gmail.com), failover send to owner email!
      if (result.status === "FAILED" && (result.statusCode === 403 || result.statusCode === 422 || (result.detail && result.detail.includes("only send to your own email")))) {
        console.warn(`⚠️ Resend onboarding domain restriction: cannot send directly to ${to}. Forwarding confirmation copy to verified doctor email (${doctorEmail}).`);
        const failoverSubject = `[Patient Confirmation for ${to}] ${subject}`;
        const failoverResult = await sendResendPromise(doctorEmail);
        if (failoverResult.status === "SENT_RESEND") {
          return { status: "SENT_RESEND_TEST_FAILOVER", detail: `Confirmation delivered to registered email ${doctorEmail} for patient ${to} (Resend Testing Domain Restriction)` };
        }
      }

      return result;
    }

    // 3. Fallback Demo Mode
    console.log(`ℹ️ [Demo Mode] Email confirmation simulated for ${to}: "${subject}"`);
    return { status: "SIMULATED_SUCCESS", detail: `[Demo Mode] Email logged for ${to}` };
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
      return { status: "FAILED_FAILOVER_LOGGED", detail: err.message };
    }
  }
}

module.exports = new NotificationService();
