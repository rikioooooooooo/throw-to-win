"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

type NameInputProps = {
  readonly currentName: string;
  readonly onSave: (name: string) => void;
  readonly saving?: boolean;
};

const MAX_LENGTH = 20;

export function NameInput({ currentName, onSave, saving }: NameInputProps) {
  const t = useTranslations();
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus disabled — triggers virtual keyboard on mobile which shifts layout
  // useEffect(() => {
  //   inputRef.current?.focus();
  // }, []);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && trimmed !== currentName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSave && !saving) onSave(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <p className="label-text text-[10px] tracking-[0.2em] text-muted/60 mb-2 uppercase">
        {t("profile.nameLabel")}
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          placeholder={t("profile.namePlaceholder")}
          className="flex-1 px-4 py-3 text-[14px] text-foreground bg-transparent outline-none"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-game)",
            borderRadius: "10px",
          }}
          maxLength={MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
        />
        <button
          type="submit"
          disabled={!canSave || saving}
          className="px-5 py-3 label-text text-[11px] tracking-widest text-black active:scale-[0.97] transition-transform disabled:opacity-30"
          style={{
            backgroundColor: "var(--color-accent)",
            borderRadius: "10px",
          }}
        >
          {saving ? "..." : t("profile.save")}
        </button>
      </div>
      <p className="text-[10px] text-muted/40 mt-1.5 text-right">
        {trimmed.length}/{MAX_LENGTH}
      </p>
    </form>
  );
}
