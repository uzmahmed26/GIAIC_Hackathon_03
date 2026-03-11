"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getSession } from "@/src/lib/auth";
import { fetchProgress } from "@/src/lib/api";
import { MODULES, RECENT_ACTIVITY } from "@/src/lib/mock-data";
import { DashboardSkeleton } from "@/src/components/ui/Skeleton";

const currentModule = MODULES.find((m) => m.status === "in-progress") ?? MODULES[2];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  exercise: "📝",
  chat: "💬",
  code: "⚡",
  achievement: "🏆",
};

export default function DashboardPage() {
  const [firstName, setFirstName] = useState("Student");
  const [userStats, setUserStats] = useState({ streak: 7, xp: 2450, level: "Intermediate" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = getSession();
    if (user) {
      setFirstName(user.name.split(" ")[0]);
      setUserStats({ streak: user.streak, xp: user.xp, level: user.level });
    }
    fetchProgress(user?.id ?? "user-001")
      .catch(() => { /* fallback to mock data silently */ })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="p-4 space-y-4 md:p-6 md:space-y-6 max-w-6xl">
      {/* Welcome card */}
      <div
        className="rounded-2xl border p-4 md:p-6"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", borderColor: "rgba(99,102,241,0.3)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#cdd6f4" }}>
              {getGreeting()}, {firstName}! 👋
            </h1>
            <p className="mt-1 text-xs md:text-sm" style={{ color: "#a6adc8" }}>
              You&apos;re making great progress. Keep up the momentum!
            </p>
          </div>
          <div className="shrink-0 text-3xl md:text-4xl">🎓</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: "#6c7086" }}>
          <span>🔥 {userStats.streak}-day streak</span>
          <span>⚡ {userStats.xp.toLocaleString()} XP</span>
          <span>📊 {userStats.level}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        {[
          { label: "Total XP", value: userStats.xp.toLocaleString(), icon: "⚡", color: "#f9e2af", bg: "rgba(249,226,175,0.1)" },
          { label: "Streak", value: `${userStats.streak} days`, icon: "🔥", color: "#fab387", bg: "rgba(250,179,135,0.1)" },
          { label: "Exercises", value: "25", icon: "📝", color: "#a6e3a1", bg: "rgba(166,227,161,0.1)" },
          { label: "Level", value: userStats.level, icon: "🎖", color: "#89b4fa", bg: "rgba(137,180,250,0.1)" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border p-3 md:p-4 transition-all hover:border-indigo-500/40" style={{ background: "#181825", borderColor: "#313244" }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-base">{stat.icon}</span>
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold md:text-[10px] md:px-2" style={{ background: stat.bg, color: stat.color }}>
                {stat.label}
              </span>
            </div>
            <p className="text-base font-bold md:text-xl" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-3">
        {/* Continue Learning */}
        <div className="md:col-span-2 rounded-2xl border p-4 md:p-5" style={{ background: "#181825", borderColor: "#313244" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold md:text-base" style={{ color: "#cdd6f4" }}>Continue Learning</h2>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
              Module {currentModule.id}
            </span>
          </div>
          <h3 className="text-base font-bold mb-1 md:text-lg" style={{ color: "#cdd6f4" }}>{currentModule.name}</h3>
          <p className="text-xs mb-3 md:text-sm" style={{ color: "#6c7086" }}>
            {currentModule.exercisesDone} of {currentModule.totalExercises} exercises completed
          </p>
          <div className="mb-1 flex justify-between text-xs" style={{ color: "#6c7086" }}>
            <span>Progress</span>
            <span style={{ color: "#6366f1" }}>{currentModule.mastery}%</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full" style={{ background: "#313244" }}>
            <div className="h-full rounded-full progress-bar-fill" style={{ width: `${currentModule.mastery}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {currentModule.topics.map((t) => (
              <span key={t.name} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px]" style={{ background: "#1e1e2e", color: t.completed ? "#a6e3a1" : "#6c7086" }}>
                {t.completed ? "✓" : "○"} {t.name}
              </span>
            ))}
          </div>
          <Link
            href="/dashboard/exercises"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all"
            style={{ background: "#6366f1" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
          >
            Continue →
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border p-4 md:p-5" style={{ background: "#181825", borderColor: "#313244" }}>
          <h2 className="mb-3 text-sm font-semibold md:text-base md:mb-4" style={{ color: "#cdd6f4" }}>Recent Activity</h2>
          <div className="space-y-3">
            {RECENT_ACTIVITY.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-sm">{ACTIVITY_ICONS[activity.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs" style={{ color: "#cdd6f4" }}>{activity.description}</p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "#6c7086" }}>{timeAgo(activity.timestamp)}</span>
                    {activity.xpGained && (
                      <span className="text-[10px] font-semibold" style={{ color: "#f9e2af" }}>+{activity.xpGained} XP</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold md:text-base" style={{ color: "#cdd6f4" }}>Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { href: "/dashboard/chat", label: "Ask Tutor", icon: "💬", desc: "Get instant help", bg: "rgba(99,102,241,0.15)" },
            { href: "/dashboard/code", label: "Write Code", icon: "⚡", desc: "Open editor", bg: "rgba(166,227,161,0.1)" },
            { href: "/dashboard/exercises", label: "Take Quiz", icon: "🎯", desc: "Test skills", bg: "rgba(249,226,175,0.1)" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col gap-2 rounded-2xl border p-3 transition-all hover:border-indigo-500/40 md:p-4"
              style={{ background: "#181825", borderColor: "#313244" }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-lg md:h-10 md:w-10 md:text-xl" style={{ background: action.bg }}>
                {action.icon}
              </div>
              <div>
                <p className="text-xs font-semibold md:text-sm" style={{ color: "#cdd6f4" }}>{action.label}</p>
                <p className="hidden text-xs md:block" style={{ color: "#6c7086" }}>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
