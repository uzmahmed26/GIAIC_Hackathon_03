"use client";

type Tab = "Tutor Chat" | "Code Editor" | "Progress";

interface Module {
  name: string;
  mastery: number; // 0–100
}

const MODULES: Module[] = [
  { name: "Variables & Types",      mastery: 95 },
  { name: "Control Flow",           mastery: 82 },
  { name: "Functions",              mastery: 67 },
  { name: "Lists & Dicts",          mastery: 55 },
  { name: "OOP Basics",             mastery: 38 },
  { name: "File I/O",               mastery: 20 },
  { name: "Error Handling",         mastery: 10 },
  { name: "Modules & Packages",     mastery: 0  },
];

const TABS: { label: Tab; icon: string }[] = [
  { label: "Tutor Chat",   icon: "💬" },
  { label: "Code Editor",  icon: "⚡" },
  { label: "Progress",     icon: "📊" },
];

function masteryColor(mastery: number): string {
  if (mastery <= 40) return "#f38ba8"; // red
  if (mastery <= 70) return "#f9e2af"; // yellow
  if (mastery <= 90) return "#a6e3a1"; // green
  return "#89b4fa";                    // blue
}

function masteryBg(mastery: number): string {
  if (mastery <= 40) return "rgba(243,139,168,0.15)";
  if (mastery <= 70) return "rgba(249,226,175,0.15)";
  if (mastery <= 90) return "rgba(166,227,161,0.15)";
  return "rgba(137,180,250,0.15)";
}

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r"
      style={{ backgroundColor: "#181825", borderColor: "#313244" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 text-base font-semibold tracking-tight" style={{ color: "#cba6f7" }}>
        LearnFlow
      </div>

      {/* Navigation tabs */}
      <nav className="flex flex-col gap-1 px-2">
        {TABS.map(({ label, icon }) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              onClick={() => onTabChange(label)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? "rgba(99,102,241,0.2)" : "transparent",
                color: isActive ? "#c6c8f5" : "#a6adc8",
              }}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 my-4 border-t" style={{ borderColor: "#313244" }} />

      {/* Curriculum section */}
      <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
          Curriculum
        </p>

        {MODULES.map((mod) => {
          const color = masteryColor(mod.mastery);
          const bg = masteryBg(mod.mastery);
          return (
            <div key={mod.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs" style={{ color: "#a6adc8" }}>
                  {mod.name}
                </span>
                <span
                  className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ color, backgroundColor: bg }}
                >
                  {mod.mastery}%
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "#313244" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${mod.mastery}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
