import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getDatabase, ref, set, remove, onChildAdded, onChildChanged, onChildRemoved,
  onValue, onDisconnect, get, query, orderByKey, limitToLast, update
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwiuV6OxyXNK2A7_utfw8UdsuIbAfMgBI",
  authDomain: "blackhs.firebaseapp.com",
  databaseURL: "https://blackhs-default-rtdb.firebaseio.com",
  projectId: "blackhs",
  storageBucket: "blackhs.appspot.com",
  messagingSenderId: "849633201387",
  appId: "1:849633201387:web:facbd767e26664e01142ae"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const loginPage = document.getElementById("loginPage");
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");
const onlineUsersDiv = document.getElementById("onlineUsers");
const messagesDiv = document.getElementById("messages");
const msgTxt = document.getElementById("msgTxt");
const msgBtn = document.getElementById("msgBtn");
const imgUploadBtn = document.getElementById("imgUploadBtn");
const imgUpload = document.getElementById("imgUpload");
const replyContext = document.getElementById("replyContext");
const replyMsg = document.getElementById("replyMsg");
const cancelReply = document.getElementById("cancelReply");
const startRec = document.getElementById("startRec");
const stopRec = document.getElementById("stopRec");
const typingIndicator = document.getElementById("typingIndicator");
const typingUserSpan = document.getElementById("typingUser");
const typingActionSpan = document.getElementById("typingAction");
const appHeader = document.getElementById("appHeader");
const sendMsgDiv = document.getElementById("sendMsg");

// Popups & Bubbles
const lastSeenBubble = document.getElementById("lastSeenBubble");
const lastSeenPopup = document.getElementById("lastSeenPopup");
const lastSeenList = document.getElementById("lastSeenList");
const imageBubble = document.getElementById("imageBubble");
const imagePopup = document.getElementById("imagePopup");
const imagePopupClose = document.getElementById("imagePopupClose");
const loveBubble = document.getElementById("loveBubble");
const emojiPopup = document.getElementById("emojiPopup");
const emojiListContainer = document.getElementById("emojiListContainer");
const emojiRainContainer = document.getElementById("emojiRainContainer");   
const themeBubble = document.getElementById("themeBubble");
const themePopup = document.getElementById("themePopup");
const colorThemeList = document.getElementById("colorThemeList");
const root = document.documentElement; 

// Lightbox
const chatImageLightbox = document.getElementById("chatImageLightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.querySelector(".lightbox-close");

// ⭐ Reaction Elements
const reactionPopup = document.getElementById("reactionPopup");
const reactionEmojis = document.querySelectorAll("#reactionPopup .reaction-emoji");

let sender = null;
let onlineRef = null;
let replyTo = null;
let oldestKey = null;
let mediaRecorder;
let audioChunks = [];

// ⭐ Reaction State
let currentMessageKey = null; 
let pressTimer;
let messageTarget;

// Initial State
onlineUsersDiv.innerHTML = "Offline";
messagesDiv.style.display = "none";
appHeader.style.display = "none";
sendMsgDiv.style.display = "none";
errorMsg.style.display = "none";

// Close Popups
document.addEventListener("click", (e) => {
    if(e.target.classList.contains("close-popup")) {
        e.target.closest(".popup-menu").style.display = "none";
    }
    // Close reaction popup if clicked outside
    if(reactionPopup.style.display === "flex" && !reactionPopup.contains(e.target) && !e.target.closest('.me, .notMe')) {
        reactionPopup.style.display = "none";
    }
});

// Login Logic
loginBtn.addEventListener("click", () => {
  const password = passwordInput.value.trim();
  const correctPassword = "0759";

  if (password === correctPassword) {
    loginPage.style.display = "none";
    appHeader.style.display = "flex";
    messagesDiv.style.display = "flex";
    sendMsgDiv.style.display = "block";
    
    startFontChanger();
    startMagicEffects();

    sender = sessionStorage.getItem("sender") || prompt("Enter your name:") || "Guest";
    sessionStorage.setItem("sender", sender);
    onlineRef = ref(db, "online/" + sender);
    set(onlineRef, { name: sender, isTyping: false, isRecording: false });

    const lastSeenRef = ref(db, "lastSeen/" + sender);
    onDisconnect(onlineRef).remove();
    onDisconnect(lastSeenRef).set(new Date().toLocaleString());

    setupChat();
    loadInitialMessages();
  } else {
    errorMsg.style.display = "block";
  }
});

function setupChat() {
  // Online Users & Status
  onValue(ref(db, "online"), (snap) => {
    const users = snap.val() || {};
    const userListHTML = Object.values(users).map(u => {
        let statusIcon = "";
        if (u.isRecording) statusIcon = "🎙️";
        else if (u.isTyping) statusIcon = "✍️";
        let color = u.name === sender ? "var(--text-color)" : "inherit";
        return `<span style="color:${color}">${u.name}${statusIcon}</span>`;
    }).join(", ");
    
    onlineUsersDiv.innerHTML = userListHTML || "Offline";

    // Typing Logic
    const typingUsers = Object.values(users).filter(u => u.isTyping && u.name !== sender);
    const recordingUsers = Object.values(users).filter(u => u.isRecording && u.name !== sender);
    
    if(recordingUsers.length > 0) {
        typingIndicator.style.display = "block";
        typingUserSpan.textContent = recordingUsers[0].name;
        typingActionSpan.textContent = "is recording...";
        typingActionSpan.style.color = "#ef4444";
    } else if(typingUsers.length > 0) {
        typingIndicator.style.display = "block";
        typingUserSpan.textContent = typingUsers[0].name;
        typingActionSpan.textContent = "is typing...";
        typingActionSpan.style.color = "var(--text-color)";
    } else {
        typingIndicator.style.display = "none";
    }
  });

  msgTxt.addEventListener("input", () => {
    if (!onlineRef) return;
    set(onlineRef, { name: sender, isTyping: msgTxt.value.trim() !== "", isRecording: false });
  });

  // Send Message
  msgBtn.addEventListener("click", () => {
    const text = msgTxt.value.trim();
    if (!text) return;
    const key = Date.now().toString();
    set(ref(db, "messages/" + key), {
      sender, msg: text, replyTo, type: "text", time: new Date().toLocaleString(), seen: false
    });
    msgTxt.value = "";
    replyTo = null;
    replyContext.style.display = "none";
    set(onlineRef, { name: sender, isTyping: false, isRecording: false });
  });

  // Image Upload Fix
  imgUploadBtn.addEventListener("click", () => {
      imgUpload.value = ""; // Clear previous selection
      imgUpload.click();
  });
  
  imgUpload.addEventListener("change", () => {
    const file = imgUpload.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const key = Date.now().toString();
      // Store in Realtime DB (Base64)
      set(ref(db, "messages/" + key), {
        sender, msg: reader.result, type: "image", time: new Date().toLocaleString(), seen: false
      });
    };
    reader.readAsDataURL(file);
  });

  // Reply Cancel
  cancelReply.addEventListener("click", () => {
    replyTo = null;
    replyContext.style.display = "none";
  });

  // Audio Recording
  startRec.addEventListener("click", () => {
      startRecording();
      startRec.style.display = "none";
      stopRec.style.display = "flex";
  });
  stopRec.addEventListener("click", () => {
      stopRecording();
      stopRec.style.display = "none";
      startRec.style.display = "flex";
  });

  // Reaction Selection
  reactionEmojis.forEach(emojiEl => {
      emojiEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (currentMessageKey) {
              sendReaction(currentMessageKey, emojiEl.getAttribute("data-reaction"));
              reactionPopup.style.display = "none";
          }
      });
  });

  // Long Press Logic (Mobile & Desktop)
  messagesDiv.addEventListener("mousedown", handleLongPressStart);
  messagesDiv.addEventListener("touchstart", handleLongPressStart, {passive: true});
  messagesDiv.addEventListener("mouseup", handleLongPressEnd);
  messagesDiv.addEventListener("touchend", handleLongPressEnd);
  messagesDiv.addEventListener("mousemove", handleLongPressEnd);
  messagesDiv.addEventListener("touchmove", handleLongPressEnd);

  function handleLongPressStart(e) {
      const bubble = e.target.closest(".me, .notMe");
      if (!bubble) return;
      if (e.target.tagName === "BUTTON" || e.target.closest(".reaction-container")) return; 

      messageTarget = bubble;
      clearTimeout(pressTimer);
      
      pressTimer = setTimeout(() => {
          currentMessageKey = messageTarget.closest(".outer").id; 
          
          // Position popup near the message
          const rect = messageTarget.getBoundingClientRect();
          let topPos = rect.top - 60;
          if (topPos < 60) topPos = rect.bottom + 10; // If too high, show below

          reactionPopup.style.top = topPos + "px";
          reactionPopup.style.left = "50%"; // Center horizontally or calculate based on bubble
          reactionPopup.style.transform = "translateX(-50%)";
          
          reactionPopup.style.display = "flex"; 
      }, 500); 
  }

  function handleLongPressEnd() {
      clearTimeout(pressTimer);
  }
}

function sendReaction(messageKey, emoji) {
    if (!sender) return;
    const reactionRef = ref(db, "reactions/" + messageKey + "/" + sender);
    get(reactionRef).then(snap => {
        if (snap.exists() && snap.val().emoji === emoji) {
            remove(reactionRef); // Remove if same emoji
        } else {
            set(reactionRef, { emoji: emoji, user: sender });
        }
    });
}

// Mark as seen logic
function markMessageAsSeen(key, data) {
    if (data.sender !== sender && !data.seen) {
        update(ref(db, "messages/" + key), { seen: true });
    }
}

function linkify(text) {
    if (!text) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const ytMatch = url.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            return `<iframe class="yt-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe>`;
        }
        return `<a href="${url}" target="_blank" class="link-card">
                    <span class="material-icons-round link-icon">link</span>
                    <span class="link-text">
                        <span class="link-title">Link Preview</span>
                        <span class="link-url">${url}</span>
                    </span>
                </a>`;
    });
}

// Render Messages
function renderMessageAppend(key, data) {
  if (document.getElementById(key)) return;
  markMessageAsSeen(key, data);

  const isMe = data.sender === sender;
  const container = document.createElement("div");
  container.className = "outer";
  container.id = key;
  
  const inner = document.createElement("div");
  inner.className = isMe ? "me" : "notMe";
  
  // Reply Display
  if (data.replyTo) {
    const r = document.createElement("div");
    r.style.fontSize = "0.8em";
    r.style.opacity = "0.7";
    r.style.borderLeft = "2px solid currentColor";
    r.style.paddingLeft = "5px";
    r.style.marginBottom = "5px";
    r.textContent = "Replying to: " + data.replyTo;
    inner.appendChild(r);
  }

  // Sender Name
  const name = document.createElement("div");
  name.style.fontSize = "0.75em";
  name.style.fontWeight = "bold";
  name.style.marginBottom = "2px";
  name.style.color = isMe ? "rgba(255,255,255,0.9)" : "var(--accent-color)";
  name.innerHTML = isMe ? "You" : data.sender;
  inner.appendChild(name);

  // Content
  if (data.type === "image") {
    const img = document.createElement("img");
    img.src = data.msg;
    img.className = "imageMsg";
    // Lightbox Logic
    img.onclick = () => { 
        lightboxImg.src = data.msg;
        chatImageLightbox.style.display = "flex";
    };
    inner.appendChild(img);
  } else if (data.type === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = data.msg;
    inner.appendChild(audio);
  } else {
    const msgdiv = document.createElement("div");
    msgdiv.innerHTML = linkify(data.msg);
    inner.appendChild(msgdiv);
  }

  // Time & Seen
  const tdiv = document.createElement("div");
  tdiv.className = "time";
  let seenHtml = "";
  if (isMe) {
      const colorClass = data.seen ? "seen" : "";
      const icon = data.seen ? "done_all" : "check";
      seenHtml = `<span class="material-icons-round seen-status ${colorClass}" id="seen-${key}">${icon}</span>`;
  }
  const timeStr = data.time || "";
  tdiv.innerHTML = timeStr + seenHtml;
  inner.appendChild(tdiv);

  // Actions (Reply/Delete)
  const actionsDiv = document.createElement("div");
  actionsDiv.style.marginTop = "5px";
  actionsDiv.style.display = "flex";
  actionsDiv.style.gap = "10px";
  actionsDiv.style.opacity = "0.5";
  
  const repBtn = document.createElement("span");
  repBtn.className = "material-icons-round";
  repBtn.style.fontSize = "16px"; repBtn.style.cursor="pointer";
  repBtn.textContent = "reply";
  repBtn.onclick = () => {
      replyTo = data.msg;
      replyMsg.innerText = data.msg.length > 50 ? data.msg.slice(0,50)+"..." : data.msg;
      replyContext.style.display = "flex";
  };
  actionsDiv.appendChild(repBtn);

  if (isMe) {
      const delBtn = document.createElement("span");
      delBtn.className = "material-icons-round";
      delBtn.style.fontSize = "16px"; delBtn.style.cursor="pointer";
      delBtn.textContent = "delete";
      delBtn.onclick = () => {
          if (confirm("Delete?")) remove(ref(db, "messages/" + key));
      };
      actionsDiv.appendChild(delBtn);
  }
  inner.appendChild(actionsDiv);

  container.appendChild(inner);
  messagesDiv.appendChild(container);

  // Monitor Reactions for this message
  const reactionDisplayRef = ref(db, "reactions/" + key);
  onValue(reactionDisplayRef, (snap) => {
      const reactions = snap.val() || {};
      const reactionKeys = Object.keys(reactions);
      
      let existingReaction = inner.querySelector(".reaction-container");
      if (existingReaction) existingReaction.remove();

      if (reactionKeys.length > 0) {
          const emojiCounts = reactionKeys.reduce((acc, user) => {
              const emoji = reactions[user].emoji;
              acc[emoji] = (acc[emoji] || 0) + 1;
              return acc;
          }, {});
          
          let topEmoji = null;
          let maxCount = 0;
          for (const emoji in emojiCounts) {
              if (emojiCounts[emoji] > maxCount) {
                  maxCount = emojiCounts[emoji];
                  topEmoji = emoji;
              }
          }
          if (topEmoji) {
              const reactionContainer = document.createElement("div");
              reactionContainer.className = "reaction-container";
              reactionContainer.innerHTML = `${topEmoji} <span style="margin-left:4px;">${reactionKeys.length > 1 ? reactionKeys.length : ''}</span>`;
              // Click reaction to see who reacted
              reactionContainer.onclick = (e) => {
                  e.stopPropagation();
                  let info = "";
                  reactionKeys.forEach(k => info += `${k}: ${reactions[k].emoji}\n`);
                  alert("Reactions:\n" + info);
              };
              inner.appendChild(reactionContainer);
          }
      }
  });
}

// Load Messages
async function loadInitialMessages() {
  const q = query(ref(db, "messages"), orderByKey(), limitToLast(20));
  const snap = await get(q);
  let arr = [];
  snap.forEach(child => arr.push({ key: child.key, val: child.val() }));
  
  if (arr.length > 0) {
    oldestKey = arr[0].key;
    arr.forEach(item => renderMessageAppend(item.key, item.val));
    setTimeout(() => {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
  }

  const messagesRef = ref(db, "messages");
  onChildAdded(messagesRef, (child) => {
    renderMessageAppend(child.key, child.val());
    setTimeout(() => {
        messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    }, 100);
  });

  onChildChanged(messagesRef, (child) => {
      const key = child.key;
      const data = child.val();
      if (data.sender === sender) {
          const seenSpan = document.getElementById(`seen-${key}`);
          if (seenSpan && data.seen) {
              seenSpan.textContent = "done_all"; 
              seenSpan.classList.add("seen");
          }
      }
  });

  onChildRemoved(messagesRef, (child) => {
    const el = document.getElementById(child.key);
    if (el) el.remove();
  });
}

// Recording Logic
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let options = { mimeType: "audio/webm;codecs=opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "audio/mp4" }; 
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: options.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const key = Date.now().toString();
        set(ref(db, "messages/" + key), {
          sender, msg: reader.result, type: "audio", time: new Date().toLocaleString(), seen: false
        });
        set(onlineRef, { name: sender, isTyping: false, isRecording: false });
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    set(onlineRef, { name: sender, isTyping: false, isRecording: true });
  } catch (err) {
    alert("Mic Error: " + err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

// UI Handlers
imageBubble.addEventListener("click", () => { imagePopup.style.display = "block"; });
imagePopupClose.addEventListener("click", () => { imagePopup.style.display = "none"; });

lightboxClose.addEventListener("click", () => { chatImageLightbox.style.display = "none"; });
chatImageLightbox.addEventListener("click", (e) => {
    if(e.target === chatImageLightbox) chatImageLightbox.style.display = "none";
});

loveBubble.addEventListener("click", () => { emojiPopup.style.display = "block"; });
lastSeenBubble.addEventListener("click", async () => {
    lastSeenPopup.style.display = "block";
    const snap = await get(ref(db, "lastSeen"));
    const val = snap.val() || {};
    if (Object.keys(val).length === 0) {
      lastSeenList.innerHTML = "<p>No data.</p>";
      return;
    }
    let keys = Object.keys(val).sort((a,b)=> a.localeCompare(b));
    let html = "<ul style='list-style:none;padding:0;'>";
    keys.forEach(u => {
      html += `<li style='padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);'><b>${u}</b><br><small style='opacity:0.6'>${val[u]}</small></li>`;
    });
    html += "</ul>";
    lastSeenList.innerHTML = html;
});

// Emoji Rain
const emojis = ["❤️‍🩹","🥹","🥺","🥰","😘","🤤","😡","😚","😙","😂","🩷","❤️","🙂","🙄","😒","🫩","💔","🤨","😑","🙃","😌","🩵","💙","💚","💛","🧡"];
const emojiRainRef = ref(db, "emojiRain");
function renderEmojiList(state) {
  emojiListContainer.innerHTML = "";
  emojis.forEach(e => {
    const row = document.createElement("div");
    row.className = "emojiRow"; 
    const span = document.createElement("span");
    span.textContent = e;
    const btn = document.createElement("button");
    btn.className = "emojiBtn";
    const isOn = state[e] === true;
    btn.textContent = isOn ? "ON" : "OFF";
    btn.style.background = isOn ? "#28a745" : "#555";
    btn.addEventListener("click", () => {
      set(ref(db, "emojiRain/" + e), !isOn);
    });
    row.appendChild(span);
    row.appendChild(btn);
    emojiListContainer.appendChild(row);
  });
}
onValue(emojiRainRef, snap => {
  const val = snap.val() || {};
  renderEmojiList(val);
  updateEmojiRain(val);
});
let activeEmojis = {};
function updateEmojiRain(state) {
  activeEmojis = {};
  for (let e of Object.keys(state)) { if (state[e]) activeEmojis[e] = true; }
  startEmojiRain();
}
let rainInterval;
function startEmojiRain() {
  clearInterval(rainInterval);
  emojiRainContainer.innerHTML = "";
  const allActive = Object.keys(activeEmojis);
  if (allActive.length === 0) return;
  rainInterval = setInterval(() => {
    const e = allActive[Math.floor(Math.random() * allActive.length)];
    const span = document.createElement("div");
    span.className = "emojiDrop";
    span.textContent = e;
    span.style.left = Math.random() * 100 + "vw";
    span.style.fontSize = (20 + Math.random() * 20) + "px";
    span.style.animationDuration = (3 + Math.random() * 4) + "s";
    emojiRainContainer.appendChild(span);
    setTimeout(() => { span.remove(); }, 4000);
  }, 300);
}

// ⭐ UPDATED THEMES LIST (Includes all old themes)
const themes = [
    { name: "Dark (Default)", id: "dark", colors: { "--bg-color": "#0f172a", "--text-color": "#f1f5f9", "--header-bg": "rgba(30, 41, 59, 0.95)", "--me-bubble-bg": "#3b82f6", "--not-me-bubble-bg": "#334155", "--input-bg-color": "#1e293b", "--input-text-color": "#fff", "--accent-color": "#3b82f6", "--me-text-color": "#ffffff", "--not-me-text-color": "#f1f5f9" } },
    { name: "Lovely ❤️", id: "lovely", colors: { "--bg-color": "#ffe8f2", "--text-color": "#333", "--header-bg": "#b36daa", "--me-bubble-bg": "#ff69b4", "--not-me-bubble-bg": "#f0f0f0", "--input-bg-color": "#fff", "--input-text-color": "#333", "--accent-color": "#ff69b4", "--me-text-color": "#fff", "--not-me-text-color": "#333" } },
    { name: "Sky ☁️", id: "sky", colors: { "--bg-color": "#e0f7fa", "--text-color": "#004d40", "--header-bg": "#1a91bd", "--me-bubble-bg": "#03a9f4", "--not-me-bubble-bg": "#cfd8dc", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#03a9f4", "--me-text-color": "#fff", "--not-me-text-color": "#004d40" } },
    { name: "Forest 🌳", id: "forest", colors: { "--bg-color": "#2e7d32", "--text-color": "#e8f5e9", "--header-bg": "#3e9c75", "--me-bubble-bg": "#aed581", "--not-me-bubble-bg": "#388e3c", "--input-bg-color": "#e8f5e9", "--input-text-color": "#000", "--accent-color": "#aed581", "--me-text-color": "#000", "--not-me-text-color": "#e8f5e9" } },
    { name: "WhatsApp 🟢", id: "whatsapp", colors: { "--bg-color": "#ece5dd", "--text-color": "#111", "--header-bg": "#008069", "--me-bubble-bg": "#dcf8c6", "--me-text-color": "#000", "--not-me-bubble-bg": "#fff", "--not-me-text-color": "#000", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#008069" } },
    { name: "Neon 🎆", id: "neon", colors: { "--bg-color": "#0d0128", "--text-color": "#00ffff", "--header-bg": "#8a2be2", "--me-bubble-bg": "#ff1493", "--not-me-bubble-bg": "#8a2be2", "--input-bg-color": "#220a46", "--input-text-color": "#00ffff", "--accent-color": "#ff1493", "--me-text-color": "#fff", "--not-me-text-color": "#00ffff" } },
    { name: "Gold ✨", id: "gold", colors: { "--bg-color": "#fff8e1", "--text-color": "#333", "--header-bg": "#aba72c", "--me-bubble-bg": "#ffc107", "--not-me-bubble-bg": "#f5f5f5", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#ffc107", "--me-text-color": "#000", "--not-me-text-color": "#333" } },
    { name: "Ocean 🌊", id: "ocean", colors: { "--bg-color": "#e3f2fd", "--text-color": "#1565c0", "--header-bg": "#0284c7", "--me-bubble-bg": "#2196f3", "--not-me-bubble-bg": "#bbdefb", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#2196f3", "--me-text-color": "#fff", "--not-me-text-color": "#1565c0" } },
    { name: "Monochrome ⚫⚪", id: "mono", colors: { "--bg-color": "#f0f0f0", "--text-color": "#333", "--header-bg": "#555", "--me-bubble-bg": "#555", "--not-me-bubble-bg": "#fff", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#333", "--me-text-color": "#fff", "--not-me-text-color": "#333" } },
    { name: "Telegram 🟦", id: "telegram", colors: { "--bg-color": "#f5f5f5", "--text-color": "#000", "--header-bg": "#50a7e5", "--me-bubble-bg": "#dcf8c6", "--not-me-bubble-bg": "#fff", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#50a7e5", "--me-text-color": "#000", "--not-me-text-color": "#000" } },
    { name: "iMessage 🍏", id: "imessage", colors: { "--bg-color": "#f9f9f9", "--text-color": "#000", "--header-bg": "#fff", "--me-bubble-bg": "#59cf3c", "--not-me-bubble-bg": "#e5e5ea", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#59cf3c", "--me-text-color": "#fff", "--not-me-text-color": "#000" } },
    { name: "Synthwave 💜", id: "synthwave", colors: { "--bg-color": "#1a003a", "--text-color": "#f0f0ff", "--header-bg": "#5000a6", "--me-bubble-bg": "#ff0099", "--not-me-bubble-bg": "#00ffff", "--input-bg-color": "#3a0050", "--input-text-color": "#00ffff", "--accent-color": "#ff0099", "--me-text-color": "#fff", "--not-me-text-color": "#1a003a" } },
    { name: "Cozy Coffee 🤎", id: "coffee", colors: { "--bg-color": "#e0d9c4", "--text-color": "#3e2723", "--header-bg": "#795548", "--me-bubble-bg": "#bcaaa4", "--not-me-bubble-bg": "#f5f5f5", "--input-bg-color": "#fff", "--input-text-color": "#3e2723", "--accent-color": "#8d6e63", "--me-text-color": "#fff", "--not-me-text-color": "#3e2723" } },
    { name: "Modern Green 🥝", id: "flatgreen", colors: { "--bg-color": "#f1f8e9", "--text-color": "#2e7d32", "--header-bg": "#4caf50", "--me-bubble-bg": "#8bc34a", "--not-me-bubble-bg": "#fff", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#4caf50", "--me-text-color": "#fff", "--not-me-text-color": "#2e7d32" } },
    { name: "Retro Wave 📼", id: "retro", colors: { "--bg-color": "#23114a", "--text-color": "#ff00ff", "--header-bg": "#4b0082", "--me-bubble-bg": "#00ffff", "--not-me-bubble-bg": "#9932cc", "--input-bg-color": "#1a0833", "--input-text-color": "#00ffff", "--accent-color": "#ff00ff", "--me-text-color": "#000", "--not-me-text-color": "#fff" } },
    { name: "Midnight Forest 🌙", id: "forestnight", colors: { "--bg-color": "#011f26", "--text-color": "#c4c7c7", "--header-bg": "#004d40", "--me-bubble-bg": "#4a7c59", "--not-me-bubble-bg": "#002b36", "--input-bg-color": "#f5f5f5", "--input-text-color": "#000", "--accent-color": "#aed581", "--me-text-color": "#fff", "--not-me-text-color": "#c4c7c7" } },
    { name: "Sunset Glow 🌅", id: "sunset", colors: { "--bg-color": "#fff0f0", "--text-color": "#5c1818", "--header-bg": "#ff7043", "--me-bubble-bg": "#ffb74d", "--not-me-bubble-bg": "#ffebef", "--input-bg-color": "#fff", "--input-text-color": "#000", "--accent-color": "#f4511e", "--me-text-color": "#fff", "--not-me-text-color": "#5c1818" } },
    { name: "Hacker Mode 🟢", id: "hacker", colors: { "--bg-color": "#000000", "--text-color": "#00ff00", "--header-bg": "#111111", "--me-bubble-bg": "#006400", "--not-me-bubble-bg": "#333333", "--input-bg-color": "#222222", "--input-text-color": "#00ff00", "--accent-color": "#00ff00", "--me-text-color": "#00ff00", "--not-me-text-color": "#00aa00" } },
    { name: "Royal Blue 💎", id: "royal", colors: { "--bg-color": "#f0f4f8", "--text-color": "#1a3b58", "--header-bg": "#2a628f", "--me-bubble-bg": "#5b92e5", "--not-me-bubble-bg": "#e3eaf2", "--input-bg-color": "#ffffff", "--input-text-color": "#000", "--accent-color": "#5b92e5", "--me-text-color": "#fff", "--not-me-text-color": "#1a3b58" } },
    { name: "Pumpkin Spice 🎃", id: "pumpkin", colors: { "--bg-color": "#fcf5e9", "--text-color": "#4e342e", "--header-bg": "#d88b49", "--me-bubble-bg": "#ff7043", "--not-me-bubble-bg": "#efebe9", "--input-bg-color": "#ffffff", "--input-text-color": "#000", "--accent-color": "#ff7043", "--me-text-color": "#fff", "--not-me-text-color": "#a1887f" } },
    { name: "Pastel Dream 🍦", id: "pastel", colors: { "--bg-color": "#f7fcfb", "--text-color": "#4a4a4a", "--header-bg": "#c8e6c9", "--me-bubble-bg": "#ffcdd2", "--not-me-bubble-bg": "#e1f5fe", "--input-bg-color": "#ffffff", "--input-text-color": "#000", "--accent-color": "#ffcdd2", "--me-text-color": "#4a4a4a", "--not-me-text-color": "#4a4a4a" } },
    { name: "Deep Space 🚀", id: "space", colors: { "--bg-color": "#0a0a1a", "--text-color": "#bbdefb", "--header-bg": "#1c2c5c", "--me-bubble-bg": "#e91e63", "--not-me-bubble-bg": "#3f51b5", "--input-bg-color": "#111122", "--input-text-color": "#bbdefb", "--accent-color": "#e91e63", "--me-text-color": "#fff", "--not-me-text-color": "#fff" } },
    { name: "Desert Sand 🌵", id: "desert", colors: { "--bg-color": "#fafafa", "--text-color": "#4e4540", "--header-bg": "#d4a373", "--me-bubble-bg": "#f9e0bb", "--not-me-bubble-bg": "#e9ecef", "--input-bg-color": "#ffffff", "--input-text-color": "#000", "--accent-color": "#a8a29e", "--me-text-color": "#000", "--not-me-text-color": "#8e8d8d" } },
    { name: "Cyberpunk 🟨", id: "cyberpunk", colors: { "--bg-color": "#0f0f0f", "--text-color": "#fcee0a", "--header-bg": "#333", "--me-bubble-bg": "#fcee0a", "--me-text-color": "#000", "--not-me-bubble-bg": "#222", "--not-me-text-color": "#fcee0a", "--input-bg-color": "#000", "--input-text-color": "#fcee0a", "--accent-color": "#fcee0a" } },
    { name: "Rose Gold 🪙", id: "rosegold", colors: { "--bg-color": "#1a1a1a", "--text-color": "#e0bfb8", "--header-bg": "#b76e79", "--me-bubble-bg": "#b76e79", "--me-text-color": "#fff", "--not-me-bubble-bg": "#333", "--not-me-text-color": "#e0bfb8", "--accent-color": "#b76e79" } },
    { name: "Dracula 🧛", id: "dracula", colors: { "--bg-color": "#282a36", "--text-color": "#f8f8f2", "--header-bg": "#44475a", "--me-bubble-bg": "#bd93f9", "--me-text-color": "#282a36", "--not-me-bubble-bg": "#6272a4", "--not-me-text-color": "#f8f8f2", "--accent-color": "#ff79c6" } },
    { name: "Mint Choco 🍫", id: "mintchoco", colors: { "--bg-color": "#3b2f2f", "--text-color": "#98ff98", "--header-bg": "#5d4037", "--me-bubble-bg": "#00c853", "--me-text-color": "#fff", "--not-me-bubble-bg": "#4e342e", "--not-me-text-color": "#b2dfdb", "--input-bg-color": "#3e2723", "--input-text-color": "#98ff98", "--accent-color": "#00c853" } },
    { name: "Bumblebee 🐝", id: "bumblebee", colors: { "--bg-color": "#fff176", "--text-color": "#212121", "--header-bg": "#fbc02d", "--me-bubble-bg": "#ffeb3b", "--me-text-color": "#212121", "--not-me-bubble-bg": "#fff", "--not-me-text-color": "#212121", "--input-bg-color": "#fffde7", "--input-text-color": "#000", "--accent-color": "#212121" } }
];

const defaultTheme = themes[0];
const themeRef = ref(db, "theme/currentThemeId");

themeBubble.addEventListener("click", () => {
    themePopup.style.display = "block";
});

function renderThemeList(activeThemeId) {
    colorThemeList.innerHTML = "";
    themes.forEach(theme => {
        const row = document.createElement("div");
        row.className = "colorThemeRow";
        const nameText = document.createElement("span");
        nameText.textContent = theme.name;
        const btn = document.createElement("button");
        btn.className = "themeToggleBtn";
        const isActive = activeThemeId === theme.id;
        btn.textContent = isActive ? "ACTIVE" : "APPLY";
        btn.style.background = isActive ? "var(--accent-color)" : "#555";
        
        btn.addEventListener("click", () => {
            set(themeRef, theme.id); 
            themePopup.style.display = "none";
        });
        row.appendChild(nameText);
        row.appendChild(btn);
        colorThemeList.appendChild(row);
    });
}

function applyTheme(theme) {
    if (!theme) theme = defaultTheme;
    for (const [key, value] of Object.entries(theme.colors)) {
        root.style.setProperty(key, value);
    }
}

onValue(themeRef, snap => {
    const activeThemeId = snap.val() || defaultTheme.id; 
    const activeTheme = themes.find(t => t.id === activeThemeId) || defaultTheme;
    applyTheme(activeTheme);
    renderThemeList(activeThemeId);
});

// Magic Effects & Fonts
const magicBubble = document.getElementById("magicBubble");
const magicPopup = document.getElementById("magicPopup");
const magicList = document.getElementById("magicList");
const fontBubble = document.getElementById("fontBubble");
const fontPopup = document.getElementById("fontPopup");
const fontList = document.getElementById("fontList");
const magicRef = ref(db, "globalEffects");
const fontRef = ref(db, "globalFonts/activeFontId");

// Magic Effects List (RESTORED)
const magicEffects = [
    { id: "snow", name: "Snowfall ❄️", func: toggleSnow },
    { id: "fireflies", name: "Fireflies 🧚", func: toggleFireflies },
    { id: "confetti", name: "Confetti 🎉", func: toggleConfetti },
    { id: "sakura", name: "Sakura 🌸", func: toggleSakura },
    { id: "bubbles", name: "Bubbles 🫧", func: toggleBubbles },
    { id: "gold", name: "Gold Dust ✨", func: toggleGoldDust },
    { id: "matrix", name: "Matrix 💻", func: toggleMatrix },
    { id: "hearts", name: "Love ❤️", func: toggleHearts },
    { id: "balloons", name: "Balloons 🎈", func: toggleBalloons },
    { id: "stars", name: "Starry Night ⭐", func: toggleStars }, 
    { id: "ghost", name: "Ghost Trail 👻", func: toggleGhost },
    { id: "sparks", name: "Sparkles ⚡", func: toggleSparks },
    { id: "romance", name: "I Love You 💕", func: toggleRomance },
    { id: "music", name: "Music 🎵", func: toggleMusic },
    { id: "rain", name: "Rain 🌧️", func: toggleRain },
    { id: "lightning", name: "Thunder ⚡", func: toggleLightning },
    { id: "fireworks", name: "Fireworks 🎆", func: toggleFireworks },
    { id: "lanterns", name: "Lanterns 🏮", func: toggleLanterns },
    { id: "ufos", name: "Aliens 🛸", func: toggleUfos }
];

magicBubble.addEventListener("click", () => {
    magicPopup.style.display = "block";
});
fontBubble.addEventListener("click", () => {
    fontPopup.style.display = "block";
});

function startMagicEffects() {
    onValue(magicRef, (snap) => {
        const activeEffects = snap.val() || {};
        renderMagicList(activeEffects);
        magicEffects.forEach(effect => {
            const isActive = activeEffects[effect.id] === true;
            effect.func(isActive);
        });
    });
}

function renderMagicList(activeEffects) {
    magicList.innerHTML = "";
    magicEffects.forEach(effect => {
        const row = document.createElement("div");
        row.className = "magicRow";
        const label = document.createElement("span");
        label.textContent = effect.name;
        const btn = document.createElement("button");
        btn.className = "magicToggleBtn";
        const isOn = activeEffects[effect.id] === true;
        btn.textContent = isOn ? "ON" : "OFF";
        btn.style.background = isOn ? "#28a745" : "#555";
        btn.addEventListener("click", () => {
            set(ref(db, "globalEffects/" + effect.id), !isOn);
        });
        row.appendChild(label);
        row.appendChild(btn);
        magicList.appendChild(row);
    });
}

// Fonts List (RESTORED)
const availableFonts = [
    { id: "default", name: "Roboto (Default)", css: "'Roboto', sans-serif" },
    { id: "pacifico", name: "Pacifico", css: "'Pacifico', cursive" },
    { id: "dancing", name: "Dancing Script", css: "'Dancing Script', cursive" },
    { id: "oswald", name: "Oswald", css: "'Oswald', sans-serif" },
    { id: "merriweather", name: "Merriweather", css: "'Merriweather', serif" },
    { id: "indie", name: "Indie Flower", css: "'Indie Flower', cursive" },
    { id: "bungee", name: "Bungee", css: "'Bungee', cursive" },
    { id: "lato", name: "Lato", css: "'Lato', sans-serif" },
    { id: "cinzel", name: "Cinzel", css: "'Cinzel', serif" },
    { id: "monospace", name: "Monospace", css: "monospace" }
];

function startFontChanger() {
    onValue(fontRef, snap => {
        const activeFontId = snap.val() || "default";
        const font = availableFonts.find(f => f.id === activeFontId) || availableFonts[0];
        root.style.setProperty("--chat-font-family", font.css);
        
        fontList.innerHTML = "";
        availableFonts.forEach(f => {
            const row = document.createElement("div");
            row.className = "fontRow";
            row.innerHTML = `<span style="font-family:${f.css}">${f.name}</span>`;
            const btn = document.createElement("button");
            btn.className = "fontToggleBtn";
            btn.textContent = activeFontId === f.id ? "ACTIVE" : "SELECT";
            btn.style.background = activeFontId === f.id ? "var(--accent-color)" : "#555";
            btn.onclick = () => { set(fontRef, f.id); fontPopup.style.display="none"; };
            row.appendChild(btn);
            fontList.appendChild(row);
        });
    });
}

/* =========================================
   ANIMATION FUNCTIONS (RESTORED FROM OLD)
   ========================================= */

const snowContainer = document.getElementById("snowContainer");
const fireflyContainer = document.getElementById("fireflyContainer");
const confettiContainer = document.getElementById("confettiContainer");
const sakuraContainer = document.getElementById("sakuraContainer");
const bubbleContainer = document.getElementById("bubbleContainer");
const goldDustContainer = document.getElementById("goldDustContainer");
const matrixContainer = document.getElementById("matrixContainer");
const heartContainer = document.getElementById("heartContainer");
const balloonContainer = document.getElementById("balloonContainer");
const sparkleContainer = document.getElementById("sparkleContainer");
const romanceContainer = document.getElementById("romanceContainer");
const musicContainer = document.getElementById("musicContainer");
const rainContainer = document.getElementById("rainContainer");
const lightningFlash = document.getElementById("lightningFlash");
const lightningCanvas = document.getElementById("lightningCanvas");
const fireworksCanvas = document.getElementById("fireworksCanvas");
const lanternContainer = document.getElementById("lanternContainer");
const ufoContainer = document.getElementById("ufoContainer");

function resizeCanvas() {
    if(lightningCanvas) { lightningCanvas.width = window.innerWidth; lightningCanvas.height = window.innerHeight; }
    if(fireworksCanvas) { fireworksCanvas.width = window.innerWidth; fireworksCanvas.height = window.innerHeight; }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let snowInterval;
function toggleSnow(enable) {
    if (!enable) { clearInterval(snowInterval); if(snowContainer) snowContainer.innerHTML = ""; return; }
    if (snowContainer && snowContainer.childElementCount > 0) return; 
    snowInterval = setInterval(() => {
        if(!snowContainer) return;
        const d = document.createElement("div"); d.className = "snowflake"; d.textContent = "❄";
        d.style.left = Math.random() * 100 + "vw"; d.style.fontSize = (10+Math.random()*20)+"px";
        d.style.animationDuration = (5+Math.random()*5)+"s";
        snowContainer.appendChild(d); setTimeout(() => d.remove(), 10000);
    }, 200);
}
let fireflyInterval;
function toggleFireflies(enable) {
    if (!enable) { clearInterval(fireflyInterval); if(fireflyContainer) fireflyContainer.innerHTML = ""; return; }
    if (fireflyContainer && fireflyContainer.childElementCount > 0) return;
    fireflyInterval = setInterval(() => {
        if(!fireflyContainer) return;
        const d = document.createElement("div"); d.className = "firefly";
        d.style.left = Math.random()*100+"vw"; d.style.top = Math.random()*100+"vh";
        d.animate([{opacity:0},{opacity:1,offset:0.5},{transform:`translate(${(Math.random()-0.5)*200}px, ${(Math.random()-0.5)*200}px)`,opacity:0}], {duration:6000}).onfinish=()=>d.remove();
        fireflyContainer.appendChild(d);
    }, 300);
}
let confettiInterval;
function toggleConfetti(enable) {
    if (!enable) { clearInterval(confettiInterval); if(confettiContainer) confettiContainer.innerHTML = ""; return; }
    if (confettiContainer && confettiContainer.childElementCount > 0) return;
    const colors = ['#f00','#0f0','#00f','#ff0','#0ff','#f0f'];
    confettiInterval = setInterval(() => {
        if(!confettiContainer) return;
        const d = document.createElement("div"); d.className = "confetti-piece";
        d.style.left = Math.random()*100+"vw"; d.style.background = colors[Math.floor(Math.random()*6)];
        d.style.animationDuration = (3+Math.random()*2)+"s";
        confettiContainer.appendChild(d); setTimeout(() => d.remove(), 5000);
    }, 100);
}
let sakuraInterval;
function toggleSakura(enable) {
    if (!enable) { clearInterval(sakuraInterval); if(sakuraContainer) sakuraContainer.innerHTML = ""; return; }
    if (sakuraContainer && sakuraContainer.childElementCount > 0) return;
    sakuraInterval = setInterval(() => {
        if(!sakuraContainer) return;
        const d = document.createElement("div"); d.className = "sakura-petal";
        d.style.left = Math.random()*100+"vw"; d.style.width = d.style.height = (10+Math.random()*10)+"px";
        d.style.animationDuration = (4+Math.random()*4)+"s";
        sakuraContainer.appendChild(d); setTimeout(() => d.remove(), 8000);
    }, 300);
}
let bubbleInterval;
function toggleBubbles(enable) {
    if (!enable) { clearInterval(bubbleInterval); if(bubbleContainer) bubbleContainer.innerHTML = ""; return; }
    if (bubbleContainer && bubbleContainer.childElementCount > 0) return;
    bubbleInterval = setInterval(() => {
        if(!bubbleContainer) return;
        const d = document.createElement("div"); d.className = "soap-bubble";
        d.style.left = Math.random()*100+"vw"; d.style.width = d.style.height = (15+Math.random()*25)+"px";
        d.style.animationDuration = (6+Math.random()*5)+"s";
        bubbleContainer.appendChild(d); setTimeout(() => d.remove(), 11000);
    }, 400);
}
let goldInterval;
function toggleGoldDust(enable) {
    if (!enable) { clearInterval(goldInterval); if(goldDustContainer) goldDustContainer.innerHTML = ""; return; }
    if (goldDustContainer && goldDustContainer.childElementCount > 0) return;
    goldInterval = setInterval(() => {
        if(!goldDustContainer) return;
        const d = document.createElement("div"); d.className = "gold-particle";
        d.style.left = Math.random()*100+"vw"; d.style.top = Math.random()*100+"vh";
        d.style.animationDuration = (3+Math.random()*3)+"s";
        goldDustContainer.appendChild(d); setTimeout(() => d.remove(), 6000);
    }, 100);
}
let matrixInterval;
function toggleMatrix(enable) {
    if (!enable) { clearInterval(matrixInterval); if(matrixContainer) matrixContainer.innerHTML = ""; return; }
    if (matrixContainer && matrixContainer.childElementCount > 0) return;
    matrixInterval = setInterval(() => {
        if(!matrixContainer) return;
        const d = document.createElement("div"); d.className = "matrix-stream";
        d.textContent = Math.random().toString(36).substring(2, 10); 
        d.style.left = Math.random()*100+"vw"; 
        d.style.fontSize = (12+Math.random()*8)+"px";
        d.style.animationDuration = (2+Math.random()*3)+"s";
        matrixContainer.appendChild(d); setTimeout(() => d.remove(), 5000);
    }, 150);
}
let heartInterval;
function toggleHearts(enable) {
    if (!enable) { clearInterval(heartInterval); if(heartContainer) heartContainer.innerHTML = ""; return; }
    if (heartContainer && heartContainer.childElementCount > 0) return;
    heartInterval = setInterval(() => {
        if(!heartContainer) return;
        const d = document.createElement("div"); d.className = "float-heart";
        d.textContent = ["❤️", "💖", "💜", "💕", "😍"][Math.floor(Math.random()*5)];
        d.style.left = Math.random()*100+"vw"; 
        d.style.animationDuration = (4+Math.random()*3)+"s";
        heartContainer.appendChild(d); setTimeout(() => d.remove(), 7000);
    }, 400);
}
let balloonInterval;
function toggleBalloons(enable) {
    if (!enable) { clearInterval(balloonInterval); if(balloonContainer) balloonContainer.innerHTML = ""; return; }
    if (balloonContainer && balloonContainer.childElementCount > 0) return;
    const bColors = ["#ff4d4d", "#4d79ff", "#4dff88", "#ffff4d", "#ff4dff"];
    balloonInterval = setInterval(() => {
        if(!balloonContainer) return;
        const d = document.createElement("div"); d.className = "balloon-anim";
        d.style.left = Math.random()*100+"vw"; 
        d.style.background = bColors[Math.floor(Math.random()*bColors.length)];
        d.style.animationDuration = (6+Math.random()*4)+"s";
        balloonContainer.appendChild(d); setTimeout(() => d.remove(), 10000);
    }, 600);
}
let starInterval;
function toggleStars(enable) {
    if (!enable) { clearInterval(starInterval); if(snowContainer) snowContainer.innerHTML = ""; return; }
    starInterval = setInterval(() => {
        if(!snowContainer) return;
        const d = document.createElement("div"); d.className = "star-twinkle";
        d.style.left = Math.random() * 100 + "vw"; d.style.top = Math.random() * 100 + "vh";
        snowContainer.appendChild(d); setTimeout(() => d.remove(), 6000); 
    }, 300); 
}
let ghostInterval;
function toggleGhost(enable) {
    if (!enable) { clearInterval(ghostInterval); if(bubbleContainer) bubbleContainer.innerHTML = ""; return; }
    ghostInterval = setInterval(() => {
        if(!bubbleContainer) return;
        const d = document.createElement("div"); d.className = "ghost-orb";
        d.style.left = Math.random() * 100 + "vw"; 
        d.style.animationDuration = (8 + Math.random() * 4) + "s";
        bubbleContainer.appendChild(d); setTimeout(() => d.remove(), 12000); 
    }, 500); 
}
let sparksInterval;
function toggleSparks(enable) {
    if (!enable) { clearInterval(sparksInterval); if(sparkleContainer) sparkleContainer.innerHTML = ""; return; }
    sparksInterval = setInterval(() => {
        if(!sparkleContainer) return;
        const d = document.createElement("div"); d.className = "sparkle-orb";
        d.style.left = Math.random() * 100 + "vw"; 
        d.style.top = Math.random() * 100 + "vh"; 
        d.style.animationDuration = (0.8 + Math.random() * 0.4) + "s";
        sparkleContainer.appendChild(d); setTimeout(() => d.remove(), 1000); 
    }, 80);
}
let romanceInterval;
function toggleRomance(enable) {
    if (!enable) { clearInterval(romanceInterval); if(romanceContainer) romanceContainer.innerHTML = ""; return; }
    const loveWords = ["I Love You! 🥰", "Te Amo 💖", "Be Mine ✨", "Sweetheart ❤️", "Forever 💍"];
    romanceInterval = setInterval(() => {
        if(!romanceContainer) return; 
        const d = document.createElement("div"); d.className = "romance-text";
        d.style.color = "#FF1493";
        d.textContent = loveWords[Math.floor(Math.random() * loveWords.length)];
        d.style.left = Math.random() * 80 + 10 + "vw"; 
        d.style.animationDuration = (7 + Math.random() * 2) + "s";
        romanceContainer.appendChild(d); 
        setTimeout(() => d.remove(), 9000); 
    }, 900); 
}
let musicInterval;
function toggleMusic(enable) {
    if (!enable) { clearInterval(musicInterval); if(musicContainer) musicContainer.innerHTML = ""; return; }
    const notes = ["🎵", "🎶", "🎼", "🎹", "🎷"];
    musicInterval = setInterval(() => {
        if(!musicContainer) return;
        const d = document.createElement("div"); d.className = "music-note";
        d.textContent = notes[Math.floor(Math.random() * notes.length)];
        d.style.left = Math.random() * 100 + "vw";
        d.style.animationDuration = (3 + Math.random() * 3) + "s";
        musicContainer.appendChild(d); 
        setTimeout(() => d.remove(), 6000); 
    }, 400);
}
let weatherRainInterval; 
function toggleRain(enable) {
    if (!enable) { clearInterval(weatherRainInterval); if(rainContainer) rainContainer.innerHTML = ""; return; }
    weatherRainInterval = setInterval(() => {
        if(!rainContainer) return;
        const d = document.createElement("div"); d.className = "rain-drop";
        d.style.left = Math.random() * 100 + "vw";
        d.style.animationDuration = (0.5 + Math.random() * 0.5) + "s"; 
        d.style.opacity = Math.random();
        rainContainer.appendChild(d); 
        setTimeout(() => d.remove(), 1000); 
    }, 20); 
}
let lightningTimeout;
function toggleLightning(enable) {
    if (!enable) {
        clearTimeout(lightningTimeout);
        if(lightningFlash) { lightningFlash.style.display = "none"; lightningFlash.style.opacity = 0; }
        if(lightningCanvas) { lightningCanvas.style.display = "none"; }
        return;
    }
    lightningFlash.style.display = "block";
    lightningCanvas.style.display = "block";
    scheduleNextStrike();
}
function scheduleNextStrike() {
    const delay = Math.random() * 5000 + 2000;
    lightningTimeout = setTimeout(() => {
        triggerLightningStrike();
        scheduleNextStrike(); 
    }, delay);
}
function triggerLightningStrike() {
    lightningFlash.style.opacity = 0.6 + Math.random() * 0.4; 
    drawLightningBolt();
    setTimeout(() => { lightningFlash.style.opacity = 0; }, 50);
    setTimeout(() => {
        const ctx = lightningCanvas.getContext("2d");
        ctx.clearRect(0, 0, lightningCanvas.width, lightningCanvas.height);
    }, 200);
}
function drawLightningBolt() {
    const ctx = lightningCanvas.getContext("2d");
    const width = lightningCanvas.width;
    const height = lightningCanvas.height;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"; 
    ctx.lineWidth = 2 + Math.random() * 2;
    let x = Math.random() * width; 
    let y = 0; 
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < height) {
        const newX = x + (Math.random() * 40 - 20); 
        const newY = y + (Math.random() * 20 + 10); 
        ctx.lineTo(newX, newY);
        x = newX;
        y = newY;
    }
    ctx.stroke();
}
let fireworksInterval;
let particles = [];
function toggleFireworks(enable) {
    if(!enable) {
        clearInterval(fireworksInterval);
        if(fireworksCanvas) fireworksCanvas.style.display = "none";
        particles = [];
        return;
    }
    fireworksCanvas.style.display = "block";
    const ctx = fireworksCanvas.getContext("2d");
    
    function createFirework() {
        const x = Math.random() * fireworksCanvas.width;
        const y = Math.random() * fireworksCanvas.height / 2;
        const colors = ["#ff0", "#f0f", "#0ff", "#fff", "#f00"];
        for(let i=0; i<30; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color: colors[Math.floor(Math.random()*colors.length)],
                life: 100
            });
        }
    }
    fireworksInterval = setInterval(() => {
        ctx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
        if(Math.random() < 0.1) createFirework();
        for(let i=0; i<particles.length; i++) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        }
        particles = particles.filter(p => p.life > 0);
    }, 30);
}
let lanternInterval;
function toggleLanterns(enable) {
    if(!enable) { clearInterval(lanternInterval); if(lanternContainer) lanternContainer.innerHTML = ""; return; }
    lanternInterval = setInterval(() => {
        const d = document.createElement("div"); d.className = "lantern-float";
        d.textContent = "🏮";
        d.style.left = Math.random() * 100 + "vw";
        lanternContainer.appendChild(d);
        setTimeout(() => d.remove(), 12000);
    }, 1500);
}
let ufoInterval;
function toggleUfos(enable) {
    if(!enable) { clearInterval(ufoInterval); if(ufoContainer) ufoContainer.innerHTML = ""; return; }
    ufoInterval = setInterval(() => {
        const d = document.createElement("div"); d.className = "ufo-fly";
        d.textContent = "🛸";
        ufoContainer.appendChild(d);
        setTimeout(() => d.remove(), 8000);
    }, 4000);
}

