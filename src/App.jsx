import React, { useState, useEffect, useRef, useCallback } from "react";
import { storeSet, storeList } from "./firebase";

/* =========================================================================
   Lesson 7. It Was a Great Week!  —  5차시 학습 웹앱
   1) Read & Learn   2) Write & Share   3) My Art Gallery
   - 실제 AI 연동(피드백/루미 대화/번역)  - 브라우저 내장 음성(TTS)/녹음
   ========================================================================= */

/* ---- 팔레트 & 폰트 -------------------------------------------------------- */
const C = {
  paper: "#FFF7EC",
  card: "#FFFFFF",
  ink: "#3A3330",
  coral: "#FF6B5B",
  coralDeep: "#E4553F",
  teal: "#2BB3A3",
  tealDeep: "#1E8C80",
  yellow: "#FFC93C",
  plum: "#6C5CE7",
  plumDeep: "#5648C7",
  green: "#4CAF7D",
  pink: "#FF7AA2",
  sky: "#4AA7E0",
  line: "#EADFCB",
  soft: "#FBEFDD",
};
const F = {
  disp: "'Baloo 2', 'Jua', sans-serif",   // 영어 제목
  ko: "'Jua', sans-serif",                 // 한국어 제목
  hand: "'Gaegu', cursive",                // 손글씨/스크랩북
  body: "'Noto Sans KR', sans-serif",      // 본문
};

/* ---- AI 시스템 프롬프트(추후 손쉽게 교체 가능) --------------------------- */
const SYS_FEEDBACK = `너는 한국 초등학교 5학년(12세) 영어 학습을 돕는 다정한 원어민 선생님이야.
학생이 쓴 짧은 영어 일기를 확인해줘. 규칙:
- 먼저 잘한 점을 1가지 구체적으로 칭찬 (한국어).
- 문법/철자 오류가 있으면 최대 3개까지, 아주 쉽게 한국어로 알려주고 올바른 문장을 보여줘.
- 과거형 동사(went, ate, made, drew...)를 잘 썼는지 짚어줘.
- 마지막에 고친 전체 영어 문장을 "✅ 고친 일기:" 뒤에 보여줘.
- 절대 어렵게 말하지 말고, 이모지를 조금 써서 따뜻하게. 전체 8줄 이내.`;

const SYS_LUMI = `너는 'Lumi(루미)'라는 미술 감상 친구야. 한국 초등 5학년(12세)이 그린 그림을 함께 봐.
Yenawine(2014, 2018)의 시각적 사고 전략(VTS)으로 대화해. 핵심은 정답을 주지 않고, 토의를 통해 스스로 의미를 만들게 돕는 거야.
[대화 흐름] ① 관찰 → ② 근거 → ③ 확장 순서로, 한 번에 질문은 딱 하나만.
- 시작·관찰: "그림에서 무엇이 보여? (What do you see in the picture?)" / "무엇이 눈에 띄어? (What do you notice in the picture?)" / "이 그림에서 무슨 일이 일어나고 있어? (What's going on in this picture?)"
- 근거: 아이 대답을 먼저 그대로 되짚어 준 뒤 → "무엇을 보고 그렇게 생각했어? (What do you see that makes you say that?)" / "그것에 대해 이야기해줄래? (Tell me about that.)"
- 확장·정리: "조금 더 말해줄 수 있어? (Could you tell me more?)" / "우리가 더 찾아볼 게 있을까? (What more can we find?)"
[규칙]
- 정답·해석·평가를 주지 마. "잘했어/멋져" 같이 점수 매기는 칭찬은 금지. 대신 아이 말을 중립적으로 되짚어 주고 다음 질문으로 이어가.
- 한국어로 따뜻하게, 1~2문장으로 아주 짧게. 질문은 한국어로 하고 위처럼 영어 원문을 괄호로 살짝만 곁들여도 좋아(매번은 아님).
- 모든 관찰을 존중하고, 아이의 상상과 그때의 경험(과거 순간)을 끌어내. 첫 마디는 위 '관찰' 질문 하나로 열어줘.`;

const SYS_TRANSLATE = `너는 한국 초등 5학년의 영어 쓰기를 돕는 번역 도우미야.
학생이 쓴 한국어 문장을, 초등학생이 이해하고 따라 쓸 수 있는 쉽고 자연스러운 영어로 바꿔줘.
과거의 경험이면 과거형 동사를 사용해. 설명 없이 영어 문장만 출력해.`;

/* ---- Anthropic API 헬퍼 -------------------------------------------------- */
async function callClaude(messages, system, maxTokens = 700) {
  // API 키는 서버(프록시)에만 있고, 브라우저에는 노출되지 않음
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens }),
  });
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/* ---- 효과음(Web Audio) --------------------------------------------------- */
let _ac;
function beep(kind) {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    const ac = _ac;
    const play = (freq, start, dur, type = "sine", vol = 0.18) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ac.destination);
      const t = ac.currentTime + start;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur);
    };
    if (kind === "correct") {
      play(660, 0, 0.15);
      play(880, 0.12, 0.22);
    } else if (kind === "star") {
      play(784, 0, 0.12);
      play(988, 0.1, 0.12);
      play(1319, 0.2, 0.25);
    } else {
      play(180, 0, 0.28, "square", 0.12);
    }
  } catch (e) {}
}

/* ---- TTS(브라우저 내장 음성) -------------------------------------------- */
function pickEnVoice() {
  const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  return (
    vs.find((v) => /en-US/i.test(v.lang) && /female|Samantha|Google US/i.test(v.name)) ||
    vs.find((v) => /en-US/i.test(v.lang)) ||
    vs.find((v) => /^en/i.test(v.lang)) ||
    null
  );
}
function speak(text, rate = 1, onWord, onEnd) {
  if (!window.speechSynthesis) {
    onEnd && onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const v = pickEnVoice();
  if (v) u.voice = v;
  if (onWord)
    u.onboundary = (e) => {
      if (e.name === "word" || e.charIndex >= 0) onWord(e.charIndex);
    };
  u.onend = () => onEnd && onEnd();
  window.speechSynthesis.speak(u);
}
function stopSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

/* ---- 저장소(공유 데이터) — Firestore 사용 (src/firebase.js) ------------- */
// storeSet / storeList 는 ./firebase 에서 가져와 상단에서 import 함

/* ---- 과거형 동사 판별 ---------------------------------------------------- */
const PAST_SET = new Set([
  "went","played","ate","saw","drew","made","swam","visited","took","watched",
  "was","were","had","got","felt","ran","came","said","did","gave","found",
  "helped","looked","walked","talked","liked","loved","stayed","enjoyed",
  "jumped","cooked","learned","wanted","tried","climbed","cried","smiled",
]);
function countPastVerbs(text) {
  const words = (text.toLowerCase().match(/[a-z']+/g) || []);
  const found = new Set();
  for (const w of words) {
    if (PAST_SET.has(w)) found.add(w);
    else if (/[a-z]{2,}ed$/.test(w) && !["red","bed","bed"].includes(w)) found.add(w);
  }
  return found;
}

/* =========================================================================
   공통 UI 조각
   ========================================================================= */
function Btn({ children, onClick, color = C.coral, style, disabled, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#D8CBB6" : color,
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: small ? "8px 16px" : "12px 22px",
        fontSize: small ? 15 : 18,
        fontFamily: F.ko,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 4px 0 rgba(0,0,0,0.12)",
        transition: "transform .08s",
        ...style,
      }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = "translateY(2px)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {children}
    </button>
  );
}
function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 8px 24px rgba(150,120,70,0.12)",
        border: `2px solid ${C.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function SectionTitle({ n, en, ko, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 14px" }}>
      {n != null && (
        <span
          style={{
            width: 40, height: 40, borderRadius: 12, background: color, color: "#fff",
            display: "grid", placeItems: "center", fontFamily: F.disp, fontWeight: 700, fontSize: 20,
            boxShadow: "0 3px 0 rgba(0,0,0,0.12)",
          }}
        >
          {n}
        </span>
      )}
      <div>
        <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 22, color: C.ink, lineHeight: 1.1 }}>{en}</div>
        {ko && <div style={{ fontFamily: F.ko, fontSize: 14, color: "#9A8B76" }}>{ko}</div>}
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 1  —  Read & Learn
   ========================================================================= */
/* ▣ 각 문항 사진 넣는 법 ---------------------------------------------------
   아래 img 에 사진을 넣으면 이모지 대신 사진이 폴라로이드 액자로 보여요.
     · 인터넷 사진:  img: "https://...jpg"
     · 내 사진 파일: img: "data:image/jpeg;base64,......"  (base64로 붙여넣기)
   비워두면(img:"") 이모지가 보이고, 사진 주소가 안 열리면 자동으로 이모지로 돌아갑니다.
   ▶ 추천: 선생님이 직접 찍은 수업/여행 사진을 쓰면 저작권 걱정 없이 딱 맞아요.
   -------------------------------------------------------------------------- */
/* 현재 사진 출처(모두 Wikimedia Commons, 무료 라이선스):
   1) 친구 만들기 : "US Navy ... Children smile ... Lamno, Sumatra" — Public Domain (미 해군)
   2) 사진 찍기   : "Photographyy.jpg" — CC BY 2.0
   3) 전통놀이    : "Sailors play Jegichagi with Korean students ..." — Public Domain (미 해군)
   4) 비빔밥      : "Bibimbap (8111593238).jpg" (Korea.net/전한) — CC BY-SA 2.0
   5) 드라마 보기 : "Family watching television 1958.jpg" — Public Domain
   ※ CC BY / CC BY-SA 사진(2·4번)은 정식 배포 시 출처 표기를 권장합니다.        */
const QUIZ = [
  { emoji: "🤝", img: "https://commons.wikimedia.org/wiki/Special:FilePath/US%20Navy%20050115-N-9951E-146%20Children%20smile%20and%20gather%20for%20a%20group%20photo%20in%20the%20town%20of%20Lamno%2C%20Sumatra.jpg?width=400", pre: "I ", post: " Korean friends.", opts: ["was", "made"], ans: "made",
    exp: { was: "was : be동사(am/is)의 과거형", made: "made : make(만들다)의 과거형 ✓" } },
  { emoji: "📸", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Photographyy.jpg?width=400", pre: "I ", post: " many pictures.", opts: ["took", "visited"], ans: "took",
    exp: { took: "took : take(찍다·가지다)의 과거형 ✓", visited: "visited : visit(방문하다)의 과거형" } },
  { emoji: "🪁", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Sailors%20play%20Jegichagi%20with%20Korean%20students%20during%20a%20community%20relations%20event%20%2830361247131%29.jpg?width=400", pre: "I ", post: " traditional Korean games.", opts: ["played", "went"], ans: "played",
    exp: { played: "played : play(놀다·하다)의 과거형 ✓", went: "went : go(가다)의 과거형" } },
  { emoji: "🍲", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Bibimbap%20%288111593238%29.jpg?width=400", pre: "I ", post: " Bibimbap with my friends.", opts: ["ate", "cooked"], ans: "ate",
    exp: { ate: "ate : eat(먹다)의 과거형 ✓", cooked: "cooked : cook(요리하다)의 과거형" } },
  { emoji: "📺", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Family%20watching%20television%201958.jpg?width=400", pre: "I ", post: " a Korean drama.", opts: ["got up", "watched"], ans: "watched",
    exp: { "got up": "got up : get up(일어나다)의 과거형", watched: "watched : watch(보다)의 과거형 ✓" } },
];

/* 문항 사진(폴라로이드) — 사진이 없거나 안 열리면 이모지로 대체 */
function QPhoto({ img, emoji }) {
  const [err, setErr] = useState(false);
  const box = {
    width: 104, height: 104, borderRadius: 10, flexShrink: 0,
    display: "grid", placeItems: "center", background: "#fff",
    boxShadow: "0 4px 10px rgba(120,90,40,0.18)", transform: "rotate(-2deg)",
    border: "5px solid #fff", overflow: "hidden",
  };
  if (!img || err) {
    return <div style={{ ...box, background: "#FFF3E2", fontSize: 46 }}>{emoji}</div>;
  }
  return (
    <div style={box}>
      <img
        src={img}
        alt=""
        onError={() => setErr(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function ReadyToWrite() {
  const [picked, setPicked] = useState({});
  return (
    <Card>
      <SectionTitle n="A" en="Ready to Write" ko="그림을 보고 알맞은 과거형 동사를 골라요" color={C.coral} />
      <div style={{ display: "grid", gap: 14 }}>
        {QUIZ.map((q, i) => {
          const p = picked[i];
          const correct = p === q.ans;
          return (
            <div key={i} style={{ background: C.soft, borderRadius: 16, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <QPhoto img={q.img} emoji={q.emoji} />
                <span style={{ fontFamily: F.disp, fontSize: 20, color: C.ink }}>
                  {q.pre}
                  <span
                    style={{
                      display: "inline-block", minWidth: 68, textAlign: "center",
                      borderBottom: `3px solid ${p ? (correct ? C.green : C.coral) : "#C9B79A"}`,
                      color: p ? (correct ? C.green : C.coral) : "#C9B79A", fontWeight: 700, margin: "0 4px",
                    }}
                  >
                    {p || "____"}
                  </span>
                  {q.post}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {q.opts.map((o) => (
                    <button
                      key={o}
                      onClick={() => {
                        setPicked((s) => ({ ...s, [i]: o }));
                        beep(o === q.ans ? "correct" : "wrong");
                      }}
                      style={{
                        background: p === o ? (o === q.ans ? C.green : C.coral) : "#fff",
                        color: p === o ? "#fff" : C.ink,
                        border: `2px solid ${o === q.ans && p ? C.green : C.line}`,
                        borderRadius: 12, padding: "8px 16px", fontSize: 17, fontFamily: F.disp,
                        fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              {p && (
                <div
                  style={{
                    marginTop: 10, background: "#fff", borderRadius: 12, padding: "8px 12px",
                    fontSize: 14, fontFamily: F.body, color: "#6E5F4C", lineHeight: 1.7,
                    borderLeft: `4px solid ${correct ? C.green : C.coral}`,
                  }}
                >
                  {correct ? "🎉 정답이에요! " : "🔎 다시 볼까요? "}
                  {q.opts.map((o) => (
                    <div key={o}>• {q.exp[o]}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---- Alex's Diary (TTS 하이라이트) -------------------------------------- */
const DIARY_TEXT =
  "Tomorrow, I will go back to the USA. This week, I was in Korea. It was the best week ever. " +
  "I ate Bibimbap with Ji-o and Lumi. It was very delicious. I made a kite with Ji-o and Lumi, too. " +
  "I drew pictures with Chen. She helped me a lot. Chen was so amazing. I got up at six one day. " +
  "I visited a palace with Jun and Amina. It was so awesome! I will miss my Korean friends. Goodbye, everyone!";

const DIARY_LINES = [
  "Tomorrow, I will go back to the USA.",
  "This week, I was in Korea.",
  "It was the best week ever.",
  "I ate Bibimbap with Ji-o and Lumi.",
  "It was very delicious.",
  "I made a kite with Ji-o and Lumi, too.",
  "I drew pictures with Chen.",
  "She helped me a lot.",
  "Chen was so amazing.",
  "I got up at six one day.",
  "I visited a palace with Jun and Amina.",
  "It was so awesome!",
  "I will miss my Korean friends. Goodbye, everyone!",
];

/* 알렉스 일기 한글 해석 (줄 순서 동일) */
const DIARY_KO = [
  "내일 나는 미국으로 돌아가.",
  "이번 주에 나는 한국에 있었어.",
  "지금까지 중 최고의 한 주였어.",
  "나는 지오, 루미와 함께 비빔밥을 먹었어.",
  "정말 맛있었어.",
  "지오, 루미와 함께 연도 만들었어.",
  "나는 첸과 함께 그림을 그렸어.",
  "첸은 나를 많이 도와줬어.",
  "첸은 정말 멋졌어.",
  "어느 날은 여섯 시에 일어났어.",
  "나는 준, 아미나와 함께 궁궐을 방문했어.",
  "정말 멋졌어!",
  "한국 친구들이 그리울 거야. 모두 안녕!",
];

function AlexDiary() {
  const [rate, setRate] = useState(1);
  const [charAt, setCharAt] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [showKo, setShowKo] = useState(false);

  // 전체 텍스트 기준 각 단어의 시작 char index 매핑
  const tokens = [];
  {
    let idx = 0;
    for (const line of DIARY_LINES) {
      const words = line.split(" ");
      const lineToks = [];
      for (const w of words) {
        lineToks.push({ w, start: idx });
        idx += w.length + 1;
      }
      tokens.push(lineToks);
    }
  }
  const activeStart = (() => {
    if (charAt < 0) return -1;
    let best = -1;
    for (const line of tokens) for (const t of line) if (t.start <= charAt) best = t.start;
    return best;
  })();

  const onPlay = () => {
    setPlaying(true);
    speak(
      DIARY_LINES.join(" "),
      rate,
      (ci) => setCharAt(ci),
      () => { setPlaying(false); setCharAt(-1); }
    );
  };
  const onStop = () => { stopSpeak(); setPlaying(false); setCharAt(-1); };

  return (
    <Card style={{ marginTop: 18 }}>
      <SectionTitle n="B" en="Alex's Diary" ko="알렉스의 일기를 듣고 읽어요" color={C.plum} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <Btn small color={playing ? C.coral : C.plum} onClick={playing ? onStop : onPlay}>
          {playing ? "⏹ 멈추기" : "🔊 듣기"}
        </Btn>
        <span style={{ fontFamily: F.ko, fontSize: 14, color: "#9A8B76", marginLeft: 6 }}>속도</span>
        {[0.8, 1.0, 1.2].map((r) => (
          <button
            key={r}
            onClick={() => setRate(r)}
            style={{
              background: rate === r ? C.plum : "#fff", color: rate === r ? "#fff" : C.ink,
              border: `2px solid ${C.line}`, borderRadius: 10, padding: "6px 12px",
              fontFamily: F.disp, fontWeight: 600, cursor: "pointer",
            }}
          >
            {r.toFixed(1)}x
          </button>
        ))}
      </div>

      {/* 스크랩북 일기 */}
      <div
        style={{
          background:
            "repeating-linear-gradient(#FFFDF7,#FFFDF7 33px,#F3E7CE 34px)",
          borderRadius: 14, padding: "22px 24px", border: `2px solid ${C.line}`,
          position: "relative", boxShadow: "inset 0 0 0 8px #fff",
        }}
      >
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%) rotate(-3deg)",
          background: "rgba(255,201,60,0.7)", padding: "3px 26px", fontFamily: F.hand, color: "#8a6d1f",
          borderRadius: 3, fontSize: 14,
        }}>✈ Korea Trip ✈</div>
        <div style={{ fontFamily: F.hand, fontSize: 24, lineHeight: "34px", color: "#4a4038" }}>
          {tokens.map((line, li) => (
            <div key={li}>
              {line.map((t, wi) => {
                const on = t.start === activeStart;
                return (
                  <span
                    key={wi}
                    style={{
                      color: on ? C.coralDeep : "#4a4038",
                      fontWeight: on ? 700 : 400,
                      background: on ? "rgba(255,201,60,0.5)" : "transparent",
                      borderRadius: 4, padding: on ? "0 2px" : 0, transition: "all .08s",
                    }}
                  >
                    {t.w}{" "}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 한글 해석 보기 */}
      <div style={{ marginTop: 12 }}>
        <Btn small color={showKo ? C.coral : C.teal} onClick={() => setShowKo((v) => !v)}>
          {showKo ? "🇰🇷 해석 숨기기" : "🇰🇷 한글 해석 보기"}
        </Btn>
        {showKo && (
          <div style={{ marginTop: 10, background: "#EAF7F4", border: `2px solid ${C.teal}`, borderRadius: 14, padding: "14px 16px" }}>
            {DIARY_LINES.map((en, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: F.disp, fontSize: 15, color: "#4a4038" }}>{en}</div>
                <div style={{ fontFamily: F.body, fontSize: 14, color: C.tealDeep }}>↳ {DIARY_KO[i]}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TrueFalse />
      <FindAndDrag />
      <CopyAndWrite />
    </Card>
  );
}

/* ---- 1. True or False (O/X) --------------------------------------------- */
const TF = [
  { q: "Alex visited a palace.", a: true },
  { q: "Alex ate pizza with Ji-o and Lumi.", a: false, hint: "Alex ate Bibimbap 🍲" },
];
function TrueFalse() {
  const [pick, setPick] = useState({});
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle n="1" en="True or False?" ko="읽고 맞으면 O, 틀리면 X 하세요" color={C.teal} />
      <div style={{ display: "grid", gap: 10 }}>
        {TF.map((t, i) => {
          const p = pick[i];
          const ok = p != null && p === t.a;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.soft, borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontFamily: F.disp, fontSize: 17, color: C.ink, flex: 1 }}>{t.q}</span>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => { setPick((s) => ({ ...s, [i]: v })); beep(v === t.a ? "correct" : "wrong"); }}
                  style={{
                    width: 46, height: 40, borderRadius: 10, fontFamily: F.disp, fontWeight: 700, fontSize: 18,
                    cursor: "pointer", border: `2px solid ${C.line}`,
                    background: p === v ? (v === t.a ? C.green : C.coral) : "#fff",
                    color: p === v ? "#fff" : C.ink,
                  }}
                >
                  {v ? "O" : "X"}
                </button>
              ))}
              <span style={{ width: 26, fontSize: 20 }}>{p == null ? "" : ok ? "✅" : "❌"}</span>
              {p != null && !ok && t.hint && (
                <span style={{ fontFamily: F.body, fontSize: 13, color: C.coralDeep }}>{t.hint}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- 2. Find and Drag (실제 드래그: 과거→미래→느낌 순서 분류) ----------- */
const DRAG_ROUNDS = [
  { key: "past", ko: "과거 표현", en: "Past", color: C.teal, emoji: "⏪" },
  { key: "feeling", ko: "느낌 표현", en: "Feeling", color: C.pink, emoji: "💗" },
  { key: "future", ko: "미래 표현", en: "Future", color: C.sky, emoji: "⏩" },
];
const DRAG_WORDS = [
  { w: "ate", cat: "past" }, { w: "made", cat: "past" }, { w: "drew", cat: "past" },
  { w: "visited", cat: "past" }, { w: "got up", cat: "past" },
  { w: "will go back", cat: "future" }, { w: "will miss", cat: "future" },
  { w: "delicious", cat: "feeling" }, { w: "amazing", cat: "feeling" }, { w: "awesome", cat: "feeling" },
];

function FindAndDrag() {
  const [roundIdx, setRoundIdx] = useState(0);
  const [placed, setPlaced] = useState({});   // word -> true
  const [wrong, setWrong] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dw, setDw] = useState(null);          // {w,cat,dx,dy}
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [over, setOver] = useState(false);
  const boxRef = useRef(null);

  const round = DRAG_ROUNDS[roundIdx];
  const pool = DRAG_WORDS.filter((x) => !placed[x.w]);
  const inBox = DRAG_WORDS.filter((x) => placed[x.w] && x.cat === round.key);
  const allDone = DRAG_WORDS.every((x) => placed[x.w]);

  const startDrag = (e, item) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setDw({ w: item.w, cat: item.cat, dx: e.clientX - r.left, dy: e.clientY - r.top });
    setPos({ x: e.clientX, y: e.clientY });
    setDragging(true);
  };

  // 드래그 이동/드롭 처리
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      const r = boxRef.current && boxRef.current.getBoundingClientRect();
      setOver(!!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    };
    const up = (e) => {
      const r = boxRef.current && boxRef.current.getBoundingClientRect();
      const hit = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (dw && hit) {
        if (dw.cat === DRAG_ROUNDS[roundIdx].key) { setPlaced((p) => ({ ...p, [dw.w]: true })); beep("correct"); }
        else { setWrong(dw.w); beep("wrong"); setTimeout(() => setWrong(null), 700); }
      }
      setDragging(false); setOver(false); setDw(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, roundIdx, dw]);

  // 한 라운드 완료 → 다음 라운드로
  useEffect(() => {
    const total = DRAG_WORDS.filter((x) => x.cat === round.key).length;
    const done = DRAG_WORDS.filter((x) => x.cat === round.key && placed[x.w]).length;
    if (total > 0 && done === total && roundIdx < DRAG_ROUNDS.length - 1) {
      beep("star");
      const t = setTimeout(() => setRoundIdx((i) => i + 1), 850);
      return () => clearTimeout(t);
    }
  }, [placed, roundIdx, round.key]);

  const chip = (bg, fg, extra) => ({
    fontFamily: F.disp, fontWeight: 600, fontSize: 18, padding: "10px 18px", borderRadius: 12,
    border: `2px solid ${C.line}`, background: bg, color: fg, userSelect: "none", touchAction: "none",
    ...extra,
  });

  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle n="2" en="Find and Drag!" ko="일기에서 찾아 상자로 끌어다 분류해요" color={C.yellow} />

      {/* 진행 단계 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {DRAG_ROUNDS.map((r, i) => {
          const done = i < roundIdx || allDone;
          const cur = i === roundIdx && !allDone;
          return (
            <span key={r.key} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999,
              fontFamily: F.ko, fontSize: 13, fontWeight: 700,
              background: done ? r.color : cur ? r.color + "22" : "#F2ECE0",
              color: done ? "#fff" : cur ? r.color : "#B0A088",
              border: cur ? `2px solid ${r.color}` : "2px solid transparent",
            }}>
              {done ? "✓" : `${i + 1}`} {r.ko} <span style={{ opacity: 0.8 }}>({r.en})</span>
            </span>
          );
        })}
      </div>

      {allDone ? (
        <div style={{ background: "#EAF7F4", border: `2px solid ${C.teal}`, borderRadius: 16, padding: 18, textAlign: "center", fontFamily: F.ko, fontWeight: 700, color: C.tealDeep }}>
          🎉 과거 · 미래 · 느낌 표현을 모두 분류했어요! ⭐⭐⭐
        </div>
      ) : (
        <>
          <div style={{ fontFamily: F.ko, color: "#7a6e5d", marginBottom: 10 }}>
            지금은 <b style={{ color: round.color }}>{round.ko} ({round.en})</b> 을(를) 상자로 끌어다 놓아요!
          </div>

          {/* 단어 풀 (색 힌트 없이 흰 카드) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            {pool.map((x) => (
              <div
                key={x.w}
                onPointerDown={(e) => startDrag(e, x)}
                style={chip(
                  wrong === x.w ? C.coral : "#fff",
                  wrong === x.w ? "#fff" : C.ink,
                  {
                    cursor: "grab",
                    opacity: dragging && dw && dw.w === x.w ? 0.25 : 1,
                    transform: wrong === x.w ? "translateX(-3px)" : "none",
                    boxShadow: "0 2px 0 rgba(0,0,0,0.06)",
                  }
                )}
              >
                {x.w}
              </div>
            ))}
            {pool.length === 0 && <span style={{ fontFamily: F.ko, color: "#B39A6A" }}>단어를 모두 옮겼어요!</span>}
          </div>

          {/* 분류 상자 (현재 라운드 색) */}
          <div
            ref={boxRef}
            style={{
              background: over ? round.color + "22" : "#FFFDF7",
              border: `3px dashed ${over ? round.color : C.line}`,
              borderRadius: 16, padding: 16, minHeight: 84,
              display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
              transition: "background .1s, border-color .1s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F.ko, fontWeight: 700, color: round.color }}>
              <span style={{ fontSize: 26 }}>{round.emoji}</span>{round.ko} 상자
            </span>
            {inBox.map((x) => (
              <span key={x.w} style={{ background: round.color, color: "#fff", borderRadius: 10, padding: "8px 14px", fontFamily: F.disp, fontWeight: 700 }}>
                ⭐ {x.w}
              </span>
            ))}
          </div>
        </>
      )}

      {/* 드래그 중 손가락을 따라다니는 카드 */}
      {dragging && dw && (
        <div style={{
          position: "fixed", left: pos.x - dw.dx, top: pos.y - dw.dy, zIndex: 9999, pointerEvents: "none",
          ...chip("#fff", C.ink, { boxShadow: "0 10px 20px rgba(0,0,0,0.25)", transform: "rotate(-4deg) scale(1.05)" }),
        }}>
          {dw.w}
        </div>
      )}
    </div>
  );
}

/* ---- 3. Copy and Write (① 마음에 남는 문장 ② Alex에게 답장) ------------- */
function CopyAndWrite() {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const ta = {
    width: "100%", borderRadius: 14, border: `2px solid ${C.line}`, padding: 14,
    fontFamily: F.hand, fontSize: 22, color: C.ink, resize: "vertical", background: "#FFFDF7",
    lineHeight: "34px", boxSizing: "border-box",
  };
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle n="3" en="Copy and Write!" ko="따라 쓰고, Alex에게 답장도 남겨요" color={C.pink} />

      <div style={{ fontFamily: F.ko, color: C.ink, marginBottom: 6 }}>✍️ 마음에 남는 문장을 따라 써봐요</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예) It was the best week ever."
        style={{ ...ta, minHeight: 64 }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Btn small color={C.pink} onClick={() => text.trim() && speak(text, 1)}>🔊 내 문장 듣기</Btn>
      </div>

      <div style={{ fontFamily: F.ko, color: C.ink, margin: "18px 0 4px" }}>💌 Alex의 일기에 답 메시지를 한 문장 써봐요</div>
      <div style={{ fontFamily: F.body, fontSize: 13, color: "#9A8B76", marginBottom: 6 }}>
        예) I will miss you too, Alex! / See you again in Korea!
      </div>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Write your message to Alex..."
        style={{ ...ta, minHeight: 60 }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Btn small color={C.plum} onClick={() => reply.trim() && speak(reply, 1)}>🔊 내 답장 듣기</Btn>
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 2  —  Write & Share
   ========================================================================= */
const BANK = {
  Actions: { color: C.sky, ko: "동작 (과거형)", words: ["went", "played", "ate", "made", "drew", "saw", "visited", "swam", "took", "watched"] },
  Places: { color: C.green, ko: "장소 · 대상", words: ["to Jeju", "to the beach", "to a palace", "traditional games", "bibimbap", "a kite", "pictures", "in the sea", "many photos", "a K-drama"] },
  Feelings: { color: C.pink, ko: "느낌", words: ["amazing", "awesome", "great", "wonderful", "delicious", "fun", "exciting"] },
};

/* 쓰기 전 아이디어 만들기 칸 — 색깔별 예시 조합 포함 (색: 동작=파랑, 장소=초록, 느낌=분홍) */
const IDEA_BOXES = [
  { k: "a", pill: "한 일 ①", q: "첫 번째로 한 일은?", color: C.green,
    ex: [["went", C.sky], [" to the ", null], ["park", C.green]] },
  { k: "b", pill: "한 일 ②", q: "두 번째로 한 일은?", color: C.coral,
    ex: [["ate", C.sky], [" ", null], ["delicious", C.pink], [" chicken", null]] },
  { k: "c", pill: "한 일 ③", q: "세 번째로 한 일은?", color: C.sky,
    ex: [["bought", C.sky], [" at the ", null], ["market", C.green]] },
  { k: "feel", pill: "느낌", q: "기분이 어땠나요?", color: C.yellow,
    ex: [["It was ", null], ["fun", C.pink], [" / ", null], ["exciting", C.pink]] },
];

function WriteShare({ shared, setShared }) {
  const { name, diary, drawing } = shared;
  const set = (patch) => setShared((s) => ({ ...s, ...patch }));
  const [active, setActive] = useState("idea:a");
  const [ideas, setIdeas] = useState({ a: "", b: "", c: "", feel: "" });
  const [feedback, setFeedback] = useState("");
  const [loadingFb, setLoadingFb] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [teacher, setTeacher] = useState(false);
  const [selfStars, setSelfStars] = useState(0);

  const fields = { we1: diary.we1, we2: diary.we2, free: diary.free, feeling: diary.feeling };
  const setField = (k, v) => set({ diary: { ...diary, [k]: v } });
  // 카드를 누르면 현재 선택된 칸(아이디어 칸 or 일기 빈칸)에 들어감
  const tapCard = (word) => {
    if (active.startsWith("idea:")) {
      const k = active.slice(5);
      setIdeas((s) => ({ ...s, [k]: (s[k] ? s[k].trim() + " " : "") + word }));
    } else {
      const cur = fields[active] || "";
      setField(active, (cur ? cur.trim() + " " : "") + word);
    }
  };

  const fullDiary =
    `This week, my friend Alex visited Korea.\n` +
    `We ${diary.we1 || "..."}.\n` +
    `We ${diary.we2 || "..."}.\n` +
    `${diary.free || "..."}.\n` +
    `It was ${diary.feeling || "..."}.\n` +
    `Alex will go back to the USA tomorrow.\nI will miss Alex.` +
    (diary.more1 ? `\n${diary.more1}` : "") +
    (diary.more2 ? `\n${diary.more2}` : "");

  const selfCheck = {
    cap: /^[A-Z]/.test((diary.free || "").trim()) || !diary.free,
    end: /[.!?]$/.test((diary.free || "").trim()) || !diary.free,
  };

  const getFeedback = async () => {
    setLoadingFb(true);
    setFeedback("");
    try {
      const out = await callClaude([{ role: "user", content: `내 영어 일기야:\n\n${fullDiary}` }], SYS_FEEDBACK, 700);
      setFeedback(out || "잠깐 문제가 생겼어요. 다시 눌러볼까요?");
    } catch (e) {
      setFeedback("연결이 잠깐 끊겼어요. 다시 눌러볼까요? 🙏");
    }
    setLoadingFb(false);
  };

  const submit = async () => {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    await storeSet("submission:" + id, { name: name || "이름없음", diary: fullDiary, drawing, stars: selfStars, ts: Date.now() });
    setSubmitted(true);
    beep("star");
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* 이름 */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.ko, fontSize: 18, color: C.ink }}>✏️ 내 이름</span>
          <input
            value={name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="이름을 적어요 (친구와 공유할 때 보여요)"
            style={{ flex: 1, minWidth: 200, border: `2px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontFamily: F.body, fontSize: 16 }}
          />
        </div>
      </Card>

      {/* 단어 도우미 */}
      <Card>
        <SectionTitle n="1" en="Word Bank" ko="색깔 카드를 조합해 문장을 만들어요" color={C.sky} />
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(BANK).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: F.disp, fontWeight: 700, color: v.color, fontSize: 15, marginBottom: 6 }}>
                {k} <span style={{ fontFamily: F.ko, color: "#9A8B76", fontSize: 13 }}>· {v.ko}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {v.words.map((w) => (
                  <button
                    key={w}
                    onClick={() => tapCard(w)}
                    style={{
                      background: v.color + "22", color: v.color, border: `2px solid ${v.color}`,
                      borderRadius: 10, padding: "6px 12px", fontFamily: F.disp, fontWeight: 600, fontSize: 15, cursor: "pointer",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, background: C.soft, borderRadius: 12, padding: "10px 14px", fontFamily: F.body, fontSize: 14, color: "#6E5F4C", lineHeight: 1.7 }}>
          💡 예시: <b>We went to Jeju.</b> / <b>We ate bibimbap.</b> / <b>We made a kite.</b> / <b>It was amazing.</b>
        </div>
      </Card>

      {/* 쓰기 전 아이디어 만들기 */}
      <Card>
        <SectionTitle n="2" en="Make Your Ideas" ko="Alex와 한 일을 떠올려 각 칸에 아이디어를 써요" color={C.yellow} />
        <div style={{ background: "#FFF6E0", borderRadius: 12, padding: "10px 14px", fontFamily: F.body, fontSize: 14, color: "#7a6535", lineHeight: 1.7, marginBottom: 12 }}>
          💡 위 <b>단어 도우미(Word Bank)</b> 카드를 눌러 조합하면 <b>지금 선택된 칸</b>에 단어가 쏙 들어가요! ✍️
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {IDEA_BOXES.map((b) => {
            const on = active === "idea:" + b.k;
            return (
              <div key={b.k} style={{ background: b.color + "14", border: `2px solid ${on ? b.color : b.color + "55"}`, borderRadius: 16, padding: 14, transition: "border-color .1s" }}>
                <span style={{ background: b.color, color: "#fff", borderRadius: 999, padding: "3px 12px", fontFamily: F.ko, fontWeight: 700, fontSize: 13 }}>{b.pill}</span>
                <div style={{ fontFamily: F.ko, color: "#9A8B76", marginTop: 10, fontSize: 15 }}>{b.q}</div>
                <input
                  value={ideas[b.k]}
                  onFocus={() => setActive("idea:" + b.k)}
                  onChange={(e) => setIdeas((s) => ({ ...s, [b.k]: e.target.value }))}
                  placeholder="여기에 써요"
                  style={{ width: "100%", border: "none", borderBottom: `2px solid ${on ? b.color : "#D8C6A6"}`, background: on ? "#fff" : "transparent", fontFamily: F.disp, fontSize: 16, color: C.ink, padding: "6px 4px", marginTop: 8, outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 10, fontFamily: F.body, fontSize: 13, color: "#8a7d6a", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  🔒 예:
                  {b.ex.map(([t, c], i) =>
                    c ? (
                      <span key={i} style={{ background: c + "22", color: c, border: `1px solid ${c}`, borderRadius: 8, padding: "1px 7px", fontFamily: F.disp, fontWeight: 600 }}>{t}</span>
                    ) : (
                      <span key={i}>{t}</span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 나의 일기 */}
      <Card>
        <SectionTitle n="3" en="Write Your Diary" ko="아이디어를 문장으로 옮겨 나의 일기를 완성해요" color={C.coral} />
        <div style={{ background: "#FFFDF7", borderRadius: 14, padding: 18, border: `2px solid ${C.line}`, fontFamily: F.disp, fontSize: 19, color: C.ink, lineHeight: 2.1 }}>
          <div>This week, my friend Alex visited Korea.</div>
          <div>
            We{" "}
            <Blank v={diary.we1} onF={() => setActive("we1")} on={active === "we1"} onChange={(x) => setField("we1", x)} ph="한 일 1" />.
          </div>
          <div>
            We{" "}
            <Blank v={diary.we2} onF={() => setActive("we2")} on={active === "we2"} onChange={(x) => setField("we2", x)} ph="한 일 2" />.
          </div>
          <div>
            <Blank wide v={diary.free} onF={() => setActive("free")} on={active === "free"} onChange={(x) => setField("free", x)} ph="한 일 3 (자유 문장)" />.
          </div>
          <div>
            It was{" "}
            <Blank v={diary.feeling} onF={() => setActive("feeling")} on={active === "feeling"} onChange={(x) => setField("feeling", x)} ph="느낌" />.
          </div>
          <div>Alex will go back to the USA tomorrow.</div>
          <div>I will miss Alex.</div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `2px dashed ${C.line}` }}>
            <div style={{ fontFamily: F.ko, fontSize: 15, color: C.coralDeep, marginBottom: 6 }}>
              ✏️ More to write! <span style={{ color: "#9A8B76", fontFamily: F.body, fontSize: 13 }}>더 쓰고 싶으면 자유롭게 써요 (선택)</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <Blank wide v={diary.more1} onF={() => setActive("more1")} on={active === "more1"} onChange={(x) => setField("more1", x)} ph="자유 문장 1" />
            </div>
            <div>
              <Blank wide v={diary.more2} onF={() => setActive("more2")} on={active === "more2"} onChange={(x) => setField("more2", x)} ph="자유 문장 2" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Btn small color={C.plum} onClick={() => speak(fullDiary.replace(/\n/g, " "), 1)}>🔊 내 일기 듣기</Btn>
          <Btn small color={C.teal} onClick={getFeedback} disabled={loadingFb}>
            {loadingFb ? "🤖 확인 중..." : "🤖 AI 선생님 피드백"}
          </Btn>
          <Recorder color={C.pink} label="🎙 내 일기 녹음" />
        </div>

        {/* Self Check + 스스로 별점 자기평가 */}
        <div style={{ marginTop: 12, background: C.soft, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: F.ko, color: C.ink, fontWeight: 700 }}>Self Check</span>
            <span style={{ fontFamily: F.body, fontSize: 14, color: selfCheck.cap ? C.green : "#B0987A" }}>
              {selfCheck.cap ? "✅" : "⬜"} 문장 첫 글자를 대문자로 썼나요?
            </span>
            <span style={{ fontFamily: F.body, fontSize: 14, color: selfCheck.end ? C.green : "#B0987A" }}>
              {selfCheck.end ? "✅" : "⬜"} 마침표(.)나 느낌표(!)를 썼나요?
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap", borderTop: `1px dashed ${C.line}`, paddingTop: 10 }}>
            <span style={{ fontFamily: F.ko, color: C.ink }}>⭐ 오늘 내 일기, 스스로 별점을 줘요!</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => { setSelfStars(n); beep(n >= 4 ? "star" : "correct"); }}
                  aria-label={`${n}점`}
                  style={{
                    background: "none", border: "none", cursor: "pointer", fontSize: 30, padding: "0 1px", lineHeight: 1,
                    filter: n <= selfStars ? "none" : "grayscale(1) opacity(0.35)",
                    transform: n <= selfStars ? "scale(1.05)" : "scale(1)", transition: "transform .1s",
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
            {selfStars > 0 && (
              <span style={{ fontFamily: F.ko, color: C.coralDeep, fontWeight: 700 }}>{selfStars}점!</span>
            )}
          </div>
        </div>

        {feedback && (
          <div style={{ marginTop: 12, background: "#EAF7F4", borderRadius: 14, padding: 16, border: `2px solid ${C.teal}`, fontFamily: F.body, fontSize: 15, color: "#2c4a45", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            <b style={{ color: C.tealDeep }}>🤖 AI 선생님</b>
            <div style={{ marginTop: 6 }}>{feedback}</div>
          </div>
        )}
      </Card>

      {/* 그림 그리기 */}
      <Card>
        <SectionTitle n="4" en="My Illustration" ko="일기 내용을 그림으로 그려요" color={C.plum} />
        <DrawBoard value={drawing} onSave={(url) => set({ drawing: url })} />
      </Card>

      {/* 공유/제출 */}
      <Card style={{ background: "linear-gradient(135deg,#FFF0E6,#FFF8E8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Btn color={C.coral} onClick={submit} disabled={submitted}>
            {submitted ? "✅ 제출 완료!" : "📤 친구들과 공유하기(제출)"}
          </Btn>
          <span style={{ fontFamily: F.ko, color: "#9A8B76", fontSize: 14 }}>
            제출하면 선생님 화면에서 확인할 수 있어요.
          </span>
          <button
            onClick={() => setTeacher((t) => !t)}
            style={{ marginLeft: "auto", background: "#fff", border: `2px solid ${C.line}`, borderRadius: 10, padding: "8px 14px", fontFamily: F.ko, cursor: "pointer", color: C.ink }}
          >
            👩‍🏫 교사용 모드 {teacher ? "닫기" : "열기"}
          </button>
        </div>
        {teacher && <TeacherView />}
      </Card>
    </div>
  );
}

function Blank({ v, onChange, onF, on, ph, wide }) {
  return (
    <input
      value={v}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onF}
      placeholder={ph}
      style={{
        display: "inline-block", minWidth: wide ? 320 : 150, maxWidth: "90%",
        border: "none", borderBottom: `3px solid ${on ? C.coral : "#D8C6A6"}`,
        background: on ? "#FFF3EA" : "transparent", fontFamily: F.disp, fontSize: 19,
        color: C.coralDeep, padding: "2px 8px", outline: "none",
      }}
    />
  );
}

function TeacherView() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const rows = await storeList("submission:");
    rows.sort((a, b) => (b.value.ts || 0) - (a.value.ts || 0));
    setSubs(rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const withPast = subs.map((s) => ({ ...s, past: countPastVerbs(s.value.diary || "").size }));
  const achieved = withPast.filter((s) => s.past >= 3).length;
  const rated = subs.filter((s) => s.value.stars > 0);
  const avgStars = rated.length ? (rated.reduce((a, s) => a + s.value.stars, 0) / rated.length).toFixed(1) : "-";
  const fmt = (ts) => { try { const d = new Date(ts); return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0"); } catch (e) { return ""; } };

  return (
    <div style={{ marginTop: 14 }}>
      {/* 요약 대시보드 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {[
          { label: "제출", val: `${subs.length}명`, color: C.teal },
          { label: "과거형 3개↑ 달성", val: `${achieved}명`, color: C.green },
          { label: "평균 자기평가", val: `⭐ ${avgStars}`, color: C.coral },
        ].map((k) => (
          <div key={k.label} style={{ background: k.color + "18", border: `2px solid ${k.color}`, borderRadius: 12, padding: "8px 14px", fontFamily: F.ko, minWidth: 96 }}>
            <span style={{ color: "#7a6e5d", fontSize: 12 }}>{k.label}</span>
            <div style={{ color: k.color, fontWeight: 700, fontFamily: F.disp, fontSize: 18 }}>{k.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}><Btn small color={C.teal} onClick={load}>🔄 새로고침</Btn></div>
      </div>

      {loading ? (
        <div style={{ fontFamily: F.body, color: "#9A8B76" }}>불러오는 중...</div>
      ) : subs.length === 0 ? (
        <div style={{ fontFamily: F.body, color: "#9A8B76" }}>아직 제출한 학생이 없어요.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {withPast.map((s) => (
            <div key={s.key} style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: F.ko, fontWeight: 700, color: C.coralDeep }}>👦 {s.value.name}</span>
                <span style={{ background: C.green, color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontFamily: F.ko }}>✓ 제출 {fmt(s.value.ts)}</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: F.body, fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: s.past >= 3 ? C.tealDeep : "#9A8B76", fontWeight: 600 }}>과거형 {s.past}개 {s.past >= 3 ? "🌸🌸🌸" : ""}</span>
                <span style={{ color: "#9A8B76" }}>자기평가 {s.value.stars > 0 ? "⭐".repeat(s.value.stars) : "-"}</span>
              </div>
              {s.value.drawing && <img alt="" src={s.value.drawing} style={{ width: "100%", borderRadius: 8, marginBottom: 6, border: `1px solid ${C.line}` }} />}
              <div style={{ fontFamily: F.body, fontSize: 13, color: "#5b5147", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.value.diary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- 녹음 컴포넌트 ------------------------------------------------------- */
function Recorder({ color = C.pink, label = "🎙 녹음" }) {
  const [rec, setRec] = useState(false);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const mr = useRef(null);
  const chunks = useRef([]);

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      m.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      m.start();
      mr.current = m;
      setRec(true);
    } catch (e) {
      setErr("마이크를 사용할 수 없어요. 태블릿 마이크 권한을 확인해 주세요.");
    }
  };
  const stop = () => { mr.current && mr.current.stop(); setRec(false); };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Btn small color={rec ? C.coral : color} onClick={rec ? stop : start}>
        {rec ? "⏹ 녹음 멈추기" : label}
      </Btn>
      {url && <audio controls src={url} style={{ height: 34 }} />}
      {err && <span style={{ fontFamily: F.body, fontSize: 12, color: C.coralDeep }}>{err}</span>}
    </span>
  );
}

/* ---- 디지털 드로잉 보드 ------------------------------------------------- */
const PENS = ["#3A3330", C.coral, C.yellow, C.teal, C.sky, C.plum, C.pink, C.green, "#8B5E34", "#ffffff"];
function DrawBoard({ value, onSave }) {
  const cvs = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#3A3330");
  const [size, setSize] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = cvs.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FFFDF7";
    ctx.fillRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, []);

  const pos = (e) => {
    const c = cvs.current;
    const r = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: (x / r.width) * c.width, y: (y / r.height) * c.height };
  };
  const down = (e) => { e.preventDefault(); drawing.current = true; const p = pos(e); const ctx = cvs.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = cvs.current.getContext("2d");
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = cvs.current; const ctx = c.getContext("2d");
    ctx.fillStyle = "#FFFDF7"; ctx.fillRect(0, 0, c.width, c.height); setSaved(false);
  };
  const save = () => { onSave(cvs.current.toDataURL("image/png")); setSaved(true); beep("correct"); };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {PENS.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{
            width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer",
            border: color === c ? `3px solid ${C.ink}` : `2px solid ${C.line}`,
          }} />
        ))}
        <span style={{ marginLeft: 8, fontFamily: F.ko, fontSize: 13, color: "#9A8B76" }}>굵기</span>
        {[3, 6, 12].map((s) => (
          <button key={s} onClick={() => setSize(s)} style={{
            width: 34, height: 30, borderRadius: 8, background: size === s ? C.ink : "#fff", cursor: "pointer",
            border: `2px solid ${C.line}`, color: size === s ? "#fff" : C.ink, fontFamily: F.disp,
          }}>{s}</button>
        ))}
        <button onClick={clear} style={{ marginLeft: "auto", background: "#fff", border: `2px solid ${C.line}`, borderRadius: 10, padding: "6px 12px", fontFamily: F.ko, cursor: "pointer", color: C.ink }}>🧽 지우기</button>
      </div>
      <canvas
        ref={cvs}
        width={720}
        height={420}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up}
        style={{ width: "100%", aspectRatio: "720/420", borderRadius: 14, border: `2px solid ${C.line}`, touchAction: "none", background: "#FFFDF7", cursor: "crosshair" }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <Btn color={saved ? C.green : C.plum} onClick={save}>{saved ? "✅ 그림 저장됨 (3단계 반영)" : "🎨 그림 완성하기"}</Btn>
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 3  —  My Art Gallery
   ========================================================================= */
function ArtGallery({ shared }) {
  const { name, diary, drawing } = shared;
  const [showDiary, setShowDiary] = useState(false);

  const fullDiary =
    `This week, my friend Alex visited Korea.\nWe ${diary.we1 || "..."}.\nWe ${diary.we2 || "..."}.\n${diary.free || "..."}.\nIt was ${diary.feeling || "..."}.\nAlex will go back to the USA tomorrow.\nI will miss Alex.` +
    (diary.more1 ? `\n${diary.more1}` : "") +
    (diary.more2 ? `\n${diary.more2}` : "");

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* 액자 */}
      <Card style={{ background: "linear-gradient(160deg,#F6EEDD,#EFE3CB)" }}>
        <SectionTitle en="My Art Gallery" ko="내가 그린 그림을 감상해요" color={C.plum} />
        <div style={{ display: "grid", placeItems: "center" }}>
          <div style={{
            background: "linear-gradient(145deg,#B98B4E,#8B5E34)", padding: 16, borderRadius: 10,
            boxShadow: "0 14px 30px rgba(90,60,20,0.35)",
          }}>
            <div style={{ background: "#fff", padding: 8, borderRadius: 4 }}>
              {drawing ? (
                <img alt="my art" src={drawing} style={{ display: "block", width: "min(560px,80vw)", borderRadius: 2 }} />
              ) : (
                <div style={{ width: "min(560px,80vw)", height: 300, display: "grid", placeItems: "center", fontFamily: F.ko, color: "#B39A6A" }}>
                  2단계에서 그림을 완성하면 여기 액자에 걸려요 🖼
                </div>
              )}
            </div>
            <div style={{ textAlign: "center", fontFamily: F.hand, color: "#fff", fontSize: 20, marginTop: 8 }}>
              🎨 {name || "이름없음"}'s Artwork
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <Btn small color={C.teal} onClick={() => setShowDiary((v) => !v)}>📖 내가 쓴 일기도 확인해봐요</Btn>
        </div>
        {showDiary && (
          <div style={{ marginTop: 12, background: "#FFFDF7", borderRadius: 12, padding: 16, border: `2px solid ${C.line}`, fontFamily: F.hand, fontSize: 20, color: "#4a4038", whiteSpace: "pre-wrap", lineHeight: 1.7, textAlign: "center" }}>
            {fullDiary}
          </div>
        )}
      </Card>

      <ObserveTimer />
      <LumiChat drawing={drawing} />
      <ArtBloom drawing={drawing} name={name} />
    </div>
  );
}

/* ---- Step 1. 1분 관찰 타이머 ------------------------------------------- */
function ObserveTimer() {
  const [left, setLeft] = useState(60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    if (left <= 0) { setRun(false); beep("star"); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [run, left]);
  const R = 70, CIRC = 2 * Math.PI * R;
  const ratio = left / 60;
  return (
    <Card>
      <SectionTitle n="1" en="Look Closely (1 min)" ko="1분 동안 그림 구석구석의 이야기를 상상하며 살펴보세요" color={C.coral} />
      <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 170, height: 170 }}>
          <svg width="170" height="170" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="85" cy="85" r={R} fill="none" stroke={C.line} strokeWidth="12" />
            <circle cx="85" cy="85" r={R} fill="none" stroke={C.coral} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ratio)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: F.disp, fontSize: 40, fontWeight: 700, color: C.coralDeep }}>
            {left}
          </div>
        </div>
        {left === 0 ? (
          <div style={{ fontFamily: F.ko, color: C.tealDeep, fontWeight: 700 }}>관찰 완료! 이제 루미와 이야기해볼까요? 🌟</div>
        ) : (
          <Btn color={run ? C.plum : C.coral} onClick={() => { if (!run && left === 0) setLeft(60); setRun((r) => !r); }}>
            {run ? "⏸ 잠깐 멈추기" : left < 60 ? "▶ 이어서 관찰하기" : "⏱ 1분 관찰 타이머 시작"}
          </Btn>
        )}
      </div>
    </Card>
  );
}

/* ---- Step 2. 루미와 대화 (AI, 그림을 함께 봄) --------------------------- */
function LumiChat({ drawing }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [msgs, busy]);

  const toApi = (history) =>
    history.map((m) => ({ role: m.role, content: m.content }));

  const firstImageContent = () => {
    if (!drawing) return [{ type: "text", text: "안녕 루미! 내 그림을 보고 이야기해줘." }];
    const b64 = drawing.split(",")[1];
    return [
      { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
      { type: "text", text: "이건 내가 그린 그림이야. 함께 감상해줘!" },
    ];
  };

  const start = async () => {
    setStarted(true);
    setBusy(true);
    try {
      const out = await callClaude([{ role: "user", content: firstImageContent() }], SYS_LUMI, 400);
      setMsgs([{ role: "assistant", content: out || "안녕! 나는 루미야 🌙 네 그림이 정말 궁금해!" }]);
    } catch (e) {
      setMsgs([{ role: "assistant", content: "안녕! 나는 루미야 🌙 (연결이 잠깐 느려요) 네 그림에서 가장 마음에 드는 곳은 어디야?" }]);
    }
    setBusy(false);
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    const mine = { role: "user", content: input.trim() };
    const next = [...msgs, mine];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      // 첫 메시지에 그림 이미지를 넣어 문맥을 유지
      const apiMsgs = [
        { role: "user", content: firstImageContent() },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const out = await callClaude(apiMsgs, SYS_LUMI, 400);
      setMsgs((s) => [...s, { role: "assistant", content: out || "우와, 더 이야기해줄래? 😊" }]);
    } catch (e) {
      setMsgs((s) => [...s, { role: "assistant", content: "(연결이 잠깐 느려요) 그 부분을 왜 그렸는지 더 말해줄래? 🙂" }]);
    }
    setBusy(false);
  };

  return (
    <Card>
      <SectionTitle n="2" en="Talk with Lumi" ko="AI 감상 친구 루미와 그림 이야기를 나눠요" color={C.plum} />
      {!started ? (
        <div style={{ display: "grid", placeItems: "center", gap: 12, padding: "10px 0" }}>
          <div style={{ fontSize: 48 }}>🌙</div>
          <div style={{ fontFamily: F.ko, color: "#7a6e5d", textAlign: "center" }}>
            루미가 네 그림을 함께 보고 이야기를 시작할 거예요.
          </div>
          <Btn color={C.plum} onClick={start}>💬 루미와 대화 시작하기</Btn>
        </div>
      ) : (
        <>
          <div ref={scrollRef} style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 10, padding: 4 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: 16, fontFamily: F.body, fontSize: 15, lineHeight: 1.6,
                  background: m.role === "user" ? C.sky : "#F1ECFB",
                  color: m.role === "user" ? "#fff" : "#40355f",
                  borderBottomRightRadius: m.role === "user" ? 4 : 16,
                  borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                }}>
                  {m.role === "assistant" && <b style={{ color: C.plumDeep }}>루미 🌙 </b>}
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div style={{ fontFamily: F.body, color: "#9A8B76", fontSize: 14 }}>루미가 생각 중... 💭</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="루미에게 이야기해요..."
              style={{ flex: 1, border: `2px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontFamily: F.body, fontSize: 15 }}
            />
            <Btn small color={C.plum} onClick={send} disabled={busy}>보내기</Btn>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---- Step 3 & 4. 예술 꽃 피우기 + 작품 제목 + 갤러리 공유 --------------- */
/* 과거형 문장 틀 — 동사가 이미 과거형이라 학생이 시제를 틀릴 수 없음 */
const PAST_FRAMES = ["I drew ", "I went to ", "I saw ", "I made ", "We played ", "It was ", "I felt ", "I remembered "];

function ArtBloom({ drawing, name }) {
  const [ko, setKo] = useState("");
  const [en, setEn] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [reasonEn, setReasonEn] = useState("");
  const [stars, setStars] = useState(0);
  const [checked, setChecked] = useState(false);
  const [busyT1, setBusyT1] = useState(false);
  const [busyT2, setBusyT2] = useState(false);
  const [shared, setShared] = useState(false);

  const translate = async (src, setter, setBusy) => {
    if (!src.trim()) return;
    setBusy(true);
    try {
      const out = await callClaude([{ role: "user", content: src }], SYS_TRANSLATE, 300);
      setter(out || "");
    } catch (e) {}
    setBusy(false);
  };

  const treasure = () => {
    const found = countPastVerbs(en);
    const s = found.size >= 3 ? 3 : found.size;
    setStars(s);
    setChecked(true);
    beep(s >= 3 ? "star" : "correct");
  };

  // 과거형 문장 틀을 영어 칸에 이어 붙임 (새 줄로)
  const addFrame = (f) => {
    setEn((prev) => (prev.trim() ? prev.replace(/\s+$/, "") + "\n" : "") + f);
    setChecked(false);
  };

  const shareGallery = async () => {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    await storeSet("gallery:" + id, {
      name: name || "이름없음", drawing, title, reason, reasonEn, ko, en, stars, ts: Date.now(), comments: [],
    });
    setShared(true);
    beep("star");
  };

  return (
    <>
      {/* Step 3 */}
      <Card>
        <SectionTitle n="3" en="Let Your Art Bloom" ko="그때의 순간을 떠올려, 과거형으로 마음을 피워요" color={C.pink} />
        <div style={{ display: "grid", gap: 12 }}>
          {/* 한국어: 과거 순간으로 앵커링 */}
          <div>
            <label style={{ fontFamily: F.ko, color: C.ink }}>🇰🇷 한국어로 남기는 내 마음</label>
            <div style={{ fontFamily: F.body, fontSize: 13, color: "#9A8B76", margin: "4px 0 2px" }}>
              이 그림은 어떤 순간을 담았나요? <b>그때</b> 무엇을 <b>했고</b>, 어떤 기분이었나요?
            </div>
            <textarea value={ko} onChange={(e) => setKo(e.target.value)} placeholder="예) 나는 제주 바다에서 헤엄쳤다. 정말 시원하고 신났다."
              style={{ width: "100%", minHeight: 70, borderRadius: 12, border: `2px solid ${C.line}`, padding: 12, fontFamily: F.body, fontSize: 15, marginTop: 6, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          {/* 영어: 과거형 문장 틀 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontFamily: F.ko, color: C.ink }}>🌸 영어로 피워보는 내 마음</label>
              <Btn small color={C.plum} onClick={() => translate(ko, setEn, setBusyT1)} disabled={busyT1 || !ko.trim()}>
                {busyT1 ? "루미 번역 중..." : "🌙 루미 도움 받기"}
              </Btn>
            </div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: "#9A8B76", margin: "8px 0 4px" }}>
              ⏪ 문장 틀을 눌러 시작해요 — <b>동사가 이미 과거형</b>이에요!
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {PAST_FRAMES.map((f) => (
                <button key={f} onClick={() => addFrame(f)}
                  style={{ background: C.teal + "18", color: C.tealDeep, border: `2px solid ${C.teal}`, borderRadius: 10, padding: "6px 12px", fontFamily: F.disp, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
                  {f}___
                </button>
              ))}
            </div>
            <textarea value={en} onChange={(e) => { setEn(e.target.value); setChecked(false); }} placeholder="I played with Alex. It was amazing..."
              style={{ width: "100%", minHeight: 80, borderRadius: 12, border: `2px solid ${C.line}`, padding: 12, fontFamily: F.disp, fontSize: 16, marginTop: 6, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          {/* 보물찾기 → 꽃 보상 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn color={C.yellow} style={{ color: C.ink }} onClick={treasure} disabled={!en.trim()}>💎 과거 시제 보물찾기</Btn>
            {checked && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F.ko, color: C.ink }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ fontSize: 28, filter: i < stars ? "none" : "grayscale(1) opacity(.35)" }}>🌸</span>
                ))}
                <span style={{ marginLeft: 6, color: stars >= 3 ? C.tealDeep : "#9A8B76" }}>
                  {stars >= 3 ? "과거형 3개 이상! 꽃 3송이가 피었어요 🎉" : `과거형 ${stars}개 — 3개 이상 쓰면 꽃 3송이!`}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Step 4 */}
      <Card>
        <SectionTitle n="4" en="Name Your Artwork" ko="내 작품에 멋진 이름을 붙여요" color={C.teal} />
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontFamily: F.ko, color: C.ink }}>🏷 작품 제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 제주의 파란 바다"
              style={{ width: "100%", borderRadius: 12, border: `2px solid ${C.line}`, padding: "10px 12px", fontFamily: F.body, fontSize: 16, marginTop: 6, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontFamily: F.ko, color: C.ink }}>💭 왜 이 장면을 그렸나요? (한 문장)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="이 장면을 그린 이유를 적어요."
              style={{ width: "100%", borderRadius: 12, border: `2px solid ${C.line}`, padding: "10px 12px", fontFamily: F.body, fontSize: 16, marginTop: 6, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontFamily: F.ko, color: "#9A8B76" }}>(선택) 영어로도 적어볼까?</label>
              <Btn small color={C.plum} onClick={() => translate(reason, setReasonEn, setBusyT2)} disabled={busyT2 || !reason.trim()}>
                {busyT2 ? "루미 번역 중..." : "🌙 루미 도움 받기"}
              </Btn>
            </div>
            <input value={reasonEn} onChange={(e) => setReasonEn(e.target.value)} placeholder="I drew this because..."
              style={{ width: "100%", borderRadius: 12, border: `2px solid ${C.line}`, padding: "10px 12px", fontFamily: F.disp, fontSize: 16, marginTop: 6, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn color={shared ? C.green : C.coral} onClick={shareGallery} disabled={shared || !title.trim()}>
              {shared ? "✅ 우리 반 미술관에 전시됨" : "🖼 우리 반 미술관에 공유하기"}
            </Btn>
          </div>
        </div>
      </Card>

      <ClassGallery />
    </>
  );
}

/* ---- 우리 반 미술관 (공유 갤러리 + 댓글) -------------------------------- */
function ClassGallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const rows = await storeList("gallery:");
    rows.sort((a, b) => (b.value.ts || 0) - (a.value.ts || 0));
    setItems(rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addComment = async (row, text, who) => {
    if (!text.trim()) return;
    const val = { ...row.value, comments: [...(row.value.comments || []), { who: who || "친구", text: text.trim(), ts: Date.now() }] };
    await storeSet(row.key, val);
    setItems((its) => its.map((it) => (it.key === row.key ? { ...it, value: val } : it)));
  };

  return (
    <Card style={{ background: "linear-gradient(135deg,#F3ECFB,#EAF7F4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SectionTitle en="Our Class Gallery" ko="우리 반 미술관 · 친구 작품에 댓글을 남겨요" color={C.plum} />
        <div style={{ marginLeft: "auto" }}><Btn small color={C.teal} onClick={load}>🔄 새로고침</Btn></div>
      </div>
      {loading ? (
        <div style={{ fontFamily: F.body, color: "#9A8B76" }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ fontFamily: F.body, color: "#9A8B76" }}>아직 전시된 작품이 없어요. 첫 작품을 공유해 보세요! 🎨</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {items.map((row) => <GalleryCard key={row.key} row={row} onComment={addComment} />)}
        </div>
      )}
    </Card>
  );
}
function GalleryCard({ row, onComment }) {
  const v = row.value;
  const [c, setC] = useState("");
  const [who, setWho] = useState("");
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 12, border: `2px solid ${C.line}`, boxShadow: "0 6px 16px rgba(120,90,40,0.1)" }}>
      <div style={{ background: "linear-gradient(145deg,#B98B4E,#8B5E34)", padding: 6, borderRadius: 8 }}>
        {v.drawing ? <img alt="" src={v.drawing} style={{ display: "block", width: "100%", borderRadius: 4, background: "#fff" }} />
          : <div style={{ height: 140, background: "#fff", borderRadius: 4, display: "grid", placeItems: "center", color: "#B39A6A", fontFamily: F.ko }}>그림 없음</div>}
      </div>
      <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 17, color: C.ink, marginTop: 8 }}>
        “{v.title}” {v.stars >= 3 && "🌸🌸🌸"}
      </div>
      <div style={{ fontFamily: F.ko, fontSize: 13, color: C.coralDeep }}>by {v.name}</div>
      {v.reason && <div style={{ fontFamily: F.body, fontSize: 13, color: "#5b5147", marginTop: 4, lineHeight: 1.5 }}>💭 {v.reason}</div>}
      {v.reasonEn && <div style={{ fontFamily: F.disp, fontSize: 13, color: "#7a6a9a", marginTop: 2 }}>{v.reasonEn}</div>}

      <div style={{ marginTop: 10, borderTop: `1px dashed ${C.line}`, paddingTop: 8 }}>
        {(v.comments || []).map((cm, i) => (
          <div key={i} style={{ fontFamily: F.body, fontSize: 13, color: "#5b5147", marginBottom: 4 }}>
            <b style={{ color: C.tealDeep }}>{cm.who}</b> {cm.text}
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="이름"
            style={{ width: 66, border: `2px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: F.body, fontSize: 13 }} />
          <input value={c} onChange={(e) => setC(e.target.value)} placeholder="댓글 달기"
            onKeyDown={(e) => { if (e.key === "Enter") { onComment(row, c, who); setC(""); } }}
            style={{ flex: 1, border: `2px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: F.body, fontSize: 13 }} />
          <Btn small color={C.pink} onClick={() => { onComment(row, c, who); setC(""); }}>↩</Btn>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   APP  (상단 네비 + 3단계)
   ========================================================================= */
const STAGES = [
  { id: 1, en: "Read & Learn", ko: "읽고 배우기", emoji: "📖", color: C.coral },
  { id: 2, en: "Write & Share", ko: "쓰고 나누기", emoji: "✍️", color: C.teal },
  { id: 3, en: "My Art Gallery", ko: "나의 미술관", emoji: "🎨", color: C.plum },
];

export default function App() {
  const [stage, setStage] = useState(1);
  const [shared, setShared] = useState({
    name: "",
    diary: { we1: "", we2: "", free: "", feeling: "" },
    drawing: null,
  });

  // 폰트 로드
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Jua&family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap";
    document.head.appendChild(l);
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }, []);

  const cur = STAGES.find((s) => s.id === stage);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: F.body, color: C.ink, paddingBottom: 60 }}>
      {/* 헤더 */}
      <div style={{ background: "linear-gradient(120deg,#FF8A5B,#FF6B8B,#6C5CE7)", padding: "18px 20px 26px", color: "#fff" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 30, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 10 }}>
            ✈️ Lesson 7. It Was a Great Week!
          </div>
          <div style={{ fontFamily: F.ko, opacity: 0.95, marginTop: 4, fontSize: 15 }}>
            과거형 동사로 나의 경험과 느낌을 표현하고, 미술 작품으로 감상해요 · <b>5차시</b>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(255,255,255,0.22)", borderRadius: 999, padding: "4px 12px", fontFamily: F.disp, fontSize: 13 }}>
              🔑 We + 과거형. / It was ~!
            </span>
            <span style={{ background: "rgba(255,255,255,0.22)", borderRadius: 999, padding: "4px 12px", fontFamily: F.disp, fontSize: 13 }}>
              past verbs · feelings
            </span>
          </div>
        </div>
      </div>

      {/* 단계 탭 */}
      <div style={{ maxWidth: 940, margin: "-16px auto 0", padding: "0 16px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", gap: 10, background: "#fff", borderRadius: 18, padding: 8, boxShadow: "0 8px 24px rgba(150,120,70,0.18)" }}>
          {STAGES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStage(s.id)}
              style={{
                flex: 1, border: "none", cursor: "pointer", borderRadius: 12, padding: "12px 8px",
                background: stage === s.id ? s.color : "transparent",
                color: stage === s.id ? "#fff" : "#8a7d6a", transition: "all .15s",
              }}
            >
              <div style={{ fontSize: 22 }}>{s.emoji}</div>
              <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 15 }}>{s.id}. {s.en}</div>
              <div style={{ fontFamily: F.ko, fontSize: 12, opacity: 0.9 }}>{s.ko}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 940, margin: "20px auto 0", padding: "0 16px" }}>
        {stage === 1 && (
          <>
            <ReadyToWrite />
            <AlexDiary />
          </>
        )}
        {stage === 2 && <WriteShare shared={shared} setShared={setShared} />}
        {stage === 3 && <ArtGallery shared={shared} />}
      </div>

      {/* 하단 이동 */}
      <div style={{ maxWidth: 940, margin: "26px auto 0", padding: "0 16px", display: "flex", justifyContent: "space-between" }}>
        <Btn color={C.plum} disabled={stage === 1} onClick={() => setStage((s) => Math.max(1, s - 1))}>← 이전 단계</Btn>
        <Btn color={cur.color} disabled={stage === 3} onClick={() => setStage((s) => Math.min(3, s + 1))}>다음 단계 →</Btn>
      </div>
    </div>
  );
}
