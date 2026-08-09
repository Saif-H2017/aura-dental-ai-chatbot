const { GoogleGenerativeAI } = require('@google/generative-ai');
const { evaluateTriage } = require('./triageRules');
const { getLiveRealWorldSlots } = require('./googleCalendarService');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.hasKey = Boolean(this.apiKey && this.apiKey !== 'your_gemini_api_key_here');

    if (this.hasKey) {
      this._initGeminiModel();
    } else {
      console.log("ℹ️ Gemini AI running in High-Performance Triage & Human Fallback Engine.");
    }
  }

  setApiKey(key) {
    this.apiKey = key;
    this.hasKey = true;
    this._initGeminiModel();
  }

  _getSystemPrompt() {
    const slots = getLiveRealWorldSlots();
    const slotListText = slots.map((s, idx) => `- Option ${idx + 1}: ${s.display}`).join('\n');

    return `
You are Harley, an exceptionally empathetic, intelligent, natural, and refined AI Intake Concierge for Aura Dental Studio in Marylebone, London (Lead Surgeon: Dr. Alexander Wright, BDS).

CLINIC KNOWLEDGE & POLICIES:
- Location: 72 Harley Street, Marylebone, London W1G 7HG (Near Regent's Park & Bond Street stations).
- Opening Hours: Monday-Friday 8:30 AM - 6:00 PM | Saturday 9:00 AM - 4:00 PM (Emergency slots only) | Sunday Closed.
- Private Insurance: YES! We accept all major UK providers (Bupa, AXA Health, Simplyhealth, Aviva, WPA, Cigna, Allianz). We issue itemized receipts & claim forms for direct reimbursement.
- Nervous Patients: We specialize in dental anxiety! Painless micro-needles, soothing warm towels, noise-canceling headphones, ceiling TVs, and conscious sedation available.
- Fees & Pricing: Consultation & Examination (£95), Airflow Clean (£85), Emergency Triage (£120), Laser Whitening (£350), Invisalign (£1500+).

LIVE REAL-WORLD SLOTS:
${slotListText}

EMERGENCY TRIAGE RULE (CRITICAL):
If the patient mentions tooth pain, broken tooth, bleeding, or swelling:
1. Express immediate empathy.
2. Ask 2 quick triage questions:
   - "Is there any facial swelling or active bleeding?"
   - "On a scale of 1-10, how severe is your pain?"
3. Offer the option to request an instant human reception callback.

HUMAN CALLBACK RULE:
If the user asks for a human, callback, or phone call, prompt them to provide their Full Name and Phone Number so reception can call them back within 15 minutes.
`;
  }

  _initGeminiModel() {
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        systemInstruction: this._getSystemPrompt()
      });
      console.log("✅ Gemini AI Engine initialized with Live System Prompt.");
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
    const liveSlots = getLiveRealWorldSlots();

    // 1. HUMAN CALLBACK / SPEAK TO RECEPTIONIST ("speak to human", "callback", "call me", "reception", "speak to someone")
    if (
      msg.includes("human") ||
      msg.includes("callback") ||
      msg.includes("call me") ||
      msg.includes("speak to someone") ||
      msg.includes("reception") ||
      msg.includes("person") ||
      msg.includes("phone call")
    ) {
      return {
        reply: `📞 **Request Instant Reception Callback**\n\nI would be delighted to have Dr. Wright's head receptionist call you directly!\n\nPlease click **Book Online** (or reply with your **Full Name** and **Mobile Number**), and our team will call you back within **15 minutes**!`,
        triage,
        isCallbackPrompted: true
      };
    }

    // 2. PAIN / EMERGENCY TRIAGE MODE ("tooth pain", "toothache", "broken", "bleeding", "swollen", "hurt")
    if (
      msg.includes("pain") ||
      msg.includes("ache") ||
      msg.includes("broken") ||
      msg.includes("bleeding") ||
      msg.includes("swollen") ||
      msg.includes("hurt") ||
      msg.includes("emergency")
    ) {
      const urgentSlot = liveSlots[0];
      return {
        reply: `🚨 **EMERGENCY DENTAL TRIAGE INTAKE**\n\nI am so sorry to hear you are in discomfort! Let's check your symptoms immediately:\n\n1. **Is there any active facial swelling or uncontrollable bleeding?** (Yes / No)\n2. **On a scale of 1-10, how severe is your pain?**\n\nWe have a dedicated Emergency Slot reserved for **${urgentSlot.display}**. Or click **📞 Request Callback** to speak with our receptionist instantly!`,
        triage,
        isUrgentPrompted: true
      };
    }

    // 3. AFFIRMATIVE RESPONSES ("yes", "yeah", "sure", "okay", "yep", "ok", "please")
    if (
      msg === "yes" ||
      msg === "yeah" ||
      msg === "sure" ||
      msg === "okay" ||
      msg === "ok" ||
      msg === "yep" ||
      msg === "please" ||
      msg === "alright" ||
      msg.startsWith("yes ") ||
      msg.startsWith("sure ")
    ) {
      const formattedSlots = liveSlots.map((s, idx) => `• **Option ${idx + 1}**: ${s.display}`).join('\n');
      return {
        reply: `Wonderful! Here are our next available slots with Dr. Alexander Wright:\n\n${formattedSlots}\n\nWhich option (1, 2, 3, 4, or 5) works best for you?`,
        triage,
        suggestSlots: true
      };
    }

    // 4. GRATITUDE / COURTESY ("thanks", "thank you", "cheers", "awesome", "great", "perfect", "cool")
    if (
      msg.includes("thank") ||
      msg === "thanks" ||
      msg === "cheers" ||
      msg === "awesome" ||
      msg === "great" ||
      msg === "perfect" ||
      msg === "cool"
    ) {
      return {
        reply: `You're very welcome! We look forward to welcoming you to Aura Dental Studio in Marylebone. Have a wonderful day! ✨`,
        triage
      };
    }

    // 5. NEGATION ("no", "nope", "not now", "no thanks", "cancel", "nevermind")
    if (
      msg === "no" ||
      msg === "nope" ||
      msg.includes("not right now") ||
      msg.includes("no thanks") ||
      msg === "cancel" ||
      msg === "nevermind"
    ) {
      return {
        reply: `No problem at all! Feel free to reach out whenever you're ready to schedule your visit. Have a great day!`,
        triage
      };
    }

    // 6. SLOT SELECTION HANDLER (Option 1, Option 2, Option 3, Option 4, Option 5)
    if (msg === "option 1" || msg === "1" || msg.includes("7:30")) {
      const s = liveSlots[0];
      return {
        reply: `🎉 **Slot Selected: ${s.display}**\n\nExcellent choice! I have reserved **${s.display}** for your consultation with Dr. Alexander Wright.\n\nPlease click the **Book Online** button (or provide your **Full Name**, **Phone Number**, and **Email Address**) so we can dispatch your instant confirmation email!`,
        triage,
        selectedSlot: s.display,
        slotDate: s.date,
        slotTime: s.time,
        promptForDetails: true
      };
    }

    if (msg === "option 2" || msg === "2" || msg.includes("10:00") || msg.includes("10am")) {
      const s = liveSlots[1];
      return {
        reply: `🎉 **Slot Selected: ${s.display}**\n\nGreat choice! I have reserved **${s.display}** for your visit to Aura Dental Studio.\n\nPlease click the **Book Online** button (or provide your **Full Name**, **Phone Number**, and **Email Address**) to confirm your reservation!`,
        triage,
        selectedSlot: s.display,
        slotDate: s.date,
        slotTime: s.time,
        promptForDetails: true
      };
    }

    if (msg === "option 3" || msg === "3" || msg.includes("2:15") || msg.includes("2:15pm") || msg.includes("2:15 pm")) {
      const s = liveSlots[2];
      return {
        reply: `🎉 **Slot Selected: ${s.display}**\n\nPerfect! I have reserved **${s.display}** for your appointment with Dr. Alexander Wright.\n\nPlease click the **Book Online** button (or reply with your **Full Name**, **Phone Number**, and **Email Address**) so we can finalize your booking and send your email confirmation!`,
        triage,
        selectedSlot: s.display,
        slotDate: s.date,
        slotTime: s.time,
        promptForDetails: true
      };
    }

    if (msg === "option 4" || msg === "4" || msg.includes("11:30") || msg.includes("11:30am")) {
      const s = liveSlots[3];
      return {
        reply: `🎉 **Slot Selected: ${s.display}**\n\nWonderful! I have held **${s.display}** for your appointment.\n\nPlease click **Book Online** (or reply with your **Full Name**, **Phone**, and **Email**) so we can send your instant confirmation!`,
        triage,
        selectedSlot: s.display,
        slotDate: s.date,
        slotTime: s.time,
        promptForDetails: true
      };
    }

    if (msg === "option 5" || msg === "5" || msg.includes("3:30") || msg.includes("3:30pm")) {
      const s = liveSlots[4];
      return {
        reply: `🎉 **Slot Selected: ${s.display}**\n\nExcellent! I have held **${s.display}** for your appointment.\n\nPlease click **Book Online** (or reply with your **Full Name**, **Phone**, and **Email**) to finalize!`,
        triage,
        selectedSlot: s.display,
        slotDate: s.date,
        slotTime: s.time,
        promptForDetails: true
      };
    }

    // 7. DIRECT BOOKING INTENT HANDLER
    if (
      msg.includes("appointment") ||
      msg.includes("book") ||
      msg.includes("schedule") ||
      msg.includes("slot") ||
      msg.includes("visit") ||
      msg.includes("see doctor") ||
      msg.includes("checkup") ||
      msg.includes("cleaning") ||
      msg.includes("consultation") ||
      msg.includes("reserve") ||
      msg.includes("see dentist")
    ) {
      const formattedSlots = liveSlots.map((s, idx) => `• **Option ${idx + 1}**: ${s.display}`).join('\n');
      return {
        reply: `📅 **Live Real-World Available Slots at Aura Dental Studio (PKT)**:\n\n${formattedSlots}\n\nWhich option (1, 2, 3, 4, or 5) works best for you?`,
        triage,
        suggestSlots: true
      };
    }

    // 8. PRIVATE INSURANCE QUERY
    if (msg.includes("insurance") || msg.includes("bupa") || msg.includes("axa") || msg.includes("simplyhealth") || msg.includes("aviva") || msg.includes("claim") || msg.includes("policy")) {
      return {
        reply: `💳 **Yes, we accept Private Health Insurance!**\n\nAura Dental Studio accepts all major UK private dental insurance providers, including:\n• **Bupa**\n• **AXA Health**\n• **Simplyhealth**\n• **Aviva**\n• **WPA & Cigna**\n\nWe provide itemized billing receipts and BDA clinical treatment codes so you can claim your reimbursement directly with zero hassle.`,
        triage
      };
    }

    // 9. NERVOUS / DENTAL ANXIETY QUERY
    if (msg.includes("nervous") || msg.includes("anxious") || msg.includes("scared") || msg.includes("fear") || msg.includes("phobia") || msg.includes("painful")) {
      return {
        reply: `🧘 **We specialize in gentle care for nervous patients!**\n\nOver 40% of our patients felt anxious before visiting us. At Aura Dental Studio, we create a soothing, calm environment featuring:\n• Painless micro-needles & topical numbing gels\n• Noise-canceling headphones & warm aromatherapy towels\n• Ceiling TV screens during treatment\n• Gentle, patient-controlled pacing (you can stop us anytime!)\n\nDr. Wright and our team take all the time you need.`,
        triage
      };
    }

    // 10. LOCATION & PARKING
    if (msg.includes("where") || msg.includes("address") || msg.includes("location") || msg.includes("find") || msg.includes("parking") || msg.includes("tube") || msg.includes("station")) {
      return {
        reply: `📍 **Clinic Location & Access**:\nWe are situated at **72 Harley Street, Marylebone, London W1G 7HG**.\n\n🚆 **Nearest Tube Stations**:\n• Regent's Park (Bakerloo Line - 5 min walk)\n• Bond Street (Central, Jubilee, Elizabeth Line - 7 min walk)\n\n🚗 **Parking**: Pay-and-display parking is available directly on Harley Street, or at Q-Park Cavendish Square.`,
        triage
      };
    }

    // 11. OPENING HOURS
    if (msg.includes("hours") || msg.includes("open") || msg.includes("time") || msg.includes("weekend") || msg.includes("sunday")) {
      return {
        reply: `⏰ **Aura Dental Opening Hours**:\n• **Monday – Friday**: 08:30 AM – 06:00 PM\n• **Saturday**: 09:00 AM – 04:00 PM (Emergency slots only)\n• **Sunday**: Closed (24/7 AI Triage Active)\n\nSame-day emergency appointments are reserved daily for urgent toothache relief.`,
        triage
      };
    }

    // 12. FEES & PRICING
    if (msg.includes("cost") || msg.includes("price") || msg.includes("fee") || msg.includes("how much") || msg.includes("rate") || msg.includes("expensive")) {
      return {
        reply: `💰 **Aura Dental Transparent Fee Guide**:\n• **New Patient Examination & Digital X-rays**: £95\n• **Airflow Hygiene Cleaning**: £85\n• **Emergency Pain Assessment**: £120\n• **6-Shade Laser Teeth Whitening**: £350\n• **Invisalign Consultation**: Complimentary 3D Scan\n\nAll treatment plans are provided with itemized costs before any procedure begins!`,
        triage
      };
    }

    // 13. GREETING
    if (msg === "hi" || msg === "hello" || msg === "hey" || msg.startsWith("good morning") || msg.startsWith("good afternoon")) {
      return {
        reply: `Hello! Welcome to Aura Dental Studio in Marylebone, London. I'm Harley, Dr. Wright's AI Concierge.\n\nHow can I help you today? Feel free to ask about our treatments, insurance coverage, clinic location, or booking a consultation.`,
        triage
      };
    }

    // 14. POLISHED HUMAN-LIKE RECEPTIONIST DEFAULT FALLBACK
    return {
      reply: `I would be happy to assist you! At Aura Dental Studio in Marylebone, Dr. Alexander Wright and our team are here to deliver gentle, state-of-the-art dental care.\n\nWould you like me to show you our available appointment slots, check treatment pricing, or answer questions about private insurance?`,
      triage
    };
  }
}

module.exports = new GeminiService();
