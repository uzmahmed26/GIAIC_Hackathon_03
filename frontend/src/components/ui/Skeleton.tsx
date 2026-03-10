"use client";
/**
 * Loading skeleton primitives.
 * All skeletons use an animated shimmer over the Catppuccin Mantle palette.
 *
 * Usage:
 *   <SkeletonLine width="60%" />
 *   <SkeletonCard lines={3} />
 *   <SkeletonStatRow />
 *   <SkeletonChatMessage />
 *   <DashboardSkeleton />
 */

import React from "react";

// ---------------------------------------------------------------------------
// Shimmer keyframe (injected once)
// ---------------------------------------------------------------------------

const SHIMMER_STYLE = `
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.sk-shimmer {
  background: linear-gradient(
    90deg,
    #313244 25%,
    #45475a 50%,
    #313244 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.6s infinite linear;
  border-radius: 6px;
}
`;

let shimmerInjected = false;

function injectShimmer() {
  if (shimmerInjected || typeof document === "undefined") return;
  shimmerInjected = true;
  const style = document.createElement("style");
  style.textContent = SHIMMER_STYLE;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Base block
// ---------------------------------------------------------------------------

interface BlockProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonBlock({ width = "100%", height = "1rem", className = "", style }: BlockProps) {
  injectShimmer();
  return (
    <div
      className={`sk-shimmer ${className}`}
      style={{ width, height, borderRadius: "6px", flexShrink: 0, ...style }}
    />
  );
}

// ---------------------------------------------------------------------------
// Text line
// ---------------------------------------------------------------------------

export function SkeletonLine({ width = "100%", tall = false }: { width?: string; tall?: boolean }) {
  return <SkeletonBlock width={width} height={tall ? "1.25rem" : "0.875rem"} />;
}

// ---------------------------------------------------------------------------
// Generic card skeleton
// ---------------------------------------------------------------------------

export function SkeletonCard({ lines = 2, showAvatar = false }: { lines?: number; showAvatar?: boolean }) {
  return (
    <div className="rounded-2xl border p-5 space-y-3" style={{ background: "#181825", borderColor: "#313244" }}>
      {showAvatar && (
        <div className="flex items-center gap-3">
          <SkeletonBlock width={40} height={40} style={{ borderRadius: "50%" }} />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="50%" tall />
            <SkeletonLine width="30%" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? "65%" : "100%"} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats row (4 stat cards)
// ---------------------------------------------------------------------------

export function SkeletonStatRow() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[80, 60, 70, 50].map((w, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-3" style={{ background: "#181825", borderColor: "#313244" }}>
          <SkeletonBlock width={32} height={32} style={{ borderRadius: "8px" }} />
          <SkeletonLine width={`${w}%`} tall />
          <SkeletonLine width="50%" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat message bubble
// ---------------------------------------------------------------------------

export function SkeletonChatMessage({ align = "left" }: { align?: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
      {!isRight && <SkeletonBlock width={80} height={18} style={{ borderRadius: "12px" }} />}
      <div
        className="space-y-2 rounded-2xl p-4"
        style={{
          background: "#181825",
          border: "1px solid #313244",
          width: "min(65%, 400px)",
        }}
      >
        <SkeletonLine width="100%" />
        <SkeletonLine width="80%" />
        <SkeletonLine width="50%" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full dashboard skeleton
// ---------------------------------------------------------------------------

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Welcome card */}
      <div className="rounded-2xl border p-6 space-y-3" style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>
        <SkeletonLine width="40%" tall />
        <SkeletonLine width="60%" />
      </div>

      {/* Stats */}
      <SkeletonStatRow />

      {/* Two-col */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <SkeletonCard lines={4} />
        </div>
        <SkeletonCard lines={5} />
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <SkeletonLine width="160px" tall />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border p-4 space-y-3" style={{ background: "#181825", borderColor: "#313244" }}>
              <SkeletonBlock width={40} height={40} style={{ borderRadius: "10px" }} />
              <SkeletonLine width="70%" />
              <SkeletonLine width="50%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercise card skeleton
// ---------------------------------------------------------------------------

export function SkeletonExerciseGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-5 space-y-3" style={{ background: "#181825", borderColor: "#313244" }}>
          <div className="flex gap-2">
            <SkeletonBlock width={70} height={20} style={{ borderRadius: "20px" }} />
            <SkeletonBlock width={90} height={20} style={{ borderRadius: "20px" }} />
          </div>
          <SkeletonLine width="80%" tall />
          <SkeletonLine width="100%" />
          <SkeletonLine width="75%" />
          <div className="flex items-center justify-between pt-1">
            <SkeletonBlock width={60} height={22} style={{ borderRadius: "20px" }} />
            <SkeletonBlock width={70} height={32} style={{ borderRadius: "10px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress page skeleton
// ---------------------------------------------------------------------------

export function SkeletonProgressPage() {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Overall mastery */}
      <div className="flex gap-6">
        <div className="flex-1 rounded-2xl border p-6" style={{ background: "#181825", borderColor: "#313244" }}>
          <div className="flex items-center gap-6">
            <SkeletonBlock width={112} height={112} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <div className="flex-1 space-y-3">
              <SkeletonLine width="50%" tall />
              <SkeletonBlock width={100} height={24} style={{ borderRadius: "20px" }} />
              <SkeletonLine width="70%" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border p-3 space-y-2 w-36" style={{ background: "#181825", borderColor: "#313244" }}>
              <SkeletonBlock width={24} height={24} style={{ borderRadius: "6px" }} />
              <SkeletonLine width="80%" tall />
              <SkeletonLine width="60%" />
            </div>
          ))}
        </div>
      </div>
      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border p-5 space-y-2" style={{ background: "#181825", borderColor: "#313244" }}>
          <SkeletonLine width="40%" tall />
          <SkeletonBlock width="100%" height={200} style={{ marginTop: "1rem" }} />
        </div>
        <div className="rounded-2xl border p-5 space-y-2" style={{ background: "#181825", borderColor: "#313244" }}>
          <SkeletonLine width="40%" tall />
          <SkeletonBlock width="100%" height={200} style={{ marginTop: "1rem", borderRadius: "50%" }} />
        </div>
      </div>
    </div>
  );
}
