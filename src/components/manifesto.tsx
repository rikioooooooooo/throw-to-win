"use client";

import { forwardRef, useEffect, useRef, useState } from "react";

// ---- Section data ----

const SECTIONS: readonly {
  readonly text: string;
  readonly isHero?: boolean;
  readonly isTagline?: boolean;
}[] = [
  {
    text: "スマホを投げろ。\n\n私たちは、本気でそう言っている。",
  },
  {
    text: "スマートフォンは、\n人類史上最も成功した依存性メディアだ。\n\n平均的な人間は、\n1 日 2,000 回以上デバイスに触れている。\n\n起床から就寝までの間で、\n意識を奪われる総時間は、4〜6 時間。\n\nこれは、食事の時間を上回り、\n家族との会話を上回り、\n\nもはや、睡眠に次ぐ第 2 の「行動」になっている。",
  },
  {
    text: "通知が鳴ると、\n快感物質ドーパミンが放出される。\n\nこの反応は、\nパチンコ台の演出やスロットマシンの設計と、\n同じ脳回路を使っている。\n\n私たちは、\n当たりのないパチンコに、\n1 日 5 時間を使っている。",
  },
  {
    text: "犬の散歩を眺めていると、\nどちらがどちらを引っ張っているのか、\nふと、わからなくなる瞬間がある。\n\nスマホとの関係も、同じだ。\n\n私たちは、スマホに散歩されている。",
  },
  {
    text: "世界中の賢い人たちが、\nこの問題に向き合ってきた。\n\n本を書き、\nカンファレンスを開き、\nアプリの使用時間を管理するアプリを作った。\n\n私たちの答えは、こうだ。",
  },
  {
    text: "投げろ。",
    isHero: true,
  },
  {
    text: "ふざけているのではない。\n\n本気で、投げてほしい。\n\nボールを投げるように。\nフリスビーを放るように。",
  },
  {
    text: "壊れてもいい、と\n私たちは本気で思っている。\n\nスマホが完全に壊れたとき、\n「おめでとう」と私たちは言う。\n\nそれは、\n人類がまだ発明していない、\n最強のデジタルデトックスだからだ。",
  },
  {
    text: "壊れたスマホから顔を上げたとき、\nあなたの世界は、\n少しだけ、広くなっている。\n\n毎日スマホを見ながら歩いている道に、\n小さな花が咲いていたこと。\n\n空に浮いている雲が、\n意外と早く動いていたこと。\n\n近所の猫が、\nいつもの場所で、\nあなたを見ていたこと。",
  },
  {
    text: "Throw to Win.\n投げるが勝ち。",
    isTagline: true,
  },
];

// ---- ManifestoSection ----

function ManifestoSection({
  children,
  isHero,
  isTagline,
}: {
  readonly children: React.ReactNode;
  readonly isHero?: boolean;
  readonly isTagline?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseClass = isHero
    ? "min-h-[100dvh] flex items-center justify-center text-center text-foreground"
    : isTagline
      ? "py-[20vh] flex items-center justify-center text-center"
      : "py-[20vh] flex items-center justify-center text-center";

  const textClass = isHero
    ? "text-[clamp(60px,18vw,100px)] font-extrabold tracking-wide"
    : isTagline
      ? "text-[clamp(28px,8vw,40px)] font-bold text-accent tracking-wide"
      : "text-[clamp(16px,4.5vw,20px)] text-foreground/80 leading-relaxed max-w-lg mx-auto";

  const heroStyle = isHero
    ? { animation: "manifesto-pulse 2s ease-in-out infinite" }
    : undefined;

  return (
    <section
      ref={ref}
      className={baseClass}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition:
          "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className={textClass} style={{ whiteSpace: "pre-line", ...heroStyle }}>
        {children}
      </div>
    </section>
  );
}

// ---- Manifesto ----

export const Manifesto = forwardRef<HTMLDivElement>(function Manifesto(_props, ref) {
  return (
    <div ref={ref} className="bg-black">
      {/* Gradient transition from #050a08 → #000 */}
      <div
        className="h-[200px] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, #050a08, #000000)",
        }}
      />

      {SECTIONS.map((section, i) => (
        <ManifestoSection key={i} isHero={section.isHero} isTagline={section.isTagline}>
          {section.text}
        </ManifestoSection>
      ))}

      {/* Bottom breathing room */}
      <div className="h-[30vh]" />
    </div>
  );
});
