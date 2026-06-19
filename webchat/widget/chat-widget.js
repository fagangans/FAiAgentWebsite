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

  const style = document.createElement("style");
  style.textContent = `
    #wc-bubble { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: linear-gradient(180deg, #c9a84c, #9c8033); color: #050505;
      border: none; cursor: pointer; font-size: 24px; z-index: 9999;
      box-shadow: 0 2px 12px rgba(201,168,76,.35); transition: box-shadow .2s, transform .2s; }
    #wc-bubble:hover { box-shadow: 0 4px 18px rgba(201,168,76,.55); transform: translateY(-1px); }
    #wc-panel { position: fixed; bottom: 88px; right: 20px; width: 320px; height: 440px;
      background: #0a0a0a; border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
      box-shadow: 0 8px 28px rgba(0,0,0,.5); display: none; flex-direction: column;
      overflow: hidden; z-index: 9999; font-family: inherit; color: #fff; }
    #wc-panel.open { display: flex; }
    #wc-header { background: linear-gradient(180deg, #c9a84c, #9c8033); color: #050505;
      padding: 14px 16px; font-size: 14px; font-weight: 600; }
    #wc-messages { flex: 1; padding: 12px; overflow-y: auto; font-size: 13px; scrollbar-width: thin;
      scrollbar-color: #c9a84c #0a0a0a; }
    #wc-messages::-webkit-scrollbar { width: 6px; }
    #wc-messages::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #c9a84c, #9c8033); border-radius: 8px; }
    #wc-messages .wc-msg { margin-bottom: 8px; padding: 8px 12px; border-radius: 12px; max-width: 85%; line-height: 1.4; }
    #wc-messages .wc-user { background: linear-gradient(180deg, #c9a84c, #9c8033); color: #050505; margin-left: auto; }
    #wc-messages .wc-bot { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.1); }
    #wc-input-row { display: flex; border-top: 1px solid rgba(255,255,255,.12); background: #050505; }
    #wc-input { flex: 1; border: none; padding: 12px; font-size: 13px; outline: none;
      background: transparent; color: #fff; }
    #wc-input::placeholder { color: rgba(255,255,255,.4); }
    #wc-send { border: none; background: linear-gradient(180deg, #c9a84c, #9c8033); color: #050505;
      font-weight: 600; padding: 0 16px; cursor: pointer; border-radius: 999px; margin: 8px; }
    #wc-send:disabled { opacity: .6; cursor: default; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.id = "wc-bubble";
  bubble.textContent = "💬";

  const panel = document.createElement("div");
  panel.id = "wc-panel";
  panel.innerHTML = `
    <div id="wc-header">Chat dengan kami</div>
    <div id="wc-messages"></div>
    <div id="wc-input-row">
      <input id="wc-input" placeholder="Tulis pesan..." />
      <button id="wc-send">Kirim</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  bubble.onclick = () => panel.classList.toggle("open");

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
