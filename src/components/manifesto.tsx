"use client";

import { useEffect, useRef, useState } from "react";

// ── Section: blur + translateY + opacity dissolve ──
function Section({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        padding: "15vh 0",
        textAlign: "center",
      }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontSize: "clamp(16px, 4.5vw, 20px)",
            lineHeight: 2,
            letterSpacing: "0.05em",
            color: "rgba(237,237,237,0.8)",
            opacity: visible ? 1 : 0,
            filter: visible ? "blur(0px)" : "blur(14px)",
            transform: visible ? "translateY(0)" : "translateY(32px)",
            transition: `opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, filter 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, transform 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms`,
          }}
        >
          {line}
        </p>
      ))}
    </section>
  );
}

// ── ClimaxSection: blur + scale, then pulse ──
function ClimaxSection({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "20vh 0",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(64px, 15vw, 120px)",
          fontWeight: 700,
          color: "var(--color-foreground)",
          textAlign: "center",
          opacity: visible ? 1 : 0,
          filter: visible ? "blur(0px)" : "blur(24px)",
          transform: visible ? "scale(1)" : "scale(0.9)",
          transition:
            "opacity 1400ms cubic-bezier(0.16, 1, 0.3, 1), filter 1400ms cubic-bezier(0.16, 1, 0.3, 1), transform 1400ms cubic-bezier(0.16, 1, 0.3, 1)",
          animation: visible ? "manifesto-pulse 2s ease-in-out infinite 1400ms" : "none",
        }}
      >
        {text}
      </h1>
    </section>
  );
}

// ── Tagline: blur dissolve with accent color ──
function Tagline() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const taglines = ["Throw to Win.", "投げるが勝ち。"];

  return (
    <section
      ref={ref}
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "15vh 0",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {taglines.map((line, i) => (
          <h2
            key={i}
            style={{
              fontSize: "clamp(32px, 6vw, 48px)",
              fontWeight: 700,
              color: "#00FA9A",
              marginBottom: i === 0 ? "0.4em" : undefined,
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(16px)",
              transition: `opacity 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 300}ms, filter 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 300}ms`,
            }}
          >
            {line}
          </h2>
        ))}
      </div>
    </section>
  );
}

// ── Main Manifesto component ──
export function Manifesto() {
  return (
    <main
      style={{
        background: "#000000",
        color: "var(--color-foreground)",
        padding: "10vh 24px",
        maxWidth: 680,
        margin: "0 auto",
      }}
    >
      <Section lines={["スマホを投げろ。"]} />
      <Section lines={["私たちは、本気でそう言っている。"]} />
      <Section
        lines={[
          "スマートフォンは、",
          "人類史上最も成功した依存性メディアだ。",
        ]}
      />
      <Section
        lines={[
          "平均的な人間は、",
          "1 日 2,000 回以上デバイスに触れている。",
        ]}
      />
      <Section
        lines={[
          "起床から就寝までの間で、",
          "意識を奪われる総時間は、4〜6 時間。",
        ]}
      />
      <Section
        lines={[
          "これは、食事の時間を上回り、",
          "家族との会話を上回り、",
        ]}
      />
      <Section
        lines={[
          "もはや、睡眠に次ぐ",
          "第 2 の「行動」になっている。",
        ]}
      />
      <Section
        lines={[
          "通知が鳴ると、",
          "快感物質ドーパミンが放出される。",
        ]}
      />
      <Section
        lines={[
          "この反応は、",
          "パチンコ台の演出やスロットマシンの設計と、",
          "同じ脳回路を使っている。",
        ]}
      />
      <Section
        lines={[
          "私たちは、",
          "当たりのないパチンコに、",
          "1 日 5 時間を使っている。",
        ]}
      />
      <Section
        lines={[
          "犬の散歩を眺めていると、",
          "どちらがどちらを引っ張っているのか、",
          "ふと、わからなくなる瞬間がある。",
        ]}
      />
      <Section
        lines={[
          "スマホとの関係も、同じだ。",
        ]}
      />
      <Section
        lines={[
          "私たちは、スマホに散歩されている。",
        ]}
      />
      <Section
        lines={[
          "世界中の賢い人たちが、",
          "この問題に向き合ってきた。",
        ]}
      />
      <Section
        lines={[
          "本を書き、",
          "カンファレンスを開き、",
          "アプリの使用時間を管理するアプリを作った。",
        ]}
      />
      <Section lines={["私たちの答えは、こうだ。"]} />

      <ClimaxSection text="投げろ。" />

      <Section lines={["ふざけているのではない。"]} />
      <Section lines={["本気で、投げてほしい。"]} />
      <Section
        lines={[
          "ボールを投げるように。",
          "フリスビーを放るように。",
        ]}
      />
      <Section
        lines={[
          "壊れてもいい、と",
          "私たちは本気で思っている。",
        ]}
      />
      <Section
        lines={[
          "スマホが完全に壊れたとき、",
          "「おめでとう」と私たちは言う。",
        ]}
      />
      <Section
        lines={[
          "それは、",
          "人類がまだ発明していない、",
          "最強のデジタルデトックスだからだ。",
        ]}
      />
      <Section
        lines={[
          "壊れたスマホから顔を上げたとき、",
          "あなたの世界は、",
          "少しだけ、広くなっている。",
        ]}
      />
      <Section
        lines={[
          "毎日スマホを見ながら歩いている道に、",
          "小さな花が咲いていたこと。",
        ]}
      />
      <Section
        lines={[
          "空に浮いている雲が、",
          "意外と早く動いていたこと。",
        ]}
      />
      <Section
        lines={[
          "近所の猫が、",
          "いつもの場所で、",
          "あなたを見ていたこと。",
        ]}
      />

      <Tagline />

      {/* Bottom breathing room */}
      <div style={{ height: "30vh" }} />
    </main>
  );
}
