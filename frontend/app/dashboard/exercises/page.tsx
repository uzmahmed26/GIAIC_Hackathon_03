"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { EXERCISES } from "@/src/lib/mock-data";
import { SkeletonExerciseGrid } from "@/src/components/ui/Skeleton";
import type { Exercise } from "@/src/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DIFF_COLORS: Record<string, { color: string; bg: string }> = {
  Beginner: { color: "#a6e3a1", bg: "rgba(166,227,161,0.15)" },
  Intermediate: { color: "#f9e2af", bg: "rgba(249,226,175,0.15)" },
  Advanced: { color: "#f38ba8", bg: "rgba(243,139,168,0.15)" },
};

function ExerciseModal({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const [code, setCode] = useState(ex.starterCode);
  const [hintsShown, setHintsShown] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const dc = DIFF_COLORS[ex.difficulty];

  function handleSubmit() {
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex w-full max-w-4xl flex-col rounded-2xl border shadow-2xl animate-fade-in"
        style={{ background: "#181825", borderColor: "#313244", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b p-5" style={{ borderColor: "#313244" }}>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                Module {ex.module}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={dc}>
                {ex.difficulty}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(249,226,175,0.15)", color: "#f9e2af" }}>
                ⚡ {ex.xpReward} XP
              </span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "#cdd6f4" }}>{ex.title}</h2>
            <p className="mt-1 text-sm" style={{ color: "#a6adc8" }}>{ex.description}</p>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 text-lg transition-all" style={{ color: "#6c7086" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#cdd6f4")} onMouseLeave={(e) => (e.currentTarget.style.color = "#6c7086")}>✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Editor */}
          <div className="flex flex-1 flex-col border-r" style={{ borderColor: "#313244" }}>
            <div className="shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6c7086", borderBottom: "1px solid #313244" }}>
              Code Editor
            </div>
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={showSolution ? (ex.solution ?? ex.starterCode) : code}
                onChange={(v) => setCode(v ?? "")}
                options={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  minimap: { enabled: false },
                  padding: { top: 12, bottom: 12 },
                  readOnly: showSolution,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="flex w-72 shrink-0 flex-col overflow-auto p-4 space-y-4">
            {/* Test cases */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6c7086" }}>Test Cases</p>
              {ex.testCases.map((tc, i) => (
                <div key={i} className="mb-2 rounded-xl border p-3 text-xs" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
                  <div><span style={{ color: "#6c7086" }}>Input: </span><span style={{ color: "#a6adc8", fontFamily: "monospace" }}>{tc.input || "none"}</span></div>
                  <div className="mt-1"><span style={{ color: "#6c7086" }}>Expected: </span><span style={{ color: "#cdd6f4", fontFamily: "monospace" }}>{tc.expected}</span></div>
                  {submitted && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(166,227,161,0.15)", color: "#a6e3a1" }}>✓ Pass</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Hints */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6c7086" }}>Hints</p>
              {ex.hints.slice(0, hintsShown).map((hint, i) => (
                <div key={i} className="mb-2 rounded-xl border p-3 text-xs animate-fade-in" style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.3)", color: "#a6adc8" }}>
                  <span className="font-semibold" style={{ color: "#a5b4fc" }}>Hint {i + 1}: </span>{hint}
                </div>
              ))}
              {hintsShown < ex.hints.length && (
                <button
                  onClick={() => setHintsShown((n) => n + 1)}
                  className="w-full rounded-xl border py-2 text-xs font-medium transition-all"
                  style={{ borderColor: "#313244", color: "#6366f1" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Reveal hint {hintsShown + 1} of {ex.hints.length}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {submitted ? (
                <div className="rounded-xl border p-3 text-center" style={{ background: "rgba(166,227,161,0.1)", borderColor: "rgba(166,227,161,0.3)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#a6e3a1" }}>✓ All tests passed!</p>
                  <p className="mt-0.5 text-xs" style={{ color: "#6c7086" }}>+{ex.xpReward} XP earned</p>
                </div>
              ) : (
                <button onClick={handleSubmit} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all" style={{ background: "#6366f1" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")} onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}>
                  Submit Solution
                </button>
              )}
              {(ex.attempts >= 3 || submitted) && ex.solution && (
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className="w-full rounded-xl border py-2.5 text-sm font-medium transition-all"
                  style={{ borderColor: "#313244", color: "#a6adc8" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#313244")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {showSolution ? "Hide Solution" : "View Solution"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const [moduleFilter, setModuleFilter] = useState<number | null>(null);
  const [diffFilter, setDiffFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate async exercise fetch
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const filtered = EXERCISES.filter((ex) => {
    if (moduleFilter !== null && ex.module !== moduleFilter) return false;
    if (diffFilter && ex.difficulty !== diffFilter) return false;
    if (statusFilter && ex.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6">
      {selectedEx && <ExerciseModal ex={selectedEx} onClose={() => setSelectedEx(null)} />}

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold" style={{ color: "#cdd6f4" }}>Exercises</h1>
        {isLoading && <span className="text-xs" style={{ color: "#6c7086" }}>Loading…</span>}
        <div className="flex-1" />

        <select
          value={moduleFilter ?? ""}
          onChange={(e) => setModuleFilter(e.target.value ? Number(e.target.value) : null)}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: "#181825", borderColor: "#313244", color: "#a6adc8" }}
        >
          <option value="">All Modules</option>
          {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>Module {n}</option>)}
        </select>

        <select
          value={diffFilter ?? ""}
          onChange={(e) => setDiffFilter(e.target.value || null)}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: "#181825", borderColor: "#313244", color: "#a6adc8" }}
        >
          <option value="">All Difficulties</option>
          {["Beginner", "Intermediate", "Advanced"].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={statusFilter ?? ""}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: "#181825", borderColor: "#313244", color: "#a6adc8" }}
        >
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Exercise grid */}
      {isLoading ? (
        <SkeletonExerciseGrid />
      ) : null}
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${isLoading ? "hidden" : ""}`}>
        {filtered.map((ex) => {
          const dc = DIFF_COLORS[ex.difficulty];
          return (
            <div
              key={ex.id}
              className="group relative flex flex-col rounded-2xl border p-5 transition-all cursor-pointer hover:border-indigo-500/40"
              style={{ background: "#181825", borderColor: "#313244" }}
              onClick={() => setSelectedEx(ex)}
            >
              {ex.status === "done" && (
                <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: "rgba(166,227,161,0.2)", color: "#a6e3a1" }}>✓</div>
              )}

              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  Module {ex.module}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={dc}>
                  {ex.difficulty}
                </span>
              </div>

              <h3 className="mb-1.5 text-sm font-semibold" style={{ color: "#cdd6f4" }}>{ex.title}</h3>
              <p className="mb-4 flex-1 text-xs leading-relaxed" style={{ color: "#6c7086" }}>
                {ex.description.slice(0, 90)}…
              </p>

              <div className="flex items-center justify-between">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(249,226,175,0.15)", color: "#f9e2af" }}>
                  ⚡ {ex.xpReward} XP
                </span>
                <button
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: ex.status === "done" ? "rgba(166,227,161,0.15)" : "#6366f1",
                    color: ex.status === "done" ? "#a6e3a1" : "white",
                  }}
                  onMouseEnter={(e) => { if (ex.status !== "done") (e.currentTarget.style.background = "#4f46e5"); }}
                  onMouseLeave={(e) => { if (ex.status !== "done") (e.currentTarget.style.background = "#6366f1"); }}
                >
                  {ex.status === "done" ? "Review" : ex.status === "in-progress" ? "Continue" : "Start"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-4xl">📝</span>
          <p style={{ color: "#6c7086" }}>No exercises match your filters</p>
        </div>
      )}
    </div>
  );
}
