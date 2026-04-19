"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatHeight } from "@/lib/physics";
import { generateFingerprint } from "@/lib/fingerprint";
import { loadData } from "@/lib/storage";

type Post = {
  readonly id: number;
  readonly displayName: string;
  readonly body: string;
  readonly heightMeters: number;
  readonly country: string;
  readonly createdAt: string;
};

type ThreadSheetProps = {
  open: boolean;
  onClose: () => void;
};

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return code;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    upper.charCodeAt(0) + 0x1f1a5,
    upper.charCodeAt(1) + 0x1f1a5,
  );
}

function relativeTime(isoString: string, locale: string): string {
  const diff = Date.now() - new Date(isoString + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === "ja" ? "たった今" : "now";
  if (mins < 60) return locale === "ja" ? `${mins}分前` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === "ja" ? `${hours}時間前` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return locale === "ja" ? `${days}日前` : `${days}d`;
}

export function ThreadSheet({ open, onClose }: ThreadSheetProps) {
  const t = useTranslations("thread");
  const locale = useLocale();
  const [posts, setPosts] = useState<readonly Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [canPost, setCanPost] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTranslate: number } | null>(null);

  // Check if user has thrown
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const data = loadData();
      setCanPost(data.stats.totalThrows > 0);
    }
  }, [open]);

  // Fetch posts
  const fetchPosts = useCallback(async (beforeId?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (beforeId) params.set("before_id", String(beforeId));
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setPosts((prev) => beforeId ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPosts([]);
      setHasMore(false);
      setNextCursor(null);
      fetchPosts();
    }
  }, [open, fetchPosts]);

  // Submit post
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 100 || sending) return;

    setSending(true);
    try {
      const deviceFingerprint = await generateFingerprint();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint, body: trimmed }),
      });

      if (res.status === 429) {
        setStatusMsg(t("rateLimited"));
        setTimeout(() => setStatusMsg(null), 3000);
        return;
      }

      if (!res.ok) return;

      // Prepend optimistic post
      const data = loadData();
      const newPost: Post = {
        id: Date.now(),
        displayName: data.displayName ?? "",
        body: trimmed,
        heightMeters: data.stats.personalBest,
        country: "XX",
        createdAt: new Date().toISOString().replace("Z", ""),
      };
      setPosts((prev) => [newPost, ...prev]);
      setInput("");
      setStatusMsg(t("posted"));
      setTimeout(() => setStatusMsg(null), 2000);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  // Drag to dismiss
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) {
      dragRef.current = { startY: e.clientY, startTranslate: 0 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - dragRef.current.startY);
    dragRef.current.startTranslate = dy;
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };

  const handlePointerUp = () => {
    if (!dragRef.current || !sheetRef.current) return;
    if (dragRef.current.startTranslate > 120) {
      onClose();
    } else {
      sheetRef.current.style.transform = "translateY(0)";
    }
    dragRef.current = null;
  };

  if (!open) return null;

  const trimmedLength = input.trim().length;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" style={{ animation: "fade-in 0.2s ease-out both" }} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background flex flex-col"
        style={{
          maxHeight: "70vh",
          borderRadius: "16px 16px 0 0",
          animation: "slide-up-sheet 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drag handle */}
        <div data-drag-handle className="flex justify-center pt-3 pb-2 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-muted/30" />
        </div>

        {/* Title */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="label-text text-[13px] tracking-[0.15em] text-foreground/80">{t("title")}</h2>
          <button onClick={onClose} className="text-muted/50 text-[20px] leading-none px-2 hover:text-muted/80">&times;</button>
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          {posts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted/50 text-[14px]">{t("empty")}</p>
              <p className="text-muted/30 text-[12px] mt-1">{t("emptyHint")}</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <div key={post.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-accent/40 text-[11px] height-number">&gt;&gt;{post.id}</span>
                      <span className="text-foreground/70 text-[12px] font-medium truncate" style={{ maxWidth: 120 }}>{post.displayName || "???"}</span>
                      <span className="text-accent/50 text-[11px]">{formatHeight(post.heightMeters)}m</span>
                      <span className="text-[13px]">{countryFlag(post.country)}</span>
                    </div>
                    <span className="text-muted/40 text-[11px]">{relativeTime(post.createdAt, locale)}</span>
                  </div>
                  <p className="text-foreground/90 text-[13px] leading-relaxed break-words">{post.body}</p>
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={() => nextCursor && fetchPosts(nextCursor)}
                  disabled={loading}
                  className="w-full py-3 text-center text-accent/50 text-[12px] tracking-[0.1em] hover:text-accent/70 transition-colors disabled:opacity-50"
                >
                  {t("loadMore")}
                </button>
              )}
            </>
          )}
          {loading && (
            <div className="py-4 text-center text-muted/40 text-[12px]">...</div>
          )}
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="px-4 py-1.5 text-center text-accent/70 text-[11px] tracking-wider">
            {statusMsg}
          </div>
        )}

        {/* Compose bar */}
        <div className="game-border" style={{ borderLeft: "none", borderRight: "none", borderBottom: "none", padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
          {canPost ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend(); }}
                placeholder={t("placeholder")}
                maxLength={100}
                className="flex-1 bg-transparent text-foreground/90 text-[13px] placeholder:text-muted/30 outline-none"
              />
              {trimmedLength > 80 && (
                <span className={`text-[10px] shrink-0 ${trimmedLength > 100 ? "text-red-400" : "text-muted/40"}`}>
                  {t("charCount", { count: trimmedLength })}
                </span>
              )}
              <button
                onClick={handleSend}
                disabled={trimmedLength === 0 || trimmedLength > 100 || sending}
                className="text-accent text-[12px] tracking-wider font-medium shrink-0 disabled:text-muted/30 active:scale-[0.95] transition-all"
              >
                {t("send")}
              </button>
            </div>
          ) : (
            <p className="text-center text-muted/40 text-[12px] tracking-wider">{t("mustThrow")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
