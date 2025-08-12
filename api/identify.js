// api/identify.js  — Vercel Serverless Function (Node.js)
// Uses your Vercel env var OPEN_API_KEY (no key in the browser)
// Expects POST JSON: { imageDataUrl: "data:image/...base64,...", context: "optional string" }

export default async function handler(req, res) {
  // Basic CORS so you can call from your page
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { imageDataUrl, context = "" } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({ error: "Missing imageDataUrl (base64 data URL)" });
    }

    const prompt = `
You’re a ruthless, accurate sushi spotter. One photo, one output.

STYLE:
- Crisp bullets, zero fluff.
- NYC snark is fine, but keep it useful.
- Never write “no toro” unless toro is explicitly mentioned by the user.

OUTPUT FORMAT (match exactly):
Row 1:
1) <fish/item> — <garnish/sauce/notes>
2) ...
Row 2:
...
Notes:
- ...
- ...

RULES:
- First, silently count TOTAL pieces (incl. rolls) and make sure your breakdown covers them all.
- Go row-by-row (top→bottom), left→right. Number every piece.
- If multiple in the SAME ROW are visually identical (same fish, same garnish), write “n× <fish> — <garnish>”.
- Do NOT merge across rows unless they’re visually identical.
- Use sushi-specific cues over guessing.
- Mention toro only if present.
- Notes: 2–3 bullets, punchy: cut quality, rice temp/seasoning, garnish oddities, obvious omissions.

Extra context (may help accuracy): ${context}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPEN_API_KEY}`, // <- from Vercel env
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 700,
        messages: [
          { role: "system", content: "You are a sushi expert who visually identifies fish in photos with high precision." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } }
            ]
          }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Upstream error" });
    }

    const text = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
