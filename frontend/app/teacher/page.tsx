"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/src/lib/auth";
import { STUDENTS, STRUGGLE_ALERTS, MODULES } from "@/src/lib/mock-data";
import type { Student } from "@/src/lib/types";

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_STYLE: Record<Student["status"], { color: string; bg: string; label: string }> = {
  "on-track": { color: "#a6e3a1", bg: "rgba(166,227,161,0.15)", label: "On Track" },
  struggling: { color: "#f38ba8", bg: "rgba(243,139,168,0.15)", label: "Struggling" },
  inactive: { color: "#6c7086", bg: "rgba(108,112,134,0.15)", label: "Inactive" },
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "#f38ba8",
  medium: "#f9e2af",
  low: "#89b4fa",
};

export default function TeacherPage() {
  const router = useRouter();
  const user = getSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "mastery" | "lastActive">("mastery");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genDiff, setGenDiff] = useState("Intermediate");
  const [genModule, setGenModule] = useState("3");
  const [genCount, setGenCount] = useState("3");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      router.replace("/login");
    }
  }, [user, router]);

  const filtered = STUDENTS
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "mastery") return b.mastery - a.mastery;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return b.lastActive.getTime() - a.lastActive.getTime();
    });

  const avgMastery = Math.round(STUDENTS.reduce((s, st) => s + st.mastery, 0) / STUDENTS.length);
  const activeToday = STUDENTS.filter((s) => Date.now() - s.lastActive.getTime() < 86400000).length;
  const struggling = STUDENTS.filter((s) => s.status === "struggling").length;

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 1500);
  }

  return (
    <div className="min-h-screen" style={{ background: "#1e1e2e" }}>
      {/* Generate modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerated(false); } }}>
          <div className="w-full max-w-md rounded-2xl border p-6 animate-fade-in" style={{ background: "#181825", borderColor: "#313244" }}>
            <h2 className="mb-4 text-lg font-bold" style={{ color: "#cdd6f4" }}>Generate Exercise</h2>
            {generated ? (
              <div className="text-center py-6">
                <span className="text-4xl">✅</span>
                <p className="mt-3 text-base font-semibold" style={{ color: "#a6e3a1" }}>Exercises generated!</p>
                <p className="mt-1 text-sm" style={{ color: "#6c7086" }}>{genCount} new exercises created for Module {genModule}</p>
                <button onClick={() => { setShowGenerateModal(false); setGenerated(false); }} className="mt-4 rounded-xl px-6 py-2 text-sm font-semibold text-white" style={{ background: "#6366f1" }}>Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Topic</label>
                  <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="e.g. recursion, list comprehensions" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: "#1e1e2e", color: "#cdd6f4", border: "1px solid #313244" }} onFocus={(e) => (e.target.style.borderColor = "#6366f1")} onBlur={(e) => (e.target.style.borderColor = "#313244")} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: "#a6adc8" }}>Difficulty</label>
                    <select value={genDiff} onChange={(e) => setGenDiff(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-xs outline-none" style={{ background: "#1e1e2e", borderColor: "#313244", color: "#cdd6f4" }}>
                      {["Beginner", "Intermediate", "Advanced"].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: "#a6adc8" }}>Module</label>
                    <select value={genModule} onChange={(e) => setGenModule(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-xs outline-none" style={{ background: "#1e1e2e", borderColor: "#313244", color: "#cdd6f4" }}>
                      {MODULES.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: "#a6adc8" }}>Quantity</label>
                    <input type="number" min={1} max={10} value={genCount} onChange={(e) => setGenCount(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-xs outline-none" style={{ background: "#1e1e2e", borderColor: "#313244", color: "#cdd6f4" }} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowGenerateModal(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all" style={{ borderColor: "#313244", color: "#a6adc8" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#313244")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Cancel</button>
                  <button onClick={handleGenerate} disabled={generating || !genTopic} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50" style={{ background: "#6366f1" }} onMouseEnter={(e) => { if (!generating && genTopic) (e.currentTarget.style.background = "#4f46e5"); }} onMouseLeave={(e) => { (e.currentTarget.style.background = "#6366f1"); }}>
                    {generating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    {generating ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-6" style={{ background: "#181825", borderColor: "#313244" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>🐍</div>
          <span className="text-base font-bold" style={{ color: "#cba6f7" }}>LearnFlow</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Teacher Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowGenerateModal(true)} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all" style={{ background: "#6366f1" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")} onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}>
            ✨ Generate Exercise
          </button>
          <span className="text-sm font-medium" style={{ color: "#a6adc8" }}>{user?.name}</span>
          <button onClick={() => { logout(); router.push("/login"); }} className="text-xs transition-all" style={{ color: "#6c7086" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#f38ba8")} onMouseLeave={(e) => (e.currentTarget.style.color = "#6c7086")}>Sign out</button>
        </div>
      </header>

      <div className="flex gap-6 p-6">
        {/* Main column */}
        <div className="flex-1 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Students", value: STUDENTS.length, icon: "👥", color: "#89b4fa", bg: "rgba(137,180,250,0.1)" },
              { label: "Avg Mastery", value: `${avgMastery}%`, icon: "📊", color: "#a6e3a1", bg: "rgba(166,227,161,0.1)" },
              { label: "Active Today", value: activeToday, icon: "⚡", color: "#f9e2af", bg: "rgba(249,226,175,0.1)" },
              { label: "Struggling", value: struggling, icon: "⚠", color: "#f38ba8", bg: "rgba(243,139,168,0.1)" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border p-4" style={{ background: "#181825", borderColor: "#313244" }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg">{s.icon}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "#6c7086" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Students table */}
          <div className="rounded-2xl border" style={{ background: "#181825", borderColor: "#313244" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "#313244" }}>
              <h2 className="text-base font-semibold" style={{ color: "#cdd6f4" }}>Students</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
                  <span className="text-xs" style={{ color: "#6c7086" }}>🔍</span>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search students…" className="bg-transparent text-xs outline-none" style={{ color: "#cdd6f4", width: "140px" }} />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-xl border px-2 py-1.5 text-xs outline-none" style={{ background: "#1e1e2e", borderColor: "#313244", color: "#a6adc8" }}>
                  <option value="mastery">Sort: Mastery</option>
                  <option value="name">Sort: Name</option>
                  <option value="lastActive">Sort: Last Active</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#313244" }}>
                    {["Student", "Module", "Mastery", "Streak", "Last Active", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#6c7086" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const st = STATUS_STYLE[s.status];
                    return (
                      <tr key={s.id} className="border-b transition-all" style={{ borderColor: "#313244" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                              {s.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: "#cdd6f4" }}>{s.name}</p>
                              <p className="text-xs" style={{ color: "#6c7086" }}>{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Module {s.module}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "#313244" }}>
                              <div className="h-full rounded-full" style={{ width: `${s.mastery}%`, background: s.mastery >= 70 ? "#a6e3a1" : s.mastery >= 40 ? "#f9e2af" : "#f38ba8" }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color: "#cdd6f4" }}>{s.mastery}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: s.streak > 0 ? "#fab387" : "#45475a" }}>
                          {s.streak > 0 ? `🔥 ${s.streak}d` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6c7086" }}>{timeAgo(s.lastActive)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={st}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs transition-all" style={{ color: "#6366f1" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#6366f1")}>View →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right panel — struggle alerts */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="rounded-2xl border" style={{ background: "#181825", borderColor: "#313244" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "#313244" }}>
              <h2 className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>Struggle Alerts</h2>
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#f38ba8", color: "#1e1e2e" }}>
                {STRUGGLE_ALERTS.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {STRUGGLE_ALERTS.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border p-3 animate-slide-in"
                  style={{ background: "#1e1e2e", borderColor: `${SEVERITY_COLORS[alert.severity]}33` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold" style={{ color: "#cdd6f4" }}>{alert.studentName}</p>
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold capitalize" style={{ background: `${SEVERITY_COLORS[alert.severity]}22`, color: SEVERITY_COLORS[alert.severity] }}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "#6c7086" }}>{alert.issue}</p>
                  <p className="mt-1.5 text-[10px]" style={{ color: "#45475a" }}>{timeAgo(alert.timestamp)}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.25)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.15)")}>Message</button>
                    <button className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all" style={{ background: "rgba(166,227,161,0.1)", color: "#a6e3a1" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(166,227,161,0.2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(166,227,161,0.1)")}>Assign Help</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class overview */}
          <div className="rounded-2xl border p-4" style={{ background: "#181825", borderColor: "#313244" }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "#cdd6f4" }}>Module Distribution</h2>
            {[1, 2, 3, 4, 5].map((mod) => {
              const count = STUDENTS.filter((s) => s.module === mod).length;
              return (
                <div key={mod} className="mb-2">
                  <div className="mb-1 flex justify-between text-[11px]" style={{ color: "#6c7086" }}>
                    <span>Module {mod}</span>
                    <span>{count} students</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#313244" }}>
                    <div className="h-full rounded-full" style={{ width: `${(count / STUDENTS.length) * 100}%`, background: "#6366f1" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
