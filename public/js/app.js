let chatHistory = [];
let currentBookingDraft = {};
let recognition = null;

// Dynamic Real-World Slot Fetcher (Europe/London UK Time Synced)
async function loadLiveRealWorldSlots() {
  const select = document.getElementById('slotSelect');
  const chipsGrid = document.querySelector('.slot-chips-grid');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/slots', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const slots = data.slots || [];
    
    if (slots.length > 0) {
      if (select) {
        select.innerHTML = slots.map(s => `
          <option value="${s.date}|${s.time}">${s.display || s.shortLabel}</option>
        `).join('');
      }

      if (chipsGrid) {
        chipsGrid.innerHTML = slots.slice(0, 4).map(s => `
          <button class="slot-chip-btn" onclick="selectSlotAndBook('${s.date}', '${s.time}')">${s.shortLabel || s.display}</button>
        `).join('');
      }
    } else {
      throw new Error("No open slots returned");
    }
  } catch (e) {
    console.warn("Unable to fetch live calendar slots:", e.message);
    
    if (select) {
      select.innerHTML = `<option value="">⚠️ Live slots unavailable - Book via 24/7 AI Concierge</option>`;
    }
    
    if (chipsGrid) {
      chipsGrid.innerHTML = `
        <div style="background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:0.6rem 1rem; border-radius:12px; font-size:0.82rem; font-weight:600; display:flex; align-items:center; justify-content:space-between; width:100%; gap:0.5rem;">
          <span>⚠️ Live slot calendar sync unavailable right now</span>
          <button onclick="loadLiveRealWorldSlots()" style="background:#D97706; color:white; border:none; padding:0.3rem 0.6rem; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.75rem;">Retry ↺</button>
        </div>
      `;
    }
  }
}

// 48 PATIENT REVIEWS & FILTERING ENGINE
let currentReviewFilter = 'all';
let currentReviewLimit = 6;

function renderReviews() {
  const container = document.getElementById('reviewsGrid');
  const countBadge = document.getElementById('reviewCountBadge');
  const loadMoreBtn = document.getElementById('btnLoadMoreReviews');
  
  const reviews = window.REVIEWS_DATA || (typeof REVIEWS_DATA !== 'undefined' ? REVIEWS_DATA : []);
  if (!container || !reviews || reviews.length === 0) return;

  let filtered = reviews;
  if (currentReviewFilter === '5.0') filtered = reviews.filter(r => r.rating === 5.0);
  else if (currentReviewFilter === '4.5') filtered = reviews.filter(r => r.rating === 4.5);
  else if (currentReviewFilter === '4.0') filtered = reviews.filter(r => r.rating === 4.0);
  else if (currentReviewFilter === '3.5') filtered = reviews.filter(r => r.rating === 3.5);

  if (countBadge) countBadge.innerText = `Showing ${Math.min(currentReviewLimit, filtered.length)} of ${filtered.length} Reviews`;

  const visible = filtered.slice(0, currentReviewLimit);

  container.innerHTML = visible.map(r => {
    let starsHtml = '★★★★★';
    if (r.rating === 4.5) starsHtml = '★★★★½';
    else if (r.rating === 4.0) starsHtml = '★★★★☆';
    else if (r.rating === 3.5) starsHtml = '★★★½☆';

    return `
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-stars">${starsHtml} <span class="review-rating-num">(${r.rating.toFixed(1)})</span></div>
          <span class="review-badge">${r.category}</span>
        </div>
        <p class="review-text">"${r.comment}"</p>
        <div class="review-author-meta">
          <strong>${r.name}</strong> • ${r.location}
          <span class="review-date">${r.date}</span>
        </div>
      </div>
    `;
  }).join('');

  if (loadMoreBtn) {
    if (currentReviewLimit >= filtered.length) {
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = 'inline-block';
      loadMoreBtn.innerText = `Load More Reviews (+${filtered.length - currentReviewLimit} remaining)`;
    }
  }
}

function filterReviews(filterVal, btnEl) {
  currentReviewFilter = filterVal;
  currentReviewLimit = 6;
  
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  renderReviews();
}

function loadMoreReviews() {
  currentReviewLimit += 6;
  renderReviews();
}

// Haptic entrance pulse trigger after 5 seconds
setTimeout(() => {
  const widgetBtn = document.getElementById('aiCollapsedBtn');
  if (widgetBtn && !document.getElementById('aiDrawer').classList.contains('active')) {
    widgetBtn.classList.add('haptic-pulse');
    setTimeout(() => widgetBtn.classList.remove('haptic-pulse'), 4000);
  }
}, 5000);

document.addEventListener('DOMContentLoaded', () => {
  loadLiveRealWorldSlots();
  renderReviews();
});

window.addEventListener('load', () => {
  renderReviews();
});

// Immediate execution fallback
setTimeout(renderReviews, 200);

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

// Toggle Floating AI Drawer Overlay
function toggleAIDrawer() {
  const drawer = document.getElementById('aiDrawer');
  const stickyBar = document.getElementById('mobileStickyBar');
  
  drawer.classList.toggle('active');
  
  if (drawer.classList.contains('active')) {
    if (stickyBar) stickyBar.style.display = 'none';
    document.getElementById('drawerInput').focus();
  } else {
    if (stickyBar && window.innerWidth <= 768) stickyBar.style.display = 'block';
  }
}

// Legal Compliance Modals (Privacy Policy, Terms of Service, GDPR)
function openLegalModal(modalId) {
  const modal = document.getElementById(modalId);
  const stickyBar = document.getElementById('mobileStickyBar');
  if (modal) {
    modal.classList.add('active');
    if (stickyBar) stickyBar.style.display = 'none';
  }
}

function closeLegalModal(modalId) {
  const modal = document.getElementById(modalId);
  const stickyBar = document.getElementById('mobileStickyBar');
  if (modal) {
    modal.classList.remove('active');
    if (stickyBar && window.innerWidth <= 768 && !document.getElementById('aiDrawer').classList.contains('active')) {
      stickyBar.style.display = 'block';
    }
  }
}

// Global keydown escape listener for accessibility
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['privacyModal', 'termsModal', 'gdprModal', 'bookingModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m && m.classList.contains('active')) m.classList.remove('active');
    });
    const drawer = document.getElementById('aiDrawer');
    if (drawer && drawer.classList.contains('active')) toggleAIDrawer();
  }
});


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

// High-Speed Response Sender with Dynamic 1.2s – 1.5s Typing Delay
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

    // Dynamic 1.2s – 1.5s natural human response delay window
    const targetDelay = Math.floor(Math.random() * 300) + 1200; // 1200ms to 1500ms
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, targetDelay - elapsed);
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
• <strong>Email</strong>: ${email} (Confirmation Dispatched ✉️)<br>
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
