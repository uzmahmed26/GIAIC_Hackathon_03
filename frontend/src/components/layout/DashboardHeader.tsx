"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, logout, getAvatarInitials } from "@/src/lib/auth";

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/dashboard": ["Dashboard"],
  "/dashboard/chat": ["Dashboard", "Chat Tutor"],
  "/dashboard/code": ["Dashboard", "Code Editor"],
  "/dashboard/exercises": ["Dashboard", "Exercises"],
  "/dashboard/progress": ["Dashboard", "Progress"],
  "/dashboard/settings": ["Dashboard", "Settings"],
};

const NOTIFICATIONS = [
  { id: 1, text: "New exercise available in Module 3", time: "2m ago", read: false },
  { id: 2, text: "You earned 'Week Warrior' badge!", time: "1h ago", read: false },
  { id: 3, text: "Sofia Garcia overtook you in XP", time: "3h ago", read: true },
];

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getSession();
  const [dark, setDark] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unread, setUnread] = useState(NOTIFICATIONS.filter((n) => !n.read).length);

  const breadcrumbs = BREADCRUMB_MAP[pathname] ?? ["Dashboard"];

  useEffect(() => {
    function close() { setShowNotifications(false); setShowUserMenu(false); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-6"
      style={{ background: "#181825", borderColor: "#313244" }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-2">
            {i > 0 && <span style={{ color: "#45475a" }}>/</span>}
            <span style={{ color: i === breadcrumbs.length - 1 ? "#cdd6f4" : "#6c7086" }}>{crumb}</span>
          </span>
        ))}
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Dark/Light toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all"
          style={{ color: "#6c7086" }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = "#313244"); (e.currentTarget.style.color = "#cdd6f4"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); (e.currentTarget.style.color = "#6c7086"); }}
          title="Toggle theme"
        >
          {dark ? "☀" : "🌙"}
        </button>

        {/* Notifications */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all"
            style={{ color: "#6c7086" }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = "#313244"); (e.currentTarget.style.color = "#cdd6f4"); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); (e.currentTarget.style.color = "#6c7086"); }}
          >
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#f38ba8" }}>
                {unread}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border shadow-2xl animate-fade-in" style={{ background: "#181825", borderColor: "#313244" }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#313244" }}>
                <span className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>Notifications</span>
                <button onClick={() => setUnread(0)} className="text-xs" style={{ color: "#6366f1" }}>Mark all read</button>
              </div>
              {NOTIFICATIONS.map((n) => (
                <div key={n.id} className="flex gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: "#313244", background: n.read ? "transparent" : "rgba(99,102,241,0.05)" }}>
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.read ? "#45475a" : "#6366f1" }} />
                  <div>
                    <p className="text-xs" style={{ color: "#cdd6f4" }}>{n.text}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "#6c7086" }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            {user ? getAvatarInitials(user.name) : "?"}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-10 z-50 w-48 rounded-2xl border shadow-2xl animate-fade-in" style={{ background: "#181825", borderColor: "#313244" }}>
              <div className="border-b px-4 py-3" style={{ borderColor: "#313244" }}>
                <p className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>{user?.name}</p>
                <p className="text-xs" style={{ color: "#6c7086" }}>{user?.email}</p>
              </div>
              {[
                { label: "Profile", href: "/dashboard/settings" },
                { label: "Settings", href: "/dashboard/settings" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block px-4 py-2.5 text-sm transition-all"
                  style={{ color: "#a6adc8" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#313244")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t" style={{ borderColor: "#313244" }}>
                <button
                  onClick={() => { logout(); router.push("/login"); }}
                  className="flex w-full items-center px-4 py-2.5 text-sm transition-all"
                  style={{ color: "#f38ba8" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(243,139,168,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
