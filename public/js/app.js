let chatHistory = [];
let currentBookingDraft = {};
let recognition = null;

// Dynamic Real-World Slot Fetcher (PKT Synced)
async function loadLiveRealWorldSlots() {
  try {
    const res = await fetch('/api/slots');
    const data = await res.json();
    const slots = data.slots || [];
    
    // Populate Modal Dropdown
    const select = document.getElementById('slotSelect');
    if (select && slots.length > 0) {
      select.innerHTML = slots.map(s => `
        <option value="${s.date}|${s.time}">${s.display || s.shortLabel}</option>
      `).join('');
    }

    // Populate Hero Chips
    const chipsGrid = document.querySelector('.slot-chips-grid');
    if (chipsGrid && slots.length > 0) {
      chipsGrid.innerHTML = slots.slice(0, 4).map(s => `
        <button class="slot-chip-btn" onclick="selectSlotAndBook('${s.date}', '${s.time}')">${s.shortLabel || s.display}</button>
      `).join('');
    }
  } catch (e) {
    console.error("Failed to load live slots:", e);
  }
}

// Haptic entrance pulse trigger after 5 seconds
setTimeout(() => {
  const widgetBtn = document.getElementById('aiCollapsedBtn');
  if (widgetBtn && !document.getElementById('aiDrawer').classList.contains('active')) {
    widgetBtn.classList.add('haptic-pulse');
    setTimeout(() => widgetBtn.classList.remove('haptic-pulse'), 4000);
  }
}, 5000);

document.addEventListener('DOMContentLoaded', loadLiveRealWorldSlots);

// Web Audio API Synthesized Chimes
function playAudioChime(type = 'response') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'emergency') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // Audio Context blocked until user interaction
  }
}

// 1. Draggable Before/After Image Comparison Slider
function updateBeforeAfterSlider(val) {
  const beforeImg = document.getElementById('baBeforeImage');
  const divider = document.getElementById('baDivider');
  if (beforeImg && divider) {
    beforeImg.style.width = `${val}%`;
    divider.style.left = `${val}%`;
  }
}

// 2. Voice Speech Dictation (Mic)
function toggleVoiceDictation() {
  const micBtn = document.getElementById('micBtn');
  const input = document.getElementById('drawerInput');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("Speech recognition is not supported in this browser. Try Chrome or Edge!");
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    micBtn.classList.remove('listening');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-GB';

  micBtn.classList.add('listening');

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    micBtn.classList.remove('listening');
    recognition = null;
  };

  recognition.onerror = (event) => {
    console.error("Speech error:", event.error);
    micBtn.classList.remove('listening');
    recognition = null;
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
    recognition = null;
  };

  recognition.start();
}

// 3. Social Proof Toasts Rotator
const TOAST_DATA = [
  { name: "Sarah J. from Marylebone", action: "Just booked a teeth whitening slot (3 mins ago)" },
  { name: "Marcus V. from Mayfair", action: "Booked a routine airflow cleaning (12 mins ago)" },
  { name: "Priya S. from Kensington", action: "Reserved a Same-Day Emergency Slot (18 mins ago)" },
  { name: "David M. from Fitzrovia", action: "Scheduled an Invisalign consultation (25 mins ago)" }
];

let toastIdx = 0;
function rotateSocialToasts() {
  const toast = document.getElementById('socialToast');
  if (!toast) return;

  const item = TOAST_DATA[toastIdx % TOAST_DATA.length];
  document.getElementById('toastName').innerText = item.name;
  document.getElementById('toastAction').innerText = item.action;

  toast.style.display = 'flex';
  toast.style.animation = 'none';
  toast.offsetHeight;
  toast.style.animation = 'slideUp 0.4s ease';

  toastIdx++;
  setTimeout(rotateSocialToasts, 14000);
}
setTimeout(rotateSocialToasts, 4000);

// Toggle Floating AI Drawer Overlay
function toggleAIDrawer() {
  const drawer = document.getElementById('aiDrawer');
  drawer.classList.toggle('active');
  if (drawer.classList.contains('active')) {
    document.getElementById('drawerInput').focus();
  }
}

// Quick Slot Selection from Hero Card
function selectSlotAndBook(date, time) {
  const select = document.getElementById('slotSelect');
  const matchingOpt = Array.from(select.options).find(opt => opt.value.includes(date) || opt.text.includes(time));
  if (matchingOpt) {
    select.value = matchingOpt.value;
  }
  openBookingModal();
}

// Handle Drawer Submit
async function handleDrawerChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('drawerInput');
  const text = input.value.trim();
  if (!text) return;

  appendDrawerBubble(text, 'user');
  input.value = '';

  await sendDrawerMessageToBot(text);
}

function sendDrawerChip(text) {
  if (!document.getElementById('aiDrawer').classList.contains('active')) {
    toggleAIDrawer();
  }
  appendDrawerBubble(text, 'user');
  sendDrawerMessageToBot(text);
}

// High-Speed Instant Response Sender (Optimized Latency)
async function sendDrawerMessageToBot(text) {
  showTypingIndicator();
  const startTime = Date.now();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        chatHistory,
        bookingDraft: currentBookingDraft
      })
    });

    const data = await res.json();

    // Fast sub-second latency delay (400ms for natural feel)
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 400 - elapsed);
    await new Promise(resolve => setTimeout(resolve, remainingDelay));

    removeTypingIndicator();

    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'bot', content: data.reply });

    if (data.requiresEmergencyRouting) {
      playAudioChime('emergency');
      appendDrawerBubble(data.reply, 'critical-alert');
    } else {
      playAudioChime('response');
      appendDrawerBubble(data.reply, 'bot');
    }

    // IF USER SELECTED A SLOT OR REQUESTED CALLBACK, OPEN MODAL
    if (data.promptForDetails || data.selectedSlot || data.isCallbackPrompted) {
      if (data.slotDate && data.slotTime) {
        const select = document.getElementById('slotSelect');
        const matchingOpt = Array.from(select.options).find(opt => opt.value.includes(data.slotDate));
        if (matchingOpt) select.value = matchingOpt.value;
      }
      setTimeout(() => {
        openBookingModal();
      }, 1000);
    }

  } catch (err) {
    console.error("Chat API error:", err);
    removeTypingIndicator();
    appendDrawerBubble("I'm sorry, I am having trouble connecting to Aura Dental's reception server. Please try again shortly.", 'bot');
  }
}

function showTypingIndicator() {
  removeTypingIndicator();
  const body = document.getElementById('drawerChatBody');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typingIndicator';
  typingDiv.className = 'typing-indicator-bubble';
  typingDiv.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  body.appendChild(typingDiv);
  body.scrollTop = body.scrollHeight;
}

function removeTypingIndicator() {
  const existing = document.getElementById('typingIndicator');
  if (existing) {
    existing.remove();
  }
}

function appendDrawerBubble(text, type) {
  const body = document.getElementById('drawerChatBody');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  
  // Format HTML & Markdown bolding
  let formatted = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  bubble.innerHTML = formatted;
  body.appendChild(bubble);
  body.scrollTop = body.scrollHeight;
}

function openBookingModal() {
  document.getElementById('bookingModal').classList.add('active');
}

function closeModal() {
  document.getElementById('bookingModal').classList.remove('active');
}

async function submitFinalBooking(e) {
  e.preventDefault();
  const name = document.getElementById('patientName').value.trim();
  const phone = document.getElementById('patientPhone').value.trim();
  const email = document.getElementById('patientEmail').value.trim();
  const slotVal = document.getElementById('slotSelect').value.split('|');
  const date = slotVal[0];
  const time = slotVal[1];
  const symptoms = document.getElementById('symptomNotes').value.trim();

  closeModal();

  if (!document.getElementById('aiDrawer').classList.contains('active')) {
    toggleAIDrawer();
  }

  showTypingIndicator();
  await new Promise(resolve => setTimeout(resolve, 800));
  removeTypingIndicator();

  appendDrawerBubble(`⏳ Securing slot for ${name}... Dispatching booking notification...`, 'bot');

  try {
    const res = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: name,
        patientPhone: phone,
        patientEmail: email,
        date,
        time,
        symptoms,
        painScore: symptoms.toLowerCase().includes('emergency') || symptoms.toLowerCase().includes('pain') ? 8 : 2
      })
    });

    const data = await res.json();

    if (data.success) {
      playAudioChime('response');

      const gcalUrl = data.gcalUrl || `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Dental+Appointment&details=Aura+Dental+Studio+Appointment&location=72+Harley+Street+London`;

      const confirmHtml = `
🎉 <strong>APPOINTMENT CONFIRMED AT AURA DENTAL!</strong><br><br>
• <strong>Ref ID</strong>: <code>${data.bookingId}</code><br>
• <strong>Patient</strong>: ${name}<br>
• <strong>Slot</strong>: ${data.date} at ${data.time}<br>
• <strong>Clinic</strong>: 72 Harley Street, London W1G 7HG<br><br>

<a href="${gcalUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; margin-top:6px; padding:10px 16px; background:#4285F4; color:#FFFFFF; font-weight:800; border-radius:8px; text-decoration:none; box-shadow:0 4px 12px rgba(66,133,244,0.3);">
  📅 Add to Google Calendar
</a><br><br>
Dr. Alexander Wright and the Aura Dental team look forward to seeing you!
      `;

      const body = document.getElementById('drawerChatBody');
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble bot';
      bubble.innerHTML = confirmHtml;
      body.appendChild(bubble);
      body.scrollTop = body.scrollHeight;

    } else {
      appendDrawerBubble(`⚠️ Booking error: ${data.error || 'Unknown error'}`, 'bot');
    }

  } catch (err) {
    console.error("Booking error:", err);
    appendDrawerBubble("⚠️ Connection error while finalizing booking. Please try again.", 'bot');
  }
}
