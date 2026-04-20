"use client";

import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { id: "intro", content: "スマホを投げろ。\n\n私たちは、本気でそう言っている。" },
  { id: "stats", content: "スマートフォンは、\n人類史上最も成功した依存性メディアだ。\n\n平均的な人間は、\n1 日 2,000 回以上デバイスに触れている。\n\n起床から就寝までの間で、\n意識を奪われる総時間は、4〜6 時間。\n\nこれは、食事の時間を上回り、\n家族との会話を上回り、\n\nもはや、睡眠に次ぐ第 2 の「行動」になっている。" },
  { id: "neuro", content: "通知が鳴ると、\n快感物質ドーパミンが放出される。\n\nこの反応は、\nパチンコ台の演出やスロットマシンの設計と、\n同じ脳回路を使っている。\n\n私たちは、\n当たりのないパチンコに、\n1 日 5 時間を使っている。" },
  { id: "dog", content: "犬の散歩を眺めていると、\nどちらがどちらを引っ張っているのか、\nふと、わからなくなる瞬間がある。\n\nスマホとの関係も、同じだ。\n\n私たちは、スマホに散歩されている。" },
  { id: "smart", content: "世界中の賢い人たちが、\nこの問題に向き合ってきた。\n\n本を書き、\nカンファレンスを開き、\nアプリの使用時間を管理するアプリを作った。\n\n私たちの答えは、こうだ。" },
  { id: "throw", content: "投げろ。", special: "climax" as const },
  { id: "defend", content: "ふざけているのではない。\n\n本気で、投げてほしい。\n\nボールを投げるように。\nフリスビーを放るように。" },
  { id: "break", content: "壊れてもいい、と\n私たちは本気で思っている。\n\nスマホが完全に壊れたとき、\n「おめでとう」と私たちは言う。\n\nそれは、\n人類がまだ発明していない、\n最強のデジタルデトックスだからだ。" },
  { id: "world", content: "壊れたスマホから顔を上げたとき、\nあなたの世界は、\n少しだけ、広くなっている。\n\n毎日スマホを見ながら歩いている道に、\n小さな花が咲いていたこと。\n\n空に浮いている雲が、\n意外と早く動いていたこと。\n\n近所の猫が、\nいつもの場所で、\nあなたを見ていたこと。" },
  { id: "tagline", content: "Throw to Win.\n投げるが勝ち。", special: "tagline" as const },
];

function Section({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={ref} className={className} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(40px)",
      transition: "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1), transform 1000ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      {children}
    </section>
  );
}

export default function ManifestoPage() {
  return (
    <main className="min-h-screen safe-top safe-bottom" style={{ background: "#000000", color: "var(--color-foreground)" }}>
      {/* Opening dark space */}
      <div style={{ height: "100vh" }} />

      {/* Sections */}
      {SECTIONS.map((section) => {
        if (section.special === "climax") {
          return (
            <Section key={section.id} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", margin: "20vh 0" }}>
              <h1 style={{
                fontSize: "clamp(64px, 15vw, 120px)",
                fontWeight: 700,
                color: "var(--color-foreground)",
                textAlign: "center",
                animation: "manifesto-pulse 2s ease-in-out infinite",
              }}>
                {section.content}
              </h1>
            </Section>
          );
        }
        if (section.special === "tagline") {
          return (
            <Section key={section.id} style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "15vh 24px" }}>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 700, color: "var(--color-accent)", marginBottom: "0.4em" }}>
                  Throw to Win.
                </h2>
                <h2 style={{ fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 700, color: "var(--color-accent)" }}>
                  投げるが勝ち。
                </h2>
              </div>
            </Section>
          );
        }
        return (
          <Section key={section.id} style={{ padding: "15vh 24px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
            <p className="whitespace-pre-line" style={{ fontSize: "clamp(16px, 4.5vw, 20px)", lineHeight: 2, letterSpacing: "0.05em", color: "rgba(237,237,237,0.8)" }}>
              {section.content}
            </p>
          </Section>
        );
      })}

      {/* Bottom breathing room */}
      <div style={{ height: "30vh" }} />
    </main>
  );
}
