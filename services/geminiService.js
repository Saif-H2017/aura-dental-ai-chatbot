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
      console.log("ℹ️ Gemini AI running in High-Performance 6-Service UK Triage Engine.");
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

CLINIC KNOWLEDGE & 6 UK SERVICE OFFERINGS:
1. General & Airflow® Hygiene: Comprehensive oral exam, digital X-rays (£95), Airflow® spa stain removal (£85).
2. Cosmetic & Composite Bonding: Hand-sculpted bonding, 6-shade laser whitening (£350), porcelain veneers.
3. Invisalign® Clear Aligners: £1,500+, includes free 3D iTero® scan + whitening + retainers.
4. Dental Implants & Restorative: Single implants, full arch, root canals, porcelain crowns.
5. Same-Day Emergency Triage: Urgent pain relief (£120), dedicated emergency slots.
6. Nervous Patients & IV Sedation: Anxiety-free care, conscious IV sedation, ceiling TVs, noise-canceling headphones.

LIVE REAL-WORLD SLOTS:
${slotListText}

EMERGENCY TRIAGE RULE (CRITICAL):
If the patient mentions severe pain, toothache, broken tooth, bleeding, swelling, or emergency:
1. Express immediate empathy.
2. Trigger high-priority triage path with immediate same-day slot reservations or emergency callback collection.
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
        reply: `🚨 **CRITICAL MEDICAL EMERGENCY SAFETY ALERT**:\nBased on symptoms described (${triage.matchedTrigger}), this indicates potential airway or systemic compromise. Please call **999** or go directly to your nearest NHS A&E hospital immediately.\n\nDr. Wright's clinic cannot delay acute airway emergencies. Stay safe!`,
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

    // 1. INVISALIGN PRICING & CONSULTATION
    if (msg.includes("invisalign") || msg.includes("aligner") || msg.includes("orthodontic") || msg.includes("straighten")) {
      return {
        reply: `💎 **Invisalign® Clear Aligners at Aura Dental Studio**\n\nTransform your smile discreetly with virtually invisible removable aligners!\n\n• **Invisalign® Treatment**: From £1,500 (Flexible monthly payment options from £125/mo)\n• **Package Includes**: Complimentary 3D iTero® Digital Outcome Simulation + Free Laser Teeth Whitening + Vivera® Retainers\n\nWould you like me to book your complimentary 3D scan with Dr. Wright?`,
        triage
      };
    }

    // 2. HUMAN CALLBACK / SPEAK TO RECEPTION
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

    // 3. URGENT TRIAGE MODE ("severe pain", "swelling", "broken tooth", "bleeding", "emergency tooth pain", "toothache")
    if (
      msg.includes("pain") ||
      msg.includes("swelling") ||
      msg.includes("swollen") ||
      msg.includes("broken") ||
      msg.includes("bleeding") ||
      msg.includes("emergency") ||
      msg.includes("ache") ||
      msg.includes("hurt")
    ) {
      const urgentSlot = liveSlots[0];
      return {
        reply: `🚨 **HIGH-PRIORITY EMERGENCY TRIAGE INTAKE**\n\nI am so sorry to hear you are experiencing discomfort! Let me reserve immediate relief for you:\n\n1. **Is there any active facial swelling or uncontrollable bleeding?** (Yes / No)\n2. **On a scale of 1-10, how severe is your pain right now?**\n\nWe have a high-priority Emergency Slot reserved for **${urgentSlot.display}**. Or click **📞 Speak to Reception** to request an instant 15-minute callback!`,
        triage,
        isUrgentPrompted: true
      };
    }

    // 4. AFFIRMATIVE RESPONSES ("yes", "yeah", "sure", "okay", "yep", "ok", "please", "book appointment")
    if (
      msg === "yes" ||
      msg === "yeah" ||
      msg === "sure" ||
      msg === "okay" ||
      msg === "ok" ||
      msg === "yep" ||
      msg === "please" ||
      msg === "alright" ||
      msg.includes("book appointment") ||
      msg.startsWith("yes ")
    ) {
      const formattedSlots = liveSlots.map((s, idx) => `• **Option ${idx + 1}**: ${s.display}`).join('\n');
      return {
        reply: `Wonderful! Here are our next available slots with Dr. Alexander Wright:\n\n${formattedSlots}\n\nWhich option (1, 2, 3, 4, or 5) works best for you?`,
        triage,
        suggestSlots: true
      };
    }

    // 5. GRATITUDE / COURTESY ("thanks", "thank you", "cheers", "awesome", "great", "perfect")
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

    // 6. NEGATION ("no", "nope", "not now", "no thanks", "cancel")
    if (
      msg === "no" ||
      msg === "nope" ||
      msg.includes("not right now") ||
      msg.includes("no thanks") ||
      msg === "cancel"
    ) {
      return {
        reply: `No problem at all! Feel free to reach out whenever you're ready to schedule your visit. Have a great day!`,
        triage
      };
    }

    // 7. SLOT SELECTION HANDLER (Option 1, 2, 3, 4, 5 or time matching)
    let selectedSlotObj = null;
    if (msg.includes("option 1") || msg === "1" || msg.includes("first slot") || (liveSlots[0] && msg.includes(liveSlots[0].time.toLowerCase()))) {
      selectedSlotObj = liveSlots[0];
    } else if (msg.includes("option 2") || msg === "2" || msg.includes("second slot") || (liveSlots[1] && msg.includes(liveSlots[1].time.toLowerCase()))) {
      selectedSlotObj = liveSlots[1];
    } else if (msg.includes("option 3") || msg === "3" || msg.includes("third slot") || (liveSlots[2] && msg.includes(liveSlots[2].time.toLowerCase()))) {
      selectedSlotObj = liveSlots[2];
    } else if (msg.includes("option 4") || msg === "4" || msg.includes("fourth slot") || (liveSlots[3] && msg.includes(liveSlots[3].time.toLowerCase()))) {
      selectedSlotObj = liveSlots[3];
    } else if (msg.includes("option 5") || msg === "5" || msg.includes("fifth slot") || (liveSlots[4] && msg.includes(liveSlots[4].time.toLowerCase()))) {
      selectedSlotObj = liveSlots[4];
    }

    if (selectedSlotObj) {
      return {
        reply: `🎉 **Slot Reserved: ${selectedSlotObj.display}**\n\nExcellent! I have pre-selected **${selectedSlotObj.display}** for your consultation with Dr. Alexander Wright.\n\nPlease confirm your details in the booking form below to finalize!`,
        triage,
        selectedSlot: selectedSlotObj.display,
        slotDate: selectedSlotObj.date,
        slotTime: selectedSlotObj.time,
        promptForDetails: true
      };
    }

    // 8. DIRECT BOOKING INTENT HANDLER
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
        reply: `📅 **Live Real-World Available Slots at Aura Dental Studio (UK Time)**:\n\n${formattedSlots}\n\nWhich option (1, 2, 3, 4, or 5) works best for you?`,
        triage,
        suggestSlots: true
      };
    }

    // 9. PRIVATE INSURANCE QUERY
    if (msg.includes("insurance") || msg.includes("bupa") || msg.includes("axa") || msg.includes("simplyhealth") || msg.includes("aviva") || msg.includes("claim") || msg.includes("policy")) {
      return {
        reply: `💳 **Yes, we accept Private Health Insurance!**\n\nAura Dental Studio accepts all major UK private dental insurance providers, including:\n• **Bupa**\n• **AXA Health**\n• **Simplyhealth**\n• **Aviva**\n• **WPA & Cigna**\n\nWe provide itemized billing receipts and BDA clinical treatment codes so you can claim your reimbursement directly with zero hassle.`,
        triage
      };
    }

    // 10. NERVOUS PATIENT & IV SEDATION
    if (msg.includes("nervous") || msg.includes("anxious") || msg.includes("scared") || msg.includes("fear") || msg.includes("phobia") || msg.includes("sedation") || msg.includes("sleep")) {
      return {
        reply: `🧘 **Nervous Patients & Conscious IV Sedation**\n\nOver 40% of our patients felt anxious before visiting us. At Aura Dental Studio, we create a soothing environment featuring:\n• **Conscious IV Sedation**: Gentle twilight sleep where you feel completely relaxed & pain-free.\n• Painless micro-needles & topical numbing gels\n• Noise-canceling headphones & warm aromatherapy towels\n• Ceiling TV screens during treatment\n\nDr. Wright and our team take all the time you need.`,
        triage
      };
    }

    // 11. LOCATION & PARKING
    if (msg.includes("where") || msg.includes("address") || msg.includes("location") || msg.includes("find") || msg.includes("parking") || msg.includes("tube") || msg.includes("station")) {
      return {
        reply: `📍 **Clinic Location & Access**:\nWe are situated at **72 Harley Street, Marylebone, London W1G 7HG**.\n\n🚆 **Nearest Tube Stations**:\n• Regent's Park (Bakerloo Line - 5 min walk)\n• Bond Street (Central, Jubilee, Elizabeth Line - 7 min walk)\n\n🚗 **Parking**: Pay-and-display parking is available directly on Harley Street, or at Q-Park Cavendish Square.`,
        triage
      };
    }

    // 12. OPENING HOURS
    if (msg.includes("hours") || msg.includes("open") || msg.includes("time") || msg.includes("weekend") || msg.includes("sunday")) {
      return {
        reply: `⏰ **Aura Dental Opening Hours**:\n• **Monday – Friday**: 08:30 AM – 06:00 PM\n• **Saturday**: 09:00 AM – 04:00 PM (Emergency slots only)\n• **Sunday**: Closed (24/7 AI Triage Active)\n\nSame-day emergency appointments are reserved daily for urgent toothache relief.`,
        triage
      };
    }

    // 13. FEES & PRICING
    if (msg.includes("cost") || msg.includes("price") || msg.includes("fee") || msg.includes("how much") || msg.includes("rate") || msg.includes("expensive")) {
      return {
        reply: `💰 **Aura Dental Transparent Fee Guide**:\n• **New Patient Examination & Digital X-rays**: £95\n• **Airflow® Hygiene Cleaning**: £85\n• **Emergency Pain Assessment**: £120\n• **6-Shade Laser Teeth Whitening**: £350\n• **Invisalign® Consultation**: Complimentary 3D iTero® Scan\n\nAll treatment plans are provided with itemized costs before any procedure begins!`,
        triage
      };
    }

    // 14. GREETING
    if (msg === "hi" || msg === "hello" || msg === "hey" || msg.startsWith("good morning") || msg.startsWith("good afternoon")) {
      return {
        reply: `Hello! Welcome to Aura Dental Studio in Marylebone, London. I'm Harley, Dr. Wright's AI Concierge.\n\nHow can I help you today? Feel free to ask about Invisalign®, Airflow® hygiene, IV sedation, emergency pain triage, or booking a consultation.`,
        triage
      };
    }

    // 15. POLISHED HUMAN-LIKE RECEPTIONIST DEFAULT FALLBACK
    return {
      reply: `I would be happy to assist you! At Aura Dental Studio in Marylebone, Dr. Alexander Wright and our team are here to deliver gentle, state-of-the-art dental care.\n\nWould you like me to show you our available appointment slots, check Invisalign® pricing, or answer questions about private insurance?`,
      triage
    };
  }
}

module.exports = new GeminiService();
