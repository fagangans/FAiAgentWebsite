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
      border-radius: 50%; background: #2563eb; color: #fff; border: none; cursor: pointer;
      font-size: 24px; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    #wc-panel { position: fixed; bottom: 88px; right: 20px; width: 320px; height: 420px;
      background: #fff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
      display: none; flex-direction: column; overflow: hidden; z-index: 9999; font-family: sans-serif; }
    #wc-panel.open { display: flex; }
    #wc-header { background: #2563eb; color: #fff; padding: 12px; font-size: 14px; }
    #wc-messages { flex: 1; padding: 10px; overflow-y: auto; font-size: 13px; }
    #wc-messages .wc-msg { margin-bottom: 8px; padding: 8px 10px; border-radius: 8px; max-width: 85%; }
    #wc-messages .wc-user { background: #2563eb; color: #fff; margin-left: auto; }
    #wc-messages .wc-bot { background: #f1f5f9; color: #111; }
    #wc-input-row { display: flex; border-top: 1px solid #eee; }
    #wc-input { flex: 1; border: none; padding: 10px; font-size: 13px; outline: none; }
    #wc-send { border: none; background: #2563eb; color: #fff; padding: 0 14px; cursor: pointer; }
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
