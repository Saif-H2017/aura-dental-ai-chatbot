let chatHistory = [];
let currentBookingDraft = {};

// Toggle Floating AI Drawer Overlay
function toggleAIDrawer() {
  const drawer = document.getElementById('aiDrawer');
  drawer.classList.toggle('active');
  if (drawer.classList.contains('active')) {
    document.getElementById('drawerInput').focus();
  }
}

// Quick Slot Selection from Hero Card
function selectSlotAndBook(day, time) {
  const select = document.getElementById('slotSelect');
  const matchingOpt = Array.from(select.options).find(opt => opt.text.includes(day) && opt.text.includes(time));
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

async function sendDrawerMessageToBot(text) {
  // Show 3-dots typing indicator immediately (matching user's design)
  showTypingIndicator();

  // Record start timestamp for minimum 4-second typing feel
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

    // Ensure at least 4 seconds typing animation delay as requested
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 4000 - elapsed);
    await new Promise(resolve => setTimeout(resolve, remainingDelay));

    // Remove typing indicator
    removeTypingIndicator();

    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'bot', content: data.reply });

    if (data.requiresEmergencyRouting) {
      appendDrawerBubble(data.reply, 'critical-alert');
    } else {
      appendDrawerBubble(data.reply, 'bot');
    }

    if (data.suggestSlots || data.isUrgentPrompted || text.toLowerCase().includes('book') || text.toLowerCase().includes('cleaning') || text.toLowerCase().includes('emergency')) {
      document.getElementById('symptomNotes').value = text;
      setTimeout(() => {
        openBookingModal();
      }, 1500);
    }

  } catch (err) {
    console.error("Chat API error:", err);
    removeTypingIndicator();
    appendDrawerBubble("I'm sorry, I am having trouble connecting to Aura Dental's reception server. Please try again shortly.", 'bot');
  }
}

function showTypingIndicator() {
  removeTypingIndicator(); // Ensure no duplicates
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
  bubble.innerHTML = text.replace(/\n/g, '<br>');
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
  await new Promise(resolve => setTimeout(resolve, 3000));
  removeTypingIndicator();

  appendDrawerBubble(`⏳ Securing slot for ${name}... Checking Google Calendar & dispatching doctor mobile alerts...`, 'bot');

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
      const confirmHtml = `
🎉 **APPOINTMENT CONFIRMED AT AURA DENTAL!**\n
- **Ref ID**: \`${data.bookingId}\`
- **Patient**: ${name}
- **Slot**: ${data.date} at ${data.time}
- **Clinic**: 72 Harley Street, London W1G 7HG\n
📱 **Notification Status**:
- Doctor Mobile Alert: **${data.notifications[0]?.status || 'Dispatched'}**
- Patient Email & WhatsApp: **${data.notifications[2]?.status || 'Sent'}**\n
Dr. Alexander Wright and the Aura Dental team look forward to seeing you!
      `;
      appendDrawerBubble(confirmHtml, 'bot');
    } else {
      appendDrawerBubble(`⚠️ Booking error: ${data.error || 'Unknown error'}`, 'bot');
    }

  } catch (err) {
    console.error("Booking error:", err);
    appendDrawerBubble("⚠️ Connection error while finalizing booking. Please try again.", 'bot');
  }
}
