class NotificationService {
  constructor() {
    this.isTwilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    this.isEmailConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (this.isTwilioConfigured) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log("✅ Twilio SMS & WhatsApp Service initialized.");
      } catch (e) {
        console.error("⚠️ Twilio config error:", e.message);
        this.isTwilioConfigured = false;
      }
    }

    if (this.isEmailConfigured) {
      try {
        const nodemailer = require('nodemailer');
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        console.log("✅ Nodemailer Email Service initialized.");
      } catch (e) {
        console.error("⚠️ Nodemailer config error:", e.message);
        this.isEmailConfigured = false;
      }
    }
  }

  async sendAppointmentNotifications(bookingDetails) {
    const { bookingId, patientName, patientPhone, patientEmail, date, time, triageLevel, symptoms, isEmergency } = bookingDetails;
    const doctorPhone = process.env.SURGEON_PHONE || "+447911123456";
    const clinicName = process.env.CLINIC_NAME || "Harley Street Dental Care London";

    const logs = [];

    // 1. DOCTOR SMS / WHATSAPP ALERT
    const doctorMsg = isEmergency
      ? `🚨 URGENT EMERGENCY DENTAL APPOINTMENT!\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSymptoms: ${symptoms}\nTriage: ${triageLevel.title}\nSlot: ${date} at ${time}\nRef: ${bookingId}`
      : `📅 New Appointment Booked\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nSlot: ${date} at ${time}\nType: ${triageLevel.title}\nRef: ${bookingId}`;

    let doctorSmsResult = await this._sendSms(doctorPhone, doctorMsg);
    logs.push({ recipient: `Doctor (${doctorPhone})`, type: "SMS", status: doctorSmsResult.status, detail: doctorSmsResult.detail });

    // 2. PATIENT WHATSAPP / SMS CONFIRMATION
    const patientMsg = `Hello ${patientName},\nYour appointment with ${process.env.SURGEON_NAME || 'Dr. Alexander Wright'} at ${clinicName} is CONFIRMED.\n\n📅 Date: ${date}\n⏰ Time: ${time}\n📍 Venue: 72 Harley Street, London W1G 7HG\nRef ID: ${bookingId}\n\n${isEmergency ? '⚠️ Note: Please arrive 10 minutes early for urgent intake.' : 'Please bring a photo ID and list of current medications.'}`;

    let patientSmsResult = await this._sendSms(patientPhone, patientMsg);
    logs.push({ recipient: `Patient (${patientPhone})`, type: "SMS/WhatsApp", status: patientSmsResult.status, detail: patientSmsResult.detail });

    // 3. PATIENT EMAIL CONFIRMATION
    let emailResult = await this._sendEmail(patientEmail, `Appointment Confirmation - ${clinicName} [Ref: ${bookingId}]`, patientMsg);
    logs.push({ recipient: `Patient (${patientEmail})`, type: "EMAIL", status: emailResult.status, detail: emailResult.detail });

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

  async _sendEmail(to, subject, text) {
    if (!this.isEmailConfigured) {
      return { status: "SIMULATED_SUCCESS", detail: `[Demo Mode] Confirmation email queued for ${to}` };
    }

    try {
      await this.transporter.sendMail({
        from: `"${process.env.CLINIC_NAME}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text
      });
      return { status: "SENT", detail: "Nodemailer SMTP success" };
    } catch (err) {
      console.error(`Email error to ${to}:`, err.message);
      return { status: "FAILED", detail: err.message };
    }
  }
}

module.exports = new NotificationService();
