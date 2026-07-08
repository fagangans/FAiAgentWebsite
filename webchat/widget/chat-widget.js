/**
 * Webchat Widget - tempel <script> ini di website manapun.
 *
 * Cara pakai:
 * <script
 *   src="https://YOUR_BACKEND_URL/widget/chat-widget.js"
 *   data-widget-key="WIDGET_KEY_DARI_ADMIN"
 *   data-api-url="https://YOUR_BACKEND_URL/api/chat"
 * ></script>
 */
(function () {
  const scriptTag = document.currentScript;
  const widgetKey = scriptTag.dataset.widgetKey;
  const apiUrl = scriptTag.dataset.apiUrl;

  if (!widgetKey || !apiUrl) {
    console.error("[Webchat] data-widget-key dan data-api-url wajib diisi");
    return;
  }

  const SESSION_KEY = "webchat_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  const apiBase = apiUrl.replace(/\/api\/chat\/?$/, "");
  const defaultColor = "#c9a84c";
  const defaultBgColor = "#0a0a0a";
  const defaultTitle = "Chat dengan kami";
  const defaultPosition = "bottom-right";
  const defaultOffsetX = 20;
  const defaultOffsetY = 20;
  const BUBBLE_SIZE = 56;
  const BUBBLE_PANEL_GAP = 12;

  // Ikon garis (stroke, gaya Feather) - bukan emoji, supaya bubble terlihat seperti
  // widget produk profesional yang dirancang, bukan karakter default sistem/AI generik.
  const CHAT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const SEND_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

  function shadeColor(hex, percent) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + percent))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 + percent))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 + percent))));
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  // Pilih warna teks (putih/gelap) otomatis berdasarkan kecerahan warna latar,
  // supaya tetap terbaca jelas apapun warna yang dipilih klien (terang atau gelap).
  function idealTextColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 150 ? "#1a1a1a" : "#ffffff";
  }

  // position = salah satu pojok layar ('bottom-right' | 'bottom-left' | 'top-right' | 'top-left').
  // offsetX/offsetY = jarak custom (px) dari sisi horizontal/vertikal yang dipilih, diatur klien
  // sendiri di dashboard - jadi widget bisa diposisikan persis sesuai kebutuhan tiap website.
  function buildStyle(color, position, bgColor, offsetX, offsetY) {
    const dark = shadeColor(color, -0.25);
    const isRight = position.indexOf("right") !== -1;
    const isTop = position.indexOf("top") !== -1;
    const sideProp = isRight ? "right" : "left";
    const vertProp = isTop ? "top" : "bottom";
    const panelVertOffset = offsetY + BUBBLE_SIZE + BUBBLE_PANEL_GAP;

    const bubbleText = idealTextColor(color);
    const panelText = idealTextColor(bgColor);
    const isDarkPanel = panelText === "#ffffff";
    const overlayBg = isDarkPanel ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)";
    const overlayBorder = isDarkPanel ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
    const mutedText = isDarkPanel ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)";

    return `
      #wc-bubble { position: fixed; ${vertProp}: ${offsetY}px; ${sideProp}: ${offsetX}px; width: ${BUBBLE_SIZE}px; height: ${BUBBLE_SIZE}px;
        border-radius: 50%; background: linear-gradient(180deg, ${color}, ${dark}); color: ${bubbleText};
        border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 9999;
        box-shadow: 0 2px 12px rgba(0,0,0,.25); transition: box-shadow .2s, transform .2s; }
      #wc-bubble svg { width: 25px; height: 25px; }
      #wc-bubble:hover { box-shadow: 0 4px 18px rgba(0,0,0,.35); transform: translateY(-1px); }
      #wc-panel { position: fixed; ${vertProp}: ${panelVertOffset}px; ${sideProp}: ${offsetX}px; width: 320px;
        max-width: calc(100vw - ${offsetX * 2}px); height: 440px;
        max-height: calc(100vh - ${panelVertOffset}px - 16px);
        background: ${bgColor}; border: 1px solid ${overlayBorder}; border-radius: 16px;
        box-shadow: 0 8px 28px rgba(0,0,0,.5); display: none; flex-direction: column;
        overflow: hidden; z-index: 9999; font-family: inherit; color: ${panelText}; }
      #wc-panel.open { display: flex; }
      #wc-header { background: linear-gradient(180deg, ${color}, ${dark}); color: ${bubbleText};
        padding: 14px 16px; font-size: 14px; font-weight: 600; }
      #wc-messages { flex: 1; padding: 12px; overflow-y: auto; font-size: 13px; scrollbar-width: thin;
        scrollbar-color: ${color} ${bgColor}; }
      #wc-messages::-webkit-scrollbar { width: 6px; }
      #wc-messages::-webkit-scrollbar-thumb { background: linear-gradient(180deg, ${color}, ${dark}); border-radius: 8px; }
      #wc-messages .wc-msg { margin-bottom: 8px; padding: 8px 12px; border-radius: 12px; max-width: 85%;
        line-height: 1.5; white-space: pre-wrap; }
      #wc-messages .wc-user { background: linear-gradient(180deg, ${color}, ${dark}); color: ${bubbleText}; margin-left: auto; }
      #wc-messages .wc-bot { background: ${overlayBg}; color: ${panelText}; border: 1px solid ${overlayBorder}; }
      #wc-input-row { display: flex; align-items: center; border-top: 1px solid ${overlayBorder}; background: ${bgColor}; }
      #wc-input { flex: 1; border: none; padding: 12px; font-size: 13px; outline: none;
        background: transparent; color: ${panelText}; }
      #wc-input::placeholder { color: ${mutedText}; }
      #wc-send { border: none; background: linear-gradient(180deg, ${color}, ${dark}); color: ${bubbleText};
        display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;
        cursor: pointer; border-radius: 50%; margin: 8px; flex-shrink: 0; }
      #wc-send svg { width: 15px; height: 15px; }
      #wc-send:disabled { opacity: .6; cursor: default; }
    `;
  }

  const styleEl = document.createElement("style");
  styleEl.textContent = buildStyle(defaultColor, defaultPosition, defaultBgColor, defaultOffsetX, defaultOffsetY);
  document.head.appendChild(styleEl);

  const bubble = document.createElement("button");
  bubble.id = "wc-bubble";
  bubble.innerHTML = CHAT_ICON;

  const panel = document.createElement("div");
  panel.id = "wc-panel";
  panel.innerHTML = `
    <div id="wc-header">${defaultTitle}</div>
    <div id="wc-messages"></div>
    <div id="wc-input-row">
      <input id="wc-input" placeholder="Tulis pesan..." />
      <button id="wc-send">${SEND_ICON}</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  let panelOpen = false;
  bubble.onclick = () => {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    bubble.innerHTML = panelOpen ? CLOSE_ICON : CHAT_ICON;
  };

  const headerEl = panel.querySelector("#wc-header");
  const messagesEl = panel.querySelector("#wc-messages");
  const inputEl = panel.querySelector("#wc-input");
  const sendBtn = panel.querySelector("#wc-send");

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `wc-msg wc-${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  fetch(apiBase + "/api/widget-config?widgetKey=" + encodeURIComponent(widgetKey))
    .then((r) => (r.ok ? r.json() : null))
    .then((config) => {
      if (!config) return;
      const bgColor = config.widget_bg_color || defaultBgColor;
      const position = config.widget_position || defaultPosition;
      const offsetX = Number.isInteger(config.widget_offset_x) ? config.widget_offset_x : defaultOffsetX;
      const offsetY = Number.isInteger(config.widget_offset_y) ? config.widget_offset_y : defaultOffsetY;
      styleEl.textContent = buildStyle(config.widget_color || defaultColor, position, bgColor, offsetX, offsetY);
      if (config.widget_title) headerEl.textContent = config.widget_title;
      if (config.widget_greeting) addMessage(config.widget_greeting, "bot");
    })
    .catch(() => {});

  async function sendMessage() {
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage(message, "user");
    inputEl.value = "";
    sendBtn.disabled = true;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetKey, sessionId, message }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal mendapat balasan");
      addMessage(data.reply, "bot");
    } catch (err) {
      addMessage("Maaf, terjadi gangguan. Coba lagi sebentar.", "bot");
      console.error("[Webchat]", err.message);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.onclick = sendMessage;
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
