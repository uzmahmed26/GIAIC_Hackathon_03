"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, logout, getAvatarInitials } from "@/src/lib/auth";
import { MODULES } from "@/src/lib/mock-data";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/chat", label: "Chat Tutor", icon: "💬" },
  { href: "/dashboard/code", label: "Code Editor", icon: "⚡" },
  { href: "/dashboard/exercises", label: "Exercises", icon: "📝" },
  { href: "/dashboard/progress", label: "Progress", icon: "📊" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

const currentModule = MODULES.find((m) => m.status === "in-progress") ?? MODULES[2];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getSession();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r"
      style={{ background: "#181825", borderColor: "#313244" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          🐍
        </div>
        <span className="text-base font-bold" style={{ color: "#cba6f7" }}>LearnFlow</span>
      </div>

      {/* User card */}
      {user && (
        <div className="mx-3 mb-4 rounded-xl border p-3" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              {getAvatarInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "#cdd6f4" }}>{user.name}</p>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: isActive ? "rgba(99,102,241,0.2)" : "transparent",
                color: isActive ? "#a5b4fc" : "#a6adc8",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 my-4 border-t" style={{ borderColor: "#313244" }} />

      {/* Current module progress */}
      <div className="px-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#6c7086" }}>
          Current Module
        </p>
        <div className="rounded-xl border p-3" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "#cdd6f4" }}>{currentModule.name}</span>
            <span className="text-xs font-bold" style={{ color: "#6366f1" }}>{currentModule.mastery}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#313244" }}>
            <div className="h-full rounded-full" style={{ width: `${currentModule.mastery}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "#6c7086" }}>
            {currentModule.exercisesDone}/{currentModule.totalExercises} exercises
          </p>
        </div>
      </div>

      {/* Streak counter */}
      <div className="mx-3 mt-3 rounded-xl border p-3" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <div>
            <p className="text-sm font-bold" style={{ color: "#f9e2af" }}>{user?.streak ?? 7}-day streak</p>
            <p className="text-[11px]" style={{ color: "#6c7086" }}>Keep it up!</p>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
          style={{ color: "#6c7086" }}
          onMouseEnter={(e) => { (e.currentTarget.style.color = "#f38ba8"); (e.currentTarget.style.background = "rgba(243,139,168,0.08)"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.color = "#6c7086"); (e.currentTarget.style.background = "transparent"); }}
        >
          <span>↩</span> Sign out
        </button>
      </div>
    </aside>
  );
}
