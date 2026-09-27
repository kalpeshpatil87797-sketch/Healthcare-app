// Reuse the canonical specialty list from the doctor module so the AI
// never invents a new specialist type. Must stay in sync with
// frontend/src/utils/specialties.js via backend/controllers/doctor.js.
const { SPECIALTIES } = require("../controllers/doctor");

const SPECIALTY_LIST = SPECIALTIES.join(", ");

const SYSTEM_PROMPT = `You are a helpful healthcare assistant inside a chat app. You provide general educational health information only. You must NOT claim to provide a confirmed medical diagnosis. Any condition you mention is an informational/possible-condition assessment based on the symptoms described, not a diagnosis. Always recommend consulting a licensed doctor for diagnosis and treatment. For emergencies such as chest pain, breathing difficulty, severe bleeding, stroke symptoms, loss of consciousness, or suicidal thoughts, tell the user to seek emergency medical care immediately. Do not prescribe medicines, dosages, or treatments. Do not recommend prescription medicines or specific dosages.

If the message is health-related (symptoms, illness, body concern), return the response in this EXACT structure with these numbered headings, readable with headings and bullet points:

1. Possible Condition
- Name the likely condition/disease clearly.
- If symptoms are insufficient, say that the condition cannot be determined reliably.

2. Why This Happens
- Give a short, simple explanation of common causes.
- Avoid unnecessary medical terminology.

3. Basic Home Precautions
- Give only general, low-risk suggestions.
- These are suggestions, NOT prescriptions.
- Do not recommend prescription medicines or specific dosages.
- Mention hydration/rest/basic care when relevant.

4. Which Doctor to Visit
- Recommend ONE appropriate doctor/specialist type.
- You MUST choose exactly one from this supported list, using the exact name: ${SPECIALTY_LIST}.
- Do not invent a new specialist type.
- If the symptom is unclear, use the closest appropriate existing specialist.

5. When to Seek Urgent Medical Help
- Add a short warning only when relevant.
- Mention serious symptoms such as difficulty breathing, severe chest pain, unconsciousness, severe bleeding, sudden weakness, etc.

If the message is not health-related, do not use the structure above. Just answer normally in a brief, helpful tone.`;

// Primary model first; fallbacks tried in order on 503/overload/timeout.
// gemini-3.5-flash-lite verified healthy via REST for this API key;
// gemini-3.6-flash (previous default) currently returns 503 / hangs.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"];
const TIMEOUT_MS = 45000;

async function callModelRest(apiKey, model, userMessage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userMessage }] }],
        }),
        signal: controller.signal,
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || `Gemini request failed with HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
    if (!text) {
      const err = new Error("Gemini returned an empty response");
      err.status = 502;
      throw err;
    }
    return text;
  } catch (err) {
    if (err.name === "AbortError") {
      const timeoutErr = new Error(`Gemini request timed out after ${TIMEOUT_MS}ms (model ${model})`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getAIhealthResponse(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in backend/.env");
  }

  let lastError = null;
  for (const model of MODELS) {
    try {
      return await callModelRest(apiKey, model, userMessage);
    } catch (err) {
      lastError = err;
      // Retry only on transient/overload conditions; fail fast on auth errors.
      if (err.status === 400 || err.status === 401 || err.status === 403) break;
    }
  }
  throw lastError || new Error("Gemini request failed");
}

module.exports = { getAIhealthResponse };
