"use client";
/**
 * Toast notification system
 *
 * Usage:
 *   1. Mount <ToastContainer /> once in the root layout.
 *   2. In React components: const { toast } = useToast();
 *      toast("Saved!", "success");
 *   3. Outside React (e.g. api.ts): import { emitToast } from "@/src/lib/api";
 *      emitToast("Connection error", "error");
 *
 * Toasts auto-dismiss after 4 s. Hover pauses the timer.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TOAST_EVENT, type ToastPayload, type ToastType } from "@/src/lib/api";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Visual config per type
// ---------------------------------------------------------------------------

const TOAST_STYLES: Record<ToastType, { icon: string; border: string; text: string; bg: string }> = {
  success: { icon: "✓", border: "rgba(166,227,161,0.4)", text: "#a6e3a1", bg: "rgba(166,227,161,0.08)" },
  error:   { icon: "✕", border: "rgba(243,139,168,0.4)", text: "#f38ba8", bg: "rgba(243,139,168,0.08)" },
  warning: { icon: "⚠", border: "rgba(249,226,175,0.4)", text: "#f9e2af", bg: "rgba(249,226,175,0.08)" },
  info:    { icon: "ℹ", border: "rgba(137,180,250,0.4)", text: "#89b4fa", bg: "rgba(137,180,250,0.08)" },
};

const DEFAULT_DURATION = 4000;

// ---------------------------------------------------------------------------
// Internal toast item
// ---------------------------------------------------------------------------

interface ToastItem extends ToastPayload {
  duration: number;
  paused: boolean;
  remaining: number;
  startedAt: number;
}

// ---------------------------------------------------------------------------
// Single toast component
// ---------------------------------------------------------------------------

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const style = TOAST_STYLES[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingRef = useRef(item.duration);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(item.id), 250);
  }, [item.id, onDismiss]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainingRef.current);

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [dismiss, item.duration]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    remainingRef.current -= Date.now() - startRef.current;
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startTimer]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl"
      style={{
        background: "#181825",
        borderColor: style.border,
        minWidth: "280px",
        maxWidth: "400px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(24px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        pointerEvents: "all",
      }}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: style.bg, color: style.text }}
        >
          {style.icon}
        </span>

        {/* Message */}
        <p className="flex-1 text-sm leading-snug" style={{ color: "#cdd6f4" }}>
          {item.message}
        </p>

        {/* Close */}
        <button
          onClick={dismiss}
          className="ml-1 shrink-0 text-xs transition-colors"
          style={{ color: "#45475a" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#cdd6f4")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#45475a")}
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 rounded-full transition-none"
        style={{ width: `${progress}%`, background: style.text, opacity: 0.5 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container + Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", duration = DEFAULT_DURATION) => {
    const item: ToastItem = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
      paused: false,
      remaining: duration,
      startedAt: Date.now(),
    };
    setToasts((prev) => [...prev.slice(-4), item]); // max 5 toasts
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen to window events from api.ts emitToast()
  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<ToastPayload>).detail;
      addToast(message, type);
    }
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container — bottom-right */}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
