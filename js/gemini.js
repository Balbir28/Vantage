// ============================================================
//  GEMINI RESEARCH ENGINE — bring-your-own-key deep research.
//  The user's key lives only in their browser (localStorage) and is sent
//  directly to Google's Gemini API with Google Search grounding. Vantage
//  never sees it. This is what turns the dashboard from free-signal to
//  genuinely-deep, live, per-brand competitive intelligence.
// ============================================================

const KEY_LS = "vantage-gemini-key";
const MODEL_LS = "vantage-gemini-model";

export const getKey = () => { try { return localStorage.getItem(KEY_LS) || ""; } catch (e) { return ""; } };
export const setKey = (k) => { try { localStorage.setItem(KEY_LS, (k || "").trim()); } catch (e) {} };
export const hasKey = () => !!getKey();
export const getModel = () => { try { return localStorage.getItem(MODEL_LS) || "gemini-2.0-flash"; } catch (e) { return "gemini-2.0-flash"; } };
export const setModel = (m) => { try { localStorage.setItem(MODEL_LS, m); } catch (e) {} };

function buildPrompt(brand, domain, competitors) {
  return `You are a Gartner analyst crossed with a Bain & Company D2C strategy partner, doing deep competitive intelligence for an Indian D2C brand. Use live web search across: the brands' own websites, the Meta Ad Library (facebook.com/ads/library), the Google Ads Transparency Center (adstransparency.google.com), Reddit, Amazon.in reviews, YouTube and news/editorial.

Brand: "${brand}" (${domain})
Competitors: ${competitors.join(", ")}

Research the brand's actual category, positioning, products and pricing FIRST (don't assume), then analyse competitors in that SAME category. Be specific to India and to this brand — no generic filler.

Return ONLY valid minified JSON (no markdown, no commentary) in EXACTLY this shape:
{
"summary":"4-6 sentence CEO executive summary of where the brand stands and the single biggest unlock",
"category":"the real product category",
"positioning":"the brand's positioning in one line",
"pricing":"pricing observation with ₹ ranges if found",
"competitors":[{"name":"","positioning":"","edge":"what they do better","gap":"their weakness you can exploit"}],
"ads":{"runningAngles":["specific ad angle/hook competitors run NOW on Meta/Google"],"whitespace":["ad angle nobody is using = your opening"]},
"transparency":"what the Google Ads Transparency Center / Meta Ad Library reveal about who is spending and on what",
"complaints":[{"source":"Reddit or Amazon","theme":"recurring real complaint in buyers' words"}],
"demand":["high-intent search question/keyword real buyers use"],
"aeo":{"score":0,"finding":"how visible the brand is in Google AI Overviews / answer engines","recs":["concrete AEO action"]},
"geo":{"score":0,"finding":"how often the brand is cited by ChatGPT/Gemini/Perplexity vs competitors","recs":["concrete GEO action"]},
"opportunities":[{"title":"","impact":"High|Med|Low","effort":"Low|Med|High","action":"specific next step"}],
"plan":{"d30":["30-day action"],"d90":["90-day action"],"d365":["12-month move"]},
"thousandCr":"the single most important strategic move to build this into a ₹1000 Cr brand, with the reasoning"
}
Provide 4-5 items in each array where relevant. Scores are 0-100 integers.`;
}

export async function geminiResearch(brand, domain, competitors) {
  const key = getKey();
  if (!key) return { ok: false, error: "no-key" };
  const model = getModel();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(brand, domain, competitors) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.35 },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      let msg = `${res.status}`;
      try { msg = JSON.parse(t).error?.message || msg; } catch (e) { msg = t.slice(0, 140); }
      return { ok: false, error: msg };
    }
    const j = await res.json();
    let text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    text = text.replace(/```json|```/g, "").trim();
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < 0) return { ok: false, error: "Gemini returned no JSON" };
    const data = JSON.parse(text.slice(a, b + 1));
    // capture grounding sources if present
    const grounding = j.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    data._sources = grounding.map((g) => g.web?.title).filter(Boolean).slice(0, 8);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

// Quick key validation (cheap call) for the Settings "Test" button.
export async function testKey(key) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${(key || "").trim()}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word: OK" }] }] }),
    });
    if (res.ok) return { ok: true };
    const t = await res.text();
    let msg = `${res.status}`;
    try { msg = JSON.parse(t).error?.message || msg; } catch (e) {}
    return { ok: false, error: msg };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}
