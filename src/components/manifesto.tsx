"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type SectionData = {
  readonly type: "normal" | "climax" | "tagline";
  readonly lines: readonly string[];
};

function buildSections(): readonly SectionData[] {
  return [
    { type: "normal", lines: ["スマホを投げろ。"] },
    { type: "normal", lines: ["私たちは、", "本気でそう言っている。"] },
    { type: "normal", lines: ["スマートフォンは、", "人類史上最も成功した、", "依存性メディアだ。"] },
    { type: "normal", lines: ["平均的な人間は、", "1 日 2,000 回以上、", "デバイスに触れている。"] },
    { type: "normal", lines: ["起床から就寝までの間で、", "意識を奪われる総時間は、", "4〜6 時間。"] },
    { type: "normal", lines: ["これは、食事の時間を上回り、", "家族との会話を上回り、"] },
    { type: "normal", lines: ["もはや、", "睡眠に次ぐ第 2 の「行動」に、", "なっている。"] },
    { type: "normal", lines: ["通知が鳴ると、", "快感物質ドーパミンが、", "放出される。"] },
    { type: "normal", lines: ["この反応は、", "パチンコ台の演出や、", "スロットマシンの設計と、", "同じ脳回路を使っている。"] },
    { type: "normal", lines: ["私たちは、", "当たりのないパチンコに、", "1 日 5 時間を使っている。"] },
    { type: "normal", lines: ["犬の散歩を眺めていると、", "どちらがどちらを、", "引っ張っているのか、", "ふと、わからなくなる瞬間が、", "ある。"] },
    { type: "normal", lines: ["スマホとの関係も、同じだ。"] },
    { type: "normal", lines: ["私たちは、", "スマホに散歩されている。"] },
    { type: "normal", lines: ["世界中の賢い人たちが、", "この問題に向き合ってきた。"] },
    { type: "normal", lines: ["本を書き、", "カンファレンスを開き、", "アプリの使用時間を、", "管理するアプリを作った。"] },
    { type: "normal", lines: ["私たちの答えは、こうだ。"] },
    { type: "climax", lines: ["投げろ。"] },
    { type: "normal", lines: ["ふざけているのではない。"] },
    { type: "normal", lines: ["本気で、投げてほしい。"] },
    { type: "normal", lines: ["ボールを投げるように。", "フリスビーを放るように。"] },
    { type: "normal", lines: ["壊れてもいい、と", "私たちは本気で思っている。"] },
    { type: "normal", lines: ["スマホが完全に壊れたとき、", "「おめでとう」と私たちは言う。"] },
    { type: "normal", lines: ["それは、", "人類がまだ発明していない、", "最強の、", "デジタルデトックスだからだ。"] },
    { type: "normal", lines: ["壊れたスマホから、", "顔を上げたとき、", "あなたの世界は、", "少しだけ、広くなっている。"] },
    { type: "normal", lines: ["毎日スマホを見ながら、", "歩いている道に、", "小さな花が咲いていたこと。"] },
    { type: "normal", lines: ["空に浮いている雲が、", "意外と早く動いていたこと。"] },
    { type: "normal", lines: ["近所の猫が、", "いつもの場所で、", "あなたを見ていたこと。"] },
    { type: "tagline", lines: ["Throw to Win.", "投げるが勝ち。"] },
  ];
}

function SectionRenderer({ section }: { section: SectionData }) {
  const [visible, setVisible] = useState(false);

  // 2-frame rAF to ensure initial state is painted before transition starts
  useEffect(() => {
    let raf1: number;
    let raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);

  if (section.type === "climax") {
    return (
      <h1
        style={{
          fontSize: "clamp(72px, 20vw, 160px)",
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
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
              fontSize: "clamp(40px, 9vw, 72px)",
              fontWeight: 700,
              color: "#00FA9A",
              letterSpacing: "0.05em",
              marginBottom: "0.4em",
              fontFamily: line === "Throw to Win." ? "var(--font-outfit), sans-serif" : undefined,
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
    <div style={{ maxWidth: "680px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {section.lines.map((line, i) => (
        <p
          key={i}
          style={{
            opacity: visible ? 1 : 0,
            filter: visible ? "blur(0px)" : "blur(14px)",
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: `opacity 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, filter 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms, transform 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 180}ms`,
            fontSize: "clamp(20px, 5.5vw, 28px)",
            lineHeight: 1.8,
            letterSpacing: "0.05em",
            fontWeight: 300,
            margin: "0.3em 0",
            textAlign: "center",
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
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "ja";
  const isLastSection = currentIndex === sections.length - 1;

  // Override body height constraints so manifesto can scroll
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const origHH = htmlEl.style.height;
    const origBH = bodyEl.style.height;
    const origBO = bodyEl.style.overflow;
    const origBOB = bodyEl.style.overscrollBehavior;
    htmlEl.style.height = "auto";
    bodyEl.style.height = "auto";
    bodyEl.style.overflow = "";
    bodyEl.style.overscrollBehavior = "auto";
    return () => {
      htmlEl.style.height = origHH;
      bodyEl.style.height = origBH;
      bodyEl.style.overflow = origBO;
      bodyEl.style.overscrollBehavior = origBOB;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const idx = Math.min(
        sections.length - 1,
        Math.max(0, Math.floor(scrollY / (vh * 1.3))), // 1.3 = 1セクションあたり130vh
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
    >
      {/* Fixed display layer: always centered in viewport */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          pointerEvents: "none",
          zIndex: 1,
          background: "#000000",
        }}
      >
        <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <SectionRenderer key={currentIndex} section={sections[currentIndex]} />
          {isLastSection && (
            <button
              onClick={() => router.push(`/${locale}`)}
              style={{
                marginTop: "clamp(32px, 8vh, 60px)",
                color: "rgba(237,237,237,0.3)",
                fontSize: "13px",
                letterSpacing: "0.1em",
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: 1,
                animation: "fade-in 1s ease-out 1.5s both",
              }}
            >
              TOP →
            </button>
          )}
        </div>
      </div>

      {/* Scroll space: invisible, just adds vertical scroll */}
      <div
        style={{
          height: `${sections.length * 130}vh`,
          width: "100%",
          position: "relative",
          zIndex: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
    </main>
  );
}
