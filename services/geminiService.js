const { GoogleGenerativeAI } = require('@google/generative-ai');
const { evaluateTriage } = require('./triageRules');

const SYSTEM_PROMPT = `
You are Harley, an exceptionally empathetic, intelligent, and refined AI Intake Concierge for Aura Dental Studio in Marylebone, London (Lead Surgeon: Dr. Alexander Wright, BDS).

CLINIC KNOWLEDGE & POLICIES:
- Location: 72 Harley Street, Marylebone, London W1G 7HG (Near Regent's Park & Bond Street stations).
- Opening Hours: Monday-Friday 8:30 AM - 6:00 PM | Saturday 9:00 AM - 4:00 PM (Emergency slots only) | Sunday Closed.
- Private Insurance: YES! We accept all major UK providers (Bupa, AXA Health, Simplyhealth, Aviva, WPA, Cigna, Allianz). We issue itemized receipts & claim forms for direct reimbursement.
- Nervous Patients: We specialize in dental anxiety! Painless micro-needles, soothing warm towels, noise-canceling headphones, ceiling TVs, and conscious sedation available.
- Fees & Pricing: Consultation & Examination (£95), Airflow Clean (£85), Emergency Triage (£120), Laser Whitening (£350), Invisalign (£1500+).

YOUR CORE RESPONSIBILITIES:
1. Answer patient questions with intelligence, precision, and warmth.
2. TRIAGE PATIENT SAFETY:
   - Ask about pain scale (0-10), swelling, or bleeding.
   - If severe pain (7+/10), swelling, or trauma, treat as SAME-DAY URGENT.
   - If critical red flags (breathing trouble, eye swelling), urge calling 999 or going to A&E immediately.
3. Keep responses helpful, natural, and friendly. Never force booking modals on general questions.
`;

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.hasKey = Boolean(this.apiKey && this.apiKey !== 'your_gemini_api_key_here');

    if (this.hasKey) {
      this._initGeminiModel();
    } else {
      console.log("ℹ️ Gemini AI running in Smart Knowledge Engine.");
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

    // 1. PRIVATE INSURANCE QUERY
    if (msg.includes("insurance") || msg.includes("bupa") || msg.includes("axa") || msg.includes("simplyhealth") || msg.includes("aviva") || msg.includes("claim") || msg.includes("policy")) {
      return {
        reply: `💳 **Yes, we accept Private Health Insurance!**\n\nAura Dental Studio accepts all major UK private dental insurance providers, including:\n• **Bupa**\n• **AXA Health**\n• **Simplyhealth**\n• **Aviva**\n• **WPA & Cigna**\n\nWe provide itemized billing receipts and BDA clinical treatment codes so you can claim your reimbursement directly with zero hassle.`,
        triage
      };
    }

    // 2. NERVOUS / DENTAL ANXIETY QUERY
    if (msg.includes("nervous") || msg.includes("anxious") || msg.includes("scared") || msg.includes("fear") || msg.includes("phobia") || msg.includes("painful") || msg.includes("hurt")) {
      return {
        reply: `🧘 **We specialize in gentle care for nervous patients!**\n\nOver 40% of our patients felt anxious before visiting us. At Aura Dental Studio, we create a soothing, calm environment featuring:\n• Painless micro-needles & topical numbing gels\n• Noise-canceling headphones & warm aromatherapy towels\n• Ceiling TV screens during treatment\n• Gentle, patient-controlled pacing (you can stop us anytime!)\n\nDr. Wright and our team take all the time you need.`,
        triage
      };
    }

    // 3. LOCATION & PARKING
    if (msg.includes("where") || msg.includes("address") || msg.includes("location") || msg.includes("find") || msg.includes("parking") || msg.includes("tube") || msg.includes("station")) {
      return {
        reply: `📍 **Clinic Location & Access**:\nWe are situated at **72 Harley Street, Marylebone, London W1G 7HG**.\n\n🚆 **Nearest Tube Stations**:\n• Regent's Park (Bakerloo Line - 5 min walk)\n• Bond Street (Central, Jubilee, Elizabeth Line - 7 min walk)\n\n🚗 **Parking**: Pay-and-display parking is available directly on Harley Street, or at Q-Park Cavendish Square.`,
        triage
      };
    }

    // 4. OPENING HOURS
    if (msg.includes("hours") || msg.includes("open") || msg.includes("time") || msg.includes("weekend") || msg.includes("sunday")) {
      return {
        reply: `⏰ **Aura Dental Opening Hours**:\n• **Monday – Friday**: 08:30 AM – 06:00 PM\n• **Saturday**: 09:00 AM – 04:00 PM (Emergency slots only)\n• **Sunday**: Closed (24/7 AI Triage Active)\n\nSame-day emergency appointments are reserved daily for urgent toothache relief.`,
        triage
      };
    }

    // 5. FEES & PRICING
    if (msg.includes("cost") || msg.includes("price") || msg.includes("fee") || msg.includes("how much") || msg.includes("rate") || msg.includes("expensive")) {
      return {
        reply: `💰 **Aura Dental Transparent Fee Guide**:\n• **New Patient Examination & Digital X-rays**: £95\n• **Airflow Hygiene Cleaning**: £85\n• **Emergency Pain Assessment**: £120\n• **6-Shade Laser Teeth Whitening**: £350\n• **Invisalign Consultation**: Complimentary 3D Scan\n\nAll treatment plans are provided with itemized costs before any procedure begins!`,
        triage
      };
    }

    // 6. URGENT DENTAL PAIN / EMERGENCY
    if (triage.code === "SAME_DAY_URGENT" || msg.includes("severe pain") || msg.includes("emergency") || msg.includes("broken tooth") || msg.includes("bleeding") || msg.includes("swelling")) {
      return {
        reply: `🚨 **SAME-DAY URGENT CARE FLAGGED**\n\nI understand you are experiencing discomfort (${triage.title}). Dr. Alexander Wright reserves dedicated emergency slots every day for urgent pain relief.\n\nWould you like me to book you into our next available emergency slot today at 3:30 PM?`,
        triage,
        isUrgentPrompted: true
      };
    }

    // 7. GREETING
    if (msg === "hi" || msg === "hello" || msg === "hey" || msg.startsWith("good morning") || msg.startsWith("good afternoon")) {
      return {
        reply: `Hello! Welcome to Aura Dental Studio in Marylebone, London. I'm Harley, Dr. Wright's AI Concierge.\n\nHow can I help you today? Feel free to ask about our treatments, insurance coverage, clinic location, or booking a consultation.`,
        triage
      };
    }

    // 8. EXPLICIT BOOKING INTENT
    if (msg.includes("book") || msg.includes("reserve") || msg.includes("schedule an appointment") || msg.includes("want a slot")) {
      return {
        reply: `I would be delighted to schedule your visit with Dr. Wright at Aura Dental Studio!\n\nOur next available slots are:\n1. **Today at 3:30 PM** (Urgent / Standard)\n2. **Tomorrow at 10:00 AM**\n3. **Tomorrow at 2:15 PM**\n\nWhich slot works best for you?`,
        triage,
        suggestSlots: true
      };
    }

    // 9. GENERAL FALLBACK
    return {
      reply: `Thank you for reaching out to Aura Dental Studio! Regarding "${userMessage}", Dr. Wright and our Marylebone team are here to deliver gentle, state-of-the-art care.\n\nCan I assist you with details on our treatments, private insurance, or help you book an appointment?`,
      triage
    };
  }
}

module.exports = new GeminiService();
