"use client";

import { useEffect, useRef, useState } from "react";

type SectionData = {
  readonly type: "normal" | "climax" | "tagline";
  readonly lines: readonly string[];
};

function buildSections(): readonly SectionData[] {
  return [
    { type: "normal", lines: ["スマホを投げろ。"] },
    { type: "normal", lines: ["私たちは、本気でそう言っている。"] },
    { type: "normal", lines: ["スマートフォンは、", "人類史上最も成功した、", "依存性メディアだ。"] },
    { type: "normal", lines: ["平均的な人間は、", "1 日 2,000 回以上、", "デバイスに触れている。"] },
    { type: "normal", lines: ["起床から就寝までの間で、", "意識を奪われる総時間は、", "4〜6 時間。"] },
    { type: "normal", lines: ["これは、食事の時間を上回り、", "家族との会話を上回り、"] },
    { type: "normal", lines: ["もはや、", "睡眠に次ぐ第 2 の「行動」に、", "なっている。"] },
    { type: "normal", lines: ["通知が鳴ると、", "快感物質ドーパミンが放出される。"] },
    { type: "normal", lines: ["この反応は、", "パチンコ台の演出や、", "スロットマシンの設計と、", "同じ脳回路を使っている。"] },
    { type: "normal", lines: ["私たちは、", "当たりのないパチンコに、", "1 日 5 時間を使っている。"] },
    { type: "normal", lines: ["犬の散歩を眺めていると、", "どちらがどちらを、", "引っ張っているのか、", "ふと、わからなくなる瞬間がある。"] },
    { type: "normal", lines: ["スマホとの関係も、同じだ。"] },
    { type: "normal", lines: ["私たちは、スマホに散歩されている。"] },
    { type: "normal", lines: ["世界中の賢い人たちが、", "この問題に向き合ってきた。"] },
    { type: "normal", lines: ["本を書き、", "カンファレンスを開き、", "アプリの使用時間を、", "管理するアプリを作った。"] },
    { type: "normal", lines: ["私たちの答えは、こうだ。"] },
    { type: "climax", lines: ["投げろ。"] },
    { type: "normal", lines: ["ふざけているのではない。"] },
    { type: "normal", lines: ["本気で、投げてほしい。"] },
    { type: "normal", lines: ["ボールを投げるように。", "フリスビーを放るように。"] },
    { type: "normal", lines: ["壊れてもいい、と", "私たちは本気で思っている。"] },
    { type: "normal", lines: ["スマホが完全に壊れたとき、", "「おめでとう」と私たちは言う。"] },
    { type: "normal", lines: ["それは、", "人類がまだ発明していない、", "最強のデジタルデトックスだからだ。"] },
    { type: "normal", lines: ["壊れたスマホから顔を上げたとき、", "あなたの世界は、", "少しだけ、広くなっている。"] },
    { type: "normal", lines: ["毎日スマホを見ながら、", "歩いている道に、", "小さな花が咲いていたこと。"] },
    { type: "normal", lines: ["空に浮いている雲が、", "意外と早く動いていたこと。"] },
    { type: "normal", lines: ["近所の猫が、", "いつもの場所で、", "あなたを見ていたこと。"] },
    { type: "tagline", lines: ["Throw to Win.", "投げるが勝ち。"] },
  ];
}

function SectionRenderer({ section }: { section: SectionData }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (section.type === "climax") {
    return (
      <h1
        style={{
          fontSize: "clamp(72px, 18vw, 140px)",
          fontWeight: 600,
          textAlign: "center",
          letterSpacing: "0.05em",
          opacity: visible ? 1 : 0,
          filter: visible ? "blur(0px)" : "blur(24px)",
          transform: visible ? "scale(1)" : "scale(0.9)",
          transition: "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1), filter 1000ms cubic-bezier(0.16, 1, 0.3, 1), transform 1000ms cubic-bezier(0.16, 1, 0.3, 1)",
          animation: visible ? "manifesto-pulse 3s ease-in-out 1000ms infinite" : "none",
        }}
      >
        {section.lines[0]}
      </h1>
    );
  }

  if (section.type === "tagline") {
    return (
      <div style={{ textAlign: "center" }}>
        {section.lines.map((line, i) => (
          <h2
            key={i}
            style={{
              fontSize: "clamp(32px, 7vw, 52px)",
              fontWeight: 600,
              color: "#00FA9A",
              letterSpacing: "0.05em",
              marginBottom: "0.4em",
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(16px)",
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 300}ms, filter 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 300}ms, transform 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 300}ms`,
            }}
          >
            {line}
          </h2>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "680px", width: "100%", textAlign: "center" }}>
      {section.lines.map((line, i) => (
        <p
          key={i}
          style={{
            opacity: visible ? 1 : 0,
            filter: visible ? "blur(0px)" : "blur(14px)",
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: `opacity 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, filter 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, transform 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms`,
            fontSize: "clamp(15px, 4vw, 20px)",
            lineHeight: 2,
            letterSpacing: "0.05em",
            fontWeight: 300,
            margin: "0.6em 0",
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function Manifesto() {
  const sections = buildSections();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const idx = Math.min(
        sections.length - 1,
        Math.max(0, Math.floor((scrollY + vh * 0.5) / vh)),
      );
      setCurrentIndex(idx);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections.length]);

  return (
    <main
      style={{
        background: "#000000",
        color: "#EDEDED",
        fontFamily: '"Hiragino Sans", "ヒラギノ角ゴシック", "ヒラギノ角ゴ ProN", "Hiragino Kaku Gothic ProN", "Yu Gothic Medium", "游ゴシック Medium", YuGothic, sans-serif',
        fontWeight: 300,
      }}
      className="safe-top safe-bottom"
    >
      <div style={{ height: `${sections.length * 100}vh`, position: "relative" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <SectionRenderer key={currentIndex} section={sections[currentIndex]} />
        </div>
      </div>
    </main>
  );
}
