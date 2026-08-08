# ✨ Aura Dental Studio London - AI Concierge & Intake Platform 🦷

A modern, high-converting dental studio web application with a 24/7 AI Receptionist, UK NHS clinical triage, Google Calendar slot booking, Google Sheets database, and dual Doctor/Patient email alerts.

---

## 🌐 Live Website Links

* **Patient Website & AI Concierge**: [https://aura-dental-studio-app.vercel.app](https://aura-dental-studio-app.vercel.app)
* **Surgeon Admin & Triage Portal**: [https://aura-dental-studio-app.vercel.app/admin](https://aura-dental-studio-app.vercel.app/admin)

*(Note: Replace `aura-dental-studio-app.vercel.app` with your exact Vercel deployment URL)*

---

## 🌟 Key Features

1. **Clinical Calm Aesthetic**: Designed with warm off-white, navy, cyan, and sage green palette, modern typography, rounded cards (`border-radius: 16px`), and generous whitespace.
2. **24/7 Floating AI Receptionist Drawer**:
   - Floating pill button with subtle pulse animation.
   - Realistic 3-dots typing animation (`• • •`) with a 4-second pace delay.
   - Speech-to-Text dictation mic button (🎤).
   - Powered by Gemini 1.5 Flash AI with strict medical guardrails.
3. **UK NHS Dental Emergency Triage**:
   - Automatically evaluates symptoms and pain scale (0-10).
   - Escalates severe pain (7+/10) to Same-Day Urgent slots and red-flag cases to A&E/999.
4. **Interactive Before/After Transformation Slider**:
   - Draggable handle for patients to compare teeth whitening results live.
5. **Dual Email Dispatch System**:
   - Sends confirmation email FROM Doctor Email TO Patient Email.
   - Sends instant booking alert email TO Doctor Email.
6. **Surgeon Admin Dashboard (`/admin`)**:
   - 1-Click Gemini API Key connector.
   - 1-Click Doctor Email SMTP connector.
   - 1-Click CSV export for Google Sheets database.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, `@google/generative-ai` SDK, `googleapis`, `nodemailer`, `twilio`
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Properties & Glassmorphism), Modern Vanilla JavaScript (ES6+)
- **Hosting**: Vercel Serverless Functions (`api/index.js`)
