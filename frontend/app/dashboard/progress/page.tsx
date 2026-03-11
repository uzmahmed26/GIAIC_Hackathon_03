"use client";
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, Tooltip,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { fetchProgress } from "@/src/lib/api";
import { SkeletonProgressPage } from "@/src/components/ui/Skeleton";
import {
  MODULES,
  ACHIEVEMENTS,
  MASTERY_OVER_TIME,
  EXERCISES_PER_MODULE,
  TIME_PER_TOPIC,
  DAILY_ACTIVITY,
} from "@/src/lib/mock-data";

const PIE_COLORS = ["#6366f1", "#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8", "#cba6f7"];

function HeatmapCell({ count }: { count: number }) {
  const opacity = count === 0 ? 0.08 : Math.min(1, 0.2 + count * 0.12);
  return (
    <div
      className="heatmap-cell"
      style={{ background: `rgba(99,102,241,${opacity})` }}
      title={`${count} activities`}
    />
  );
}

function ActivityHeatmap() {
  const weeks: typeof DAILY_ACTIVITY[] = [];
  for (let i = 0; i < DAILY_ACTIVITY.length; i += 7) {
    weeks.push(DAILY_ACTIVITY.slice(i, i + 7));
  }
  const days = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div>
      <div className="mb-2 flex gap-1 text-[10px]" style={{ color: "#6c7086" }}>
        {days.map((d, i) => (
          <div key={i} className="w-3 text-center">{d}</div>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <HeatmapCell key={di} count={day.count} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px]" style={{ color: "#6c7086" }}>
        <span>Less</span>
        {[0.08, 0.2, 0.44, 0.68, 0.92].map((o, i) => (
          <div key={i} className="heatmap-cell" style={{ background: `rgba(99,102,241,${o})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

const overallMastery = Math.round(MODULES.reduce((s, m) => s + m.mastery, 0) / MODULES.length);

export default function ProgressPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProgress("user-001")
      .catch(() => { /* silent fallback to mock */ })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <SkeletonProgressPage />;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Overall mastery */}
      <div className="flex gap-6">
        <div className="flex-1 rounded-2xl border p-6" style={{ background: "#181825", borderColor: "#313244" }}>
          <div className="flex items-center gap-6">
            {/* Circular progress */}
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="#313244" />
                <circle
                  cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                  stroke="#6366f1"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallMastery / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: "#cdd6f4" }}>{overallMastery}%</p>
                <p className="text-[10px]" style={{ color: "#6c7086" }}>Overall</p>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold mb-1" style={{ color: "#cdd6f4" }}>Your Progress</h1>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                  Intermediate
                </span>
              </div>
              <p className="text-sm" style={{ color: "#6c7086" }}>
                Completed {MODULES.filter((m) => m.status === "completed").length} of {MODULES.length} modules
              </p>
              {/* XP bar */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs" style={{ color: "#6c7086" }}>
                  <span>XP Progress</span>
                  <span style={{ color: "#f9e2af" }}>2,450 / 3,000 XP</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "#313244", width: "200px" }}>
                  <div className="h-full rounded-full" style={{ width: "82%", background: "linear-gradient(90deg, #f9e2af, #fab387)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total XP", value: "2,450", icon: "⚡", color: "#f9e2af" },
            { label: "Streak", value: "7 days", icon: "🔥", color: "#fab387" },
            { label: "Exercises", value: "25 done", icon: "📝", color: "#a6e3a1" },
            { label: "Achievements", value: "4 / 8", icon: "🏆", color: "#cba6f7" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border p-3" style={{ background: "#181825", borderColor: "#313244" }}>
              <span className="text-lg">{s.icon}</span>
              <p className="mt-1 text-base font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px]" style={{ color: "#6c7086" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly activity heatmap */}
      <div className="rounded-2xl border p-5" style={{ background: "#181825", borderColor: "#313244" }}>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#cdd6f4" }}>Activity Heatmap</h2>
        <ActivityHeatmap />
      </div>

      {/* Module progress grid */}
      <div>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#cdd6f4" }}>Module Progress</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const c = m.mastery >= 80 ? "#a6e3a1" : m.mastery >= 50 ? "#f9e2af" : "#f38ba8";
            const bg = m.mastery >= 80 ? "rgba(166,227,161,0.1)" : m.mastery >= 50 ? "rgba(249,226,175,0.1)" : "rgba(243,139,168,0.1)";
            return (
              <div key={m.id} className="rounded-2xl border p-4" style={{ background: "#181825", borderColor: "#313244" }}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold leading-tight" style={{ color: "#cdd6f4" }}>{m.name}</span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: bg, color: c }}>
                    {m.mastery}%
                  </span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#313244" }}>
                  <div className="h-full rounded-full progress-bar-fill" style={{ width: `${m.mastery}%`, background: c }} />
                </div>
                <div className="space-y-1">
                  {m.topics.slice(0, 3).map((t) => (
                    <div key={t.name} className="flex items-center gap-2 text-[11px]" style={{ color: t.completed ? "#a6adc8" : "#45475a" }}>
                      <span style={{ color: t.completed ? "#a6e3a1" : "#45475a" }}>{t.completed ? "●" : "○"}</span>
                      {t.name}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px]" style={{ color: "#6c7086" }}>
                  {m.exercisesDone}/{m.totalExercises} exercises
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Mastery over time */}
        <div className="md:col-span-2 rounded-2xl border p-5" style={{ background: "#181825", borderColor: "#313244" }}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: "#cdd6f4" }}>Mastery Over Time (30 days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MASTERY_OVER_TIME}>
              <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
              <XAxis dataKey="date" tick={{ fill: "#6c7086", fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fill: "#6c7086", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#181825", border: "1px solid #313244", borderRadius: "12px", color: "#cdd6f4", fontSize: "12px" }} />
              <Line type="monotone" dataKey="mastery" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time per topic donut */}
        <div className="rounded-2xl border p-5" style={{ background: "#181825", borderColor: "#313244" }}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: "#cdd6f4" }}>Time per Topic</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={TIME_PER_TOPIC} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {TIME_PER_TOPIC.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#181825", border: "1px solid #313244", borderRadius: "12px", color: "#cdd6f4", fontSize: "11px" }} formatter={(v) => [`${v}m`, "Minutes"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TIME_PER_TOPIC.map((t, i) => (
              <div key={t.name} className="flex items-center gap-1 text-[10px]" style={{ color: "#6c7086" }}>
                <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {t.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exercises per module bar chart */}
      <div className="rounded-2xl border p-5" style={{ background: "#181825", borderColor: "#313244" }}>
        <h2 className="mb-4 text-sm font-semibold" style={{ color: "#cdd6f4" }}>Exercises per Module</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={EXERCISES_PER_MODULE} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
            <XAxis dataKey="name" tick={{ fill: "#6c7086", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#6c7086", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#181825", border: "1px solid #313244", borderRadius: "12px", color: "#cdd6f4", fontSize: "11px" }} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "#6c7086" }} />
            <Bar dataKey="done" name="Completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total" name="Total" fill="#313244" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Achievements */}
      <div>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#cdd6f4" }}>Achievements</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all"
              style={{
                background: a.unlocked ? "rgba(99,102,241,0.08)" : "#181825",
                borderColor: a.unlocked ? "rgba(99,102,241,0.3)" : "#313244",
                opacity: a.unlocked ? 1 : 0.5,
              }}
            >
              <span className="text-3xl" style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>{a.icon}</span>
              <p className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>{a.title}</p>
              <p className="text-[11px]" style={{ color: "#6c7086" }}>{a.description}</p>
              {a.unlocked && a.unlockedAt && (
                <span className="text-[10px]" style={{ color: "#45475a" }} suppressHydrationWarning>
                  {a.unlockedAt.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              {!a.unlocked && (
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "#313244", color: "#45475a" }}>Locked</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
