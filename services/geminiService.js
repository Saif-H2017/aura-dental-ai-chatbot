const { GoogleGenerativeAI } = require('@google/generative-ai');
const { evaluateTriage } = require('./triageRules');

const SYSTEM_PROMPT = `
You are Harley, an empathetic and professional AI Intake Concierge for Aura Dental Studio in Marylebone, London (Dr. Alexander Wright, Lead Surgeon).

YOUR CORE RESPONSIBILITIES:
1. Greet patients warmly and answer questions about the clinic (Location: 72 Harley Street, London W1G 7HG; Hours: Mon-Sat 8:30 AM - 6:00 PM; Consultation fee: £95).
2. TRIAGE PATIENTS SAFETY:
   - Ask about pain scale (0-10), swelling, or bleeding.
   - If severe pain (7+/10), swelling, or trauma, treat as SAME-DAY URGENT.
   - If critical red flags (breathing trouble, eye swelling), urge calling 999 or going to A&E immediately.
3. APPOINTMENT BOOKING:
   - Collect name, phone, email, preferred date/time.
4. MEDICAL SAFETY GUARDRAIL:
   - NEVER diagnose or prescribe. Only intake & schedule.

Keep responses concise, friendly, and varied. Avoid repetitive static phrases.
`;

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.hasKey = Boolean(this.apiKey && this.apiKey !== 'your_gemini_api_key_here');

    if (this.hasKey) {
      this._initGeminiModel();
    } else {
      console.log("ℹ️ Gemini AI running in Smart Dynamic Simulation Engine.");
    }
  }

  setApiKey(key) {
    this.apiKey = key;
    this.hasKey = true;
    this._initGeminiModel();
  }

  _initGeminiModel() {
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // Use gemini-1.5-flash-latest or gemini-2.0-flash
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        systemInstruction: SYSTEM_PROMPT
      });
      console.log("✅ Gemini AI Engine initialized successfully with live key.");
    } catch (err) {
      console.error("⚠️ Failed to init Gemini AI:", err.message);
      this.hasKey = false;
    }
  }

  async processMessage(chatHistory, userMessage, currentBookingDraft = {}) {
    const triage = evaluateTriage(userMessage, currentBookingDraft.painScore);

    if (triage.code === "CRITICAL_EMERGENCY") {
      return {
        reply: `🚨 **CRITICAL SAFETY NOTICE**: Based on the symptoms described (${triage.matchedTrigger}), this may be a severe medical emergency. Please call **999** or go directly to your nearest NHS A&E hospital immediately.\n\nDr. Wright's clinic cannot safely delay acute airway or systemic emergencies. Stay safe!`,
        triage,
        bookingComplete: false,
        requiresEmergencyRouting: true
      };
    }

    if (!this.hasKey) {
      return this._simulateResponse(chatHistory, userMessage, triage, currentBookingDraft);
    }

    try {
      const contextTurns = (chatHistory || []).slice(-6).map(h => `${h.role === 'user' ? 'Patient' : 'Harley'}: ${h.content}`).join('\n');
      const prompt = `Previous Context:\n${contextTurns}\n\nCurrent Triage: ${triage.title}\nPatient message: "${userMessage}"`;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const reply = response.text();

      return {
        reply,
        triage,
        bookingComplete: false
      };
    } catch (err) {
      console.error("Gemini API Error:", err.message);
      return this._simulateResponse(chatHistory, userMessage, triage, currentBookingDraft);
    }
  }

  _simulateResponse(chatHistory, userMessage, triage, draft) {
    const msg = userMessage.toLowerCase().trim();
    const turnsCount = (chatHistory || []).length;

    if (triage.code === "SAME_DAY_URGENT" || msg.includes("pain") || msg.includes("emergency") || msg.includes("broken") || msg.includes("bleeding") || msg.includes("swelling") || msg.includes("ache") || msg.includes("hurt")) {
      return {
        reply: `I completely understand you're dealing with discomfort (${triage.title}). Dr. Alexander Wright prioritizes urgent dental pain.\n\nI have flagged your request for a **Same-Day Emergency Slot**. \n\nPlease select a time or fill out your contact details so we can alert Dr. Wright's mobile right away.`,
        triage,
        isUrgentPrompted: true
      };
    }

    if (msg === "hi" || msg === "hello" || msg === "hey" || msg.startsWith("good morning") || msg.startsWith("good afternoon")) {
      if (turnsCount > 2) {
        return {
          reply: `Hello again! How else can I assist your visit to Aura Dental Studio today?`,
          triage
        };
      }
      return {
        reply: `Hello! Welcome to Aura Dental Studio in Marylebone, London. I'm Harley, Dr. Wright's AI intake concierge.\n\nHow can I help you today? Are you looking to book a consultation, check clinic location, or seeking advice for a dental issue?`,
        triage
      };
    }

    if (msg.includes("where") || msg.includes("address") || msg.includes("location") || msg.includes("hours") || msg.includes("open") || msg.includes("find")) {
      return {
        reply: `📍 **Aura Dental Studio** is located at **72 Harley Street, Marylebone, London W1G 7HG** (near Regent's Park and Oxford Circus tube stations).\n\n⏰ **Clinic Opening Hours**:\n- Monday to Friday: 08:30 AM – 06:00 PM\n- Saturday: 09:00 AM – 04:00 PM (Emergency slots only)\n- Sunday: Closed (Emergency triage line active)\n\nWould you like to book a visit with Dr. Wright?`,
        triage
      };
    }

    if (msg.includes("cost") || msg.includes("price") || msg.includes("fee") || msg.includes("how much") || msg.includes("pay")) {
      return {
        reply: `💳 **Aura Dental Fee Guide**:\n- Comprehensive Dental Consultation: £95\n- Emergency Triage & Pain Control Assessment: £120 (includes intra-oral X-rays)\n- Hygiene & Airflow Cleaning: £85\n\nWould you like me to reserve a consultation slot for you?`,
        triage
      };
    }

    if (msg.includes("doctor") || msg.includes("dentist") || msg.includes("wright") || msg.includes("who")) {
      return {
        reply: `👨‍⚕️ **Dr. Alexander Wright, BDS** is our Principal Dental Surgeon. He brings over 15 years of experience in restorative, cosmetic, and emergency dentistry in Central London.\n\nWould you like to check Dr. Wright's upcoming schedule?`,
        triage
      };
    }

    if (msg.includes("book") || msg.includes("appointment") || msg.includes("slot") || msg.includes("schedule") || msg.includes("cleaning") || msg.includes("checkup") || msg.includes("whitening") || msg.includes("tomorrow") || msg.includes("monday")) {
      return {
        reply: `I'd be happy to schedule your appointment with Dr. Wright at Aura Dental!\n\nHere are our next available calendar slots:\n1. **Today at 03:30 PM**\n2. **Tomorrow at 10:00 AM**\n3. **Tomorrow at 02:15 PM**\n\nWhich slot suits you best?`,
        triage,
        suggestSlots: true
      };
    }

    const fallbackVariations = [
      `Thank you for asking about "${userMessage}". At Aura Dental Studio, we specialize in gentle, pain-free dental care. Would you like me to schedule a consultation with Dr. Wright or check our available appointment slots?`,
      `Regarding "${userMessage}", our Marylebone team is here to help! I can check Dr. Wright's schedule or answer any questions about our treatments.`,
      `Thanks for reaching out! Whether you need a routine checkup, teeth whitening, or emergency care, I can help get you booked in. What time works best for your visit?`
    ];

    return {
      reply: fallbackVariations[turnsCount % fallbackVariations.length],
      triage
    };
  }
}

module.exports = new GeminiService();
