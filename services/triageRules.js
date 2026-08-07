/**
 * UK NHS Dental Emergency Triage Protocol & Clinical Safety Rules
 * Prevents AI medical liability, categorizes patient urgency, and dictates booking priority.
 */

const TRIAGE_LEVELS = {
  CRITICAL: {
    level: 1,
    code: "CRITICAL_EMERGENCY",
    title: "Immediate Medical Emergency",
    color: "#e63946",
    actionRequired: "Direct to 999 or Nearest A&E Hospital Immediately",
    maxWaitHours: 0,
    disclaimer: "WARNING: Symptoms indicate potential airway or systemic compromise. Do not wait for a dental clinic opening."
  },
  URGENT: {
    level: 2,
    code: "SAME_DAY_URGENT",
    title: "Urgent Same-Day Dental Care",
    color: "#f77f00",
    actionRequired: "Book Immediate Emergency Slot & Notify Surgeon via SMS",
    maxWaitHours: 24,
    disclaimer: "Urgent care required to control pain or save tooth structure."
  },
  ROUTINE: {
    level: 3,
    code: "ROUTINE_CARE",
    title: "Standard Appointment",
    color: "#2a9d8f",
    actionRequired: "Standard Calendar Slot Selection",
    maxWaitHours: 168,
    disclaimer: "Routine consultation, hygiene, or non-acute treatment."
  }
};

/**
 * Keywords & Pain Metrics for Triage Assessment
 */
function evaluateTriage(message, painScale = null) {
  const lowerMsg = (message || "").toLowerCase();

  // Critical Red Flags (NHS 111 Dental Emergency triggers)
  const criticalTriggers = [
    "difficulty breathing", "trouble swallowing", "swelling to eye", "swelling to neck",
    "uncontrollable bleeding", "heavy bleeding", "fractured jaw", "can't open mouth",
    "fainting", "trauma head", "high fever with swelling"
  ];

  // Urgent Triggers
  const urgentTriggers = [
    "severe pain", "excessive pain", "unbearable", "knocked out tooth", "avulsed tooth",
    "broken tooth nerve", "throbbing pain", "pus", "abscess", "swollen cheek",
    "pain keeps awake", "painkillers not working", "bleeding socket"
  ];

  for (const trigger of criticalTriggers) {
    if (lowerMsg.includes(trigger)) {
      return {
        ...TRIAGE_LEVELS.CRITICAL,
        matchedTrigger: trigger,
        isMedicalAdviceProvided: false
      };
    }
  }

  // Check numeric pain scale if provided (>= 7/10 is Urgent)
  if ((painScale && painScale >= 7) || urgentTriggers.some(trig => lowerMsg.includes(trig))) {
    return {
      ...TRIAGE_LEVELS.URGENT,
      matchedTrigger: urgentTriggers.find(trig => lowerMsg.includes(trig)) || `Pain Score ${painScale}/10`,
      isMedicalAdviceProvided: false
    };
  }

  return {
    ...TRIAGE_LEVELS.ROUTINE,
    matchedTrigger: "Standard Request",
    isMedicalAdviceProvided: false
  };
}

module.exports = {
  TRIAGE_LEVELS,
  evaluateTriage
};
