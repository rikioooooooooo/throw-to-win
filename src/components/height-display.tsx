"use client";

type HeightDisplayProps = {
  height: number;
  isAtPeak: boolean;
};

export function HeightDisplay({ height, isAtPeak }: HeightDisplayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
      <div className="relative flex flex-col items-center justify-center">
        {/* Peak ring burst */}
        {isAtPeak && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-[60vw] h-[60vw] max-w-[280px] max-h-[280px] border border-accent/20 animate-fade-in"
              style={{
                animation:
                  "peak-freeze 0.6s ease-out forwards, fade-in 0.3s ease-out",
              }}
            />
          </div>
        )}

        {/* Height + unit on same baseline */}
        <div className={`flex items-baseline gap-2 ${isAtPeak ? "animate-peak" : ""}`}>
          <span
            className={[
              "hud-number block text-center",
              "text-[clamp(6rem,30vw,14rem)]",
              isAtPeak
                ? "text-accent animate-glow-burst text-glow"
                : "text-white text-camera",
            ].join(" ")}
          >
            {height.toFixed(2)}
          </span>
          <span
            className={[
              "font-display font-black text-[clamp(1.5rem,6vw,3rem)] tracking-tighter leading-none",
              isAtPeak ? "text-accent-dark" : "text-muted text-camera",
            ].join(" ")}
          >
            m
          </span>
        </div>
      </div>
    </div>
  );
}
