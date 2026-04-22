"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VideoProcessingStatus } from "@/lib/types";

type LoadingScreenProps = {
  status: VideoProcessingStatus;
  progress?: number;
  height?: number;
  onSkip?: () => void;
};

function useAnimatedDots(intervalMs = 500): string {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount(c => (c + 1) % 4), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return ".".repeat(count);
}

function statusKey(status: VideoProcessingStatus): string {
  switch (status) {
    case "loading-ffmpeg":
      return "loadingFfmpeg";
    case "applying-slowmo":
      return "applyingSlowmo";
    case "encoding":
      return "encoding";
    case "done":
    case "processing":
    default:
      return "almostDone";
  }
}

function getEncouragingKey(progress: number): string {
  if (progress < 20) return "analyzing";
  if (progress < 45) return "calculating";
  if (progress < 70) return "processing";
  if (progress < 90) return "almostThere";
  return "finalizing";
}

/** Direct DOM manipulation for 60fps — no React re-renders */
function useSyntheticProgress(realProgress: number) {
  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const completedRef = useRef(false);
  // DOM refs for direct manipulation
  const arcRef = useRef<SVGCircleElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLHeadingElement | null>(null);
  const circumferenceRef = useRef(0);
  const radiusRef = useRef(0);
  const sizeRef = useRef(0);

  useEffect(() => {
    targetRef.current = realProgress >= 100 ? 100 : Math.min(realProgress, 95);
  }, [realProgress]);

  useEffect(() => {
    const animate = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      let current = currentRef.current;
      const target = targetRef.current;

      if (target >= 100) {
        current += Math.max(30, (100 - current) * 5) * dt;
        if (current > 100) current = 100;
      } else {
        const speed = Math.max(0.5, (target - current) * 2);
        current += speed * dt;
        current = Math.min(current, 95);
      }
      currentRef.current = current;

      // Direct DOM updates — no setState, no re-render
      const circ = circumferenceRef.current;
      const r = radiusRef.current;
      const sz = sizeRef.current;

      if (arcRef.current && circ) {
        arcRef.current.style.strokeDashoffset = String(circ * (1 - current / 100));
      }
      if (dotRef.current && r && sz && current > 0 && current < 100) {
        const angle = (current / 100) * 2 * Math.PI - Math.PI / 2;
        dotRef.current.style.left = `${sz / 2 + r * Math.cos(angle) - 5}px`;
        dotRef.current.style.top = `${sz / 2 + r * Math.sin(angle) - 5}px`;
        dotRef.current.style.display = "block";
      } else if (dotRef.current) {
        dotRef.current.style.display = current >= 100 ? "none" : "block";
      }
      if (barRef.current) {
        barRef.current.style.width = `${current}%`;
      }

      // Completion burst
      if (current >= 100 && !completedRef.current) {
        completedRef.current = true;
        if (containerRef.current) {
          containerRef.current.style.animation = "completionBurst 0.8s ease-out";
        }
      }

      if (current < 100) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Restart RAF when real hits 100
  useEffect(() => {
    if (realProgress >= 100 && currentRef.current < 100) {
      targetRef.current = 100;
      lastTimeRef.current = 0;
      const rush = (now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = now;
        let c = currentRef.current;
        c += Math.max(30, (100 - c) * 5) * dt;
        if (c > 100) c = 100;
        currentRef.current = c;
        const circ = circumferenceRef.current;
        if (arcRef.current && circ) arcRef.current.style.strokeDashoffset = String(circ * (1 - c / 100));
        if (dotRef.current) dotRef.current.style.display = c >= 100 ? "none" : "block";
        if (barRef.current) barRef.current.style.width = `${c}%`;
        if (c >= 100 && !completedRef.current) {
          completedRef.current = true;
          if (containerRef.current) containerRef.current.style.animation = "completionBurst 0.8s ease-out";
        }
        if (c < 100) rafRef.current = requestAnimationFrame(rush);
      };
      rafRef.current = requestAnimationFrame(rush);
    }
  }, [realProgress]);

  return { arcRef, dotRef, barRef, containerRef, textRef, circumferenceRef, radiusRef, sizeRef, completedRef };
}

const completionBurstStyle = `
@keyframes completionBurst {
  0% { box-shadow: 0 0 0px rgba(0,250,154,0); transform: scale(1); }
  40% { box-shadow: 0 0 40px rgba(0,250,154,0.7), 0 0 80px rgba(0,250,154,0.3); transform: scale(1.05); }
  100% { box-shadow: 0 0 0px rgba(0,250,154,0); transform: scale(1); }
}
`;

const TRIVIA = [
  "世界の平均スクリーンタイムは1日6時間42分",
  "スマホを1日に触る回数は平均2,617回",
  "人類は1日に5時間以上スマホを見ている",
  "スマホ依存症の正式名称は「ノモフォビア」",
  "青色光はメラトニン分泌を53%抑制する",
  "歩きスマホの視野は通常の1/20になる",
  "スマホの画面には便座の18倍の細菌がいる",
  "通知音を聞くだけでストレスホルモンが上昇する",
  "SNSの「いいね」はドーパミンを放出させる",
  "平均的な人は10分に1回スマホを確認する",
  "スマホを手放すと心拍数と血圧が上昇する研究結果がある",
  "「ファビング」=会話中にスマホを見る行為の造語",
  "テック企業のCEOの多くが子供のスマホ使用を制限している",
  "スマホの存在だけで認知能力が低下する（テキサス大学研究）",
  "寝る前のスマホ使用は入眠を平均30分遅らせる",
  "1日のアンロック回数は平均150回",
  "スマホ断ちした人の87%が「生活が改善した」と回答",
  "人間の集中持続時間は金魚より短い（8秒 vs 9秒）",
  "SNS使用時間が長いほど孤独感が増すという研究がある",
  "スマホ依存は脳の灰白質を減少させる可能性がある",
  "「デジタルデトックス」は2013年のオックスフォード辞書の候補語",
  "スマホを裏返して置くだけで集中力が上がる",
  "通知をオフにすると生産性が最大40%向上する",
  "自然の中で過ごすとスマホへの欲求が減る研究結果",
  "子供の55%が「親がスマホを見すぎ」と感じている",
  "スマホの光は3m先からでも睡眠に影響する",
  "平均的なスマホユーザーは年間1,000時間以上を画面に費やす",
  "「スマホ首」は頭の重さ（5kg）の5倍の負荷がかかる",
  "スマホがない時代、人は1日平均8.5時間寝ていた",
  "食事中のスマホ使用で食事の満足度が15%低下する",
  "スマホの振動を感じる幻覚「ファントムバイブ」は68%が経験",
  "15分のスマホ休憩で創造性が向上するという研究",
  "グレースケール表示にするとスマホ使用時間が平均38分減少",
  "マルチタスクは実は脳の切り替えコストで効率が40%低下する",
  "週末のデジタルデトックスで幸福度が25%上昇した実験結果",
  "目と画面の推奨距離は40-75cm（多くの人は15-20cmで使用）",
  "スマホ依存度が高い人ほど「退屈」を感じやすい傾向がある",
  "朝起きて最初にスマホを見る人は全体の80%",
  "就寝前1時間のスマホ断ちでREM睡眠が14%増加",
  "このゲームを遊んでいる間、スマホを「使って」はいない",
];

export function LoadingScreen({ status, progress, height, onSkip }: LoadingScreenProps) {
  const t = useTranslations("processing");
  const dots = useAnimatedDots();
  const refs = useSyntheticProgress(progress ?? 0);

  const [trivia, setTrivia] = useState(() => TRIVIA[Math.floor(Math.random() * TRIVIA.length)]);
  useEffect(() => {
    const id = setInterval(() => {
      setTrivia(TRIVIA[Math.floor(Math.random() * TRIVIA.length)]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const hasProgress =
    typeof progress === "number" && progress >= 0 && progress <= 100;

  // SVG circle math (set once for the hook to use)
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  refs.circumferenceRef.current = circumference;
  refs.radiusRef.current = radius;
  refs.sizeRef.current = size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <style dangerouslySetInnerHTML={{ __html: completionBurstStyle }} />

      {/* Radial glow emanating from center (ring area) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute" style={{
          top: "50%",
          left: "50%",
          width: "400px",
          height: "400px",
          transform: "translate(-50%, -55%)",
          background: "radial-gradient(circle, rgba(0, 250, 154, 0.10) 0%, rgba(0, 250, 154, 0.04) 30%, transparent 60%)",
        }} />
      </div>

      {/* Ring + Dance container */}
      <div ref={refs.containerRef} className="relative" style={{
        width: size, height: size,
        borderRadius: "50%",
      }}>
        {/* Outer rotating halo — double ring */}
        <div
          className="absolute rounded-full"
          style={{
            inset: -16,
            border: "1px solid rgba(0, 250, 154, 0.1)",
            boxShadow:
              "0 0 24px rgba(0,250,154,0.08), 0 0 48px rgba(0,250,154,0.03)",
            animation: "spin-slow 10s linear infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: -28,
            border: "1px dashed rgba(0, 250, 154, 0.06)",
            animation: "spin-slow 15s linear infinite reverse",
          }}
        />

        {/* Breathing scale on the ring */}
        <div style={{ animation: "subtle-pulse 2.5s ease-in-out infinite" }}>
          <svg
            width={size}
            height={size}
            className="block"
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Dashed track — green tint */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(0, 250, 154, 0.06)"
              strokeWidth={strokeWidth}
              strokeDasharray="4 8"
            />
            {/* Progress arc */}
            <circle
              ref={refs.arcRef}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#00fa9a"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              style={{
                filter: "drop-shadow(0 0 12px rgba(0,250,154,0.6))",
              }}
            />
          </svg>

          {/* Leading edge glowing dot — bigger glow */}
          <div
            ref={refs.dotRef}
            className="absolute rounded-full"
            style={{
              width: 12,
              height: 12,
              left: 0,
              top: 0,
              background: "#fff",
              boxShadow: "0 0 14px 4px #00fa9a, 0 0 28px 8px rgba(0,250,154,0.3)",
              display: "none",
            }}
          />
        </div>

        {/* Dance animation centered inside ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/assets/anim/dance.webp"
            alt=""
            width={96}
            height={96}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Status text + progress bar */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs mt-10 relative">
        <h2
          className="text-[16px] font-semibold tracking-wide text-foreground/90 text-center break-keep"
        >
          {t("heading").replace(/\.+$/, "")}<span style={{ display: "inline-block", width: "1.5em", textAlign: "left" }}>{dots}</span>
        </h2>
        <p className="text-foreground/60 text-[13px] text-center break-keep">
          {t(statusKey(status)).replace(/\.+$/, "")}<span style={{ display: "inline-block", width: "1.5em", textAlign: "left" }}>{dots}</span>
        </p>

        {/* Progress bar — thicker, green-tinted track */}
        <div className="w-full h-[3px] relative overflow-hidden rounded-full" style={{ backgroundColor: "rgba(0, 250, 154, 0.06)" }}>
          <div
            ref={refs.barRef}
            className="absolute inset-y-0 left-0 bg-accent rounded-full"
            style={{ width: "0%", boxShadow: "0 0 12px rgba(0,250,154,0.5), 0 0 24px rgba(0,250,154,0.2)" }}
          />
        </div>

        {typeof height === "number" && height > 0 && (
          <div className="mt-6 animate-fade-in-up" style={{ animation: "fade-in 0.5s ease-out 0.3s both" }}>
            <span className="height-number text-[48px] text-accent leading-none" style={{ textShadow: "0 0 30px rgba(0, 250, 154, 0.3)" }}>
              {height.toFixed(2)}
            </span>
            <span className="text-[16px] text-muted/60 ml-1">m</span>
          </div>
        )}

        <p
          key={trivia}
          className="text-foreground/70 text-[13px] text-center mt-4 max-w-[280px] break-keep"
          style={{ animation: "trivia-fade 400ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {trivia}
        </p>

        {onSkip && (
          <button
            onClick={onSkip}
            style={{
              marginTop: "24px",
              color: "rgba(237, 237, 237, 0.4)",
              fontSize: "12px",
              letterSpacing: "0.1em",
              background: "none",
              border: "none",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            スキップ →
          </button>
        )}
      </div>
    </div>
  );
}
