/**
 * আরবি শিখি – AI ওস্তাদ প্রক্সি (Cloudflare Worker)
 * ফ্রি Gemini (Google AI Studio) বা Claude API: যেটির কী দেবেন সেটি চলবে।
 * প্রতি ডিভাইসে ঘণ্টায় সীমা (HOURLY_LIMIT) বসানো যায়, ফ্রি চ্যাটবটের মতো।
 *
 * Secrets / Variables (Worker > Settings > Variables and Secrets):
 *   GEMINI_API_KEY     (Secret) : Google AI Studio-র ফ্রি কী          ← ফ্রি পথ
 *   ANTHROPIC_API_KEY  (Secret) : Claude API কী (পেইড)                ← বিকল্প
 *   MODEL              (Text)   : ঐচ্ছিক। ডিফল্ট: gemini-2.5-flash / claude-haiku-5-5
 *   ALLOWED_ORIGINS    (Text)   : যেমন https://lotuspro57.github.io,https://localhost
 *   HOURLY_LIMIT       (Text)   : প্রতি ডিভাইসে ঘণ্টায় কয়টি প্রশ্ন (ডিফল্ট 10)
 * Binding (Worker > Settings > Bindings > KV namespace):
 *   RATE : সীমা গোনার জন্য একটি KV namespace (না দিলে সীমা কাজ করবে না)
 *
 * অ্যাপ পাঠায়: POST { device, system, messages:[{role,content}] }
 * ফেরত: { text, remaining, limit }   বা   429 { error:"limit", retryAfter, limit }
 */
export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'access-control-allow-origin': okOrigin ? (origin || '*') : 'null',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'vary': 'origin'
    };
    const out = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return out({ error: 'POST only' }, 405);
    if (!okOrigin) return out({ error: 'origin not allowed' }, 403);
    if (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) return out({ error: 'server not configured' }, 500);

    let body;
    try { body = await req.json(); } catch { return out({ error: 'bad json' }, 400); }

    const system = String(body.system || '').slice(0, 8000);
    let messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-16)
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    // পরপর একই ভূমিকার বার্তা জোড়া লাগানো
    messages = messages.reduce((a, m) => {
      const l = a[a.length - 1];
      if (l && l.role === m.role) l.content += '\n\n' + m.content; else a.push({ ...m });
      return a;
    }, []);
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') return out({ error: 'no user message' }, 400);

    // ---- ঘণ্টায় সীমা (ডিভাইস ধরে) ----
    const limit = parseInt(env.HOURLY_LIMIT || '10', 10);
    let remaining = null;
    if (env.RATE && limit > 0) {
      const dev = String(body.device || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) ||
        ('ip-' + (req.headers.get('cf-connecting-ip') || 'x'));
      const hour = Math.floor(Date.now() / 3600000);
      const key = `r:${dev}:${hour}`;
      try {
        const used = parseInt((await env.RATE.get(key)) || '0', 10);
        if (used >= limit) {
          const retryAfter = 3600 - Math.floor((Date.now() / 1000) % 3600);
          return out({ error: 'limit', retryAfter, limit }, 429);
        }
        await env.RATE.put(key, String(used + 1), { expirationTtl: 7200 });
        remaining = limit - used - 1;
      } catch (e) { /* KV সমস্যা হলে সীমা ছাড়াই চলবে */ }
    }

    try {
      let text = '';
      if (env.GEMINI_API_KEY) {
        const model = env.MODEL || 'gemini-2.5-flash';
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: 2048 }
          })
        });
        if (r.status === 429) return out({ error: 'provider busy', retryAfter: 60, limit }, 429);
        if (!r.ok) return out({ error: 'upstream ' + r.status }, 502);
        const j = await r.json();
        text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
          .map(p => p.text || '').join('');
      } else {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: env.MODEL || 'claude-haiku-5-5', max_tokens: 900, system, messages })
        });
        if (r.status === 429) return out({ error: 'provider busy', retryAfter: 60, limit }, 429);
        if (!r.ok) return out({ error: 'upstream ' + r.status }, 502);
        const j = await r.json();
        text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      }
      if (!text) return out({ error: 'empty' }, 502);
      return out({ text, remaining, limit });
    } catch (e) {
      return out({ error: 'upstream failed' }, 502);
    }
  }
};
