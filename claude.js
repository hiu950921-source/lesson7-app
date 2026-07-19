// Vercel 서버리스 함수: /api/claude
// 브라우저의 요청을 받아 Anthropic API로 중계합니다.
// ANTHROPIC_API_KEY 는 Vercel 환경변수(서버 전용)로만 존재하며 브라우저에 노출되지 않습니다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) {} }
    const { messages, system, max_tokens = 700 } = body || {};

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ type: "error", error: { message: "서버에 ANTHROPIC_API_KEY 가 설정되어 있지 않아요. (Vercel 환경변수 확인)" } });
      return;
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // 실제 Anthropic API에서 유효한 모델 ID.
        // 비용을 더 줄이려면 "claude-haiku-4-5-20251001" 로 바꿔도 됩니다.
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
    res.status(500).json({ type: "error", error: { message: "프록시 오류: " + String(e) } });
  }
}
