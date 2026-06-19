import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const SYSTEM_PROMPT = process.env.BOT_SYSTEM_PROMPT || "Kamu adalah asisten AI yang ramah dan membantu. Jawab dalam Bahasa Indonesia kecuali diminta bahasa lain.";

const sessions = new Map();
const SESSION_MAX = 20;

function getHistory(senderId) {
  return sessions.get(senderId) || [];
}

function pushHistory(senderId, role, text) {
  let hist = sessions.get(senderId);
  if (!hist) {
    hist = [];
    sessions.set(senderId, hist);
  }
  hist.push({ role, parts: [{ text }] });
  if (hist.length > SESSION_MAX * 2) {
    hist.splice(0, 2);
  }
}

function clearHistory(senderId) {
  sessions.delete(senderId);
}

export async function GeminiChat(prompt, senderId) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum diset di environment");
  }

  const history = getHistory(senderId);

  const contents = [
    ...history,
    { role: "user", parts: [{ text: prompt }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!reply) throw new Error("Gemini API: respon kosong");

  pushHistory(senderId, "user", prompt);
  pushHistory(senderId, "model", reply);

  return reply;
}

export { clearHistory };
export default GeminiChat;
