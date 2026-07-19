// Vercel 서버리스 함수: /api/claude
// 브라우저의 요청을 받아 Anthropic API로 중계합니다.
// ANTHROPIC_API_KEY 는 Vercel 환경변수(서버 전용)로만 존재하며 브라우저에 노출되지 않습니다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { messages, system, max_tokens = 700 } = req.body || {};

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens,
        system,
        messages,
      }),
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error("proxy error:", e);
    res.status(500).json({ error: "proxy_error", content: [] });
  }
}
