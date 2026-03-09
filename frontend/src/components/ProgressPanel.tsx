"use client";

interface Topic {
  label: string;
  done: boolean;
}

interface Module {
  number: number;
  name: string;
  mastery: number;
  topics: Topic[];
}

const MODULES: Module[] = [
  {
    number: 1,
    name: "Basics",
    mastery: 80,
    topics: [
      { label: "Variables",    done: true  },
      { label: "Data Types",   done: true  },
      { label: "Operators",    done: true  },
      { label: "Input/Output", done: false },
    ],
  },
  {
    number: 2,
    name: "Control Flow",
    mastery: 60,
    topics: [
      { label: "if / else",  done: true  },
      { label: "for loops",  done: true  },
      { label: "while",      done: false },
      { label: "break/continue", done: false },
    ],
  },
  {
    number: 3,
    name: "Data Structures",
    mastery: 35,
    topics: [
      { label: "Lists",       done: true  },
      { label: "Tuples",      done: false },
      { label: "Dicts",       done: false },
      { label: "Sets",        done: false },
    ],
  },
  {
    number: 4,
    name: "Functions",
    mastery: 20,
    topics: [
      { label: "Defining",     done: true  },
      { label: "Arguments",    done: false },
      { label: "Return vals",  done: false },
      { label: "Lambda",       done: false },
    ],
  },
  {
    number: 5,
    name: "OOP",
    mastery: 0,
    topics: [
      { label: "Classes",      done: false },
      { label: "Inheritance",  done: false },
      { label: "Dunder methods", done: false },
      { label: "Properties",   done: false },
    ],
  },
  {
    number: 6,
    name: "Files",
    mastery: 0,
    topics: [
      { label: "Reading",      done: false },
      { label: "Writing",      done: false },
      { label: "CSV / JSON",   done: false },
      { label: "Pathlib",      done: false },
    ],
  },
  {
    number: 7,
    name: "Errors",
    mastery: 0,
    topics: [
      { label: "Try / Except",  done: false },
      { label: "Raise",         done: false },
      { label: "Custom errors", done: false },
      { label: "Finally",       done: false },
    ],
  },
  {
    number: 8,
    name: "Libraries",
    mastery: 0,
    topics: [
      { label: "pip",           done: false },
      { label: "os / sys",      done: false },
      { label: "datetime",      done: false },
      { label: "requests",      done: false },
    ],
  },
];

// ── Colour helpers ────────────────────────────────────────────────────────────

function masteryColor(m: number) {
  if (m === 0)   return "#585b70";           // unstarted – muted
  if (m <= 40)   return "#f38ba8";           // red
  if (m <= 70)   return "#f9e2af";           // yellow
  if (m <= 90)   return "#a6e3a1";           // green
  return "#89b4fa";                           // blue
}

function masteryBg(m: number) {
  if (m === 0)   return "rgba(88,91,112,0.15)";
  if (m <= 40)   return "rgba(243,139,168,0.12)";
  if (m <= 70)   return "rgba(249,226,175,0.12)";
  if (m <= 90)   return "rgba(166,227,161,0.12)";
  return "rgba(137,180,250,0.12)";
}

function masteryLabel(m: number) {
  if (m === 0)   return "Not started";
  if (m <= 40)   return "Beginner";
  if (m <= 70)   return "Developing";
  if (m <= 90)   return "Proficient";
  return "Mastered";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ mastery }: { mastery: number }) {
  const color = masteryColor(mastery);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "#313244" }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${mastery}%`, backgroundColor: color }}
      />
    </div>
  );
}

function TopicChip({ topic }: { topic: Topic }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: topic.done ? "rgba(166,227,161,0.12)" : "#1e1e2e",
        color:           topic.done ? "#a6e3a1"                 : "#585b70",
        border:          topic.done ? "1px solid rgba(166,227,161,0.25)" : "1px solid #313244",
      }}
    >
      {topic.done ? "✓ " : ""}{topic.label}
    </span>
  );
}

function ModuleCard({ mod }: { mod: Module }) {
  const color = masteryColor(mod.mastery);
  const bg    = masteryBg(mod.mastery);
  const label = masteryLabel(mod.mastery);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ backgroundColor: "#181825", border: "1px solid #313244" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
            style={{ backgroundColor: "#313244", color: "#a6adc8" }}
          >
            {mod.number}
          </span>
          <span className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>
            {mod.name}
          </span>
        </div>

        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: bg, color }}
        >
          {label}
        </span>
      </div>

      {/* Mastery % + bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: "#7c7f93" }}>Mastery</span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
            {mod.mastery}%
          </span>
        </div>
        <ProgressBar mastery={mod.mastery} />
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap gap-1.5">
        {mod.topics.map((t) => (
          <TopicChip key={t.label} topic={t} />
        ))}
      </div>
    </div>
  );
}

// ── Stats card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl px-4 py-3"
      style={{ backgroundColor: "#181825", border: "1px solid #313244" }}
    >
      <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#585b70" }}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums" style={{ color: accent ?? "#cdd6f4" }}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgressPanel() {
  const masteries     = MODULES.map((m) => m.mastery);
  const avg           = Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length);
  const started       = masteries.filter((m) => m > 0).length;
  const mastered      = masteries.filter((m) => m > 90).length;
  const inProgress    = masteries.filter((m) => m > 0 && m <= 90).length;
  const streakDays    = 4; // mock

  return (
    <div className="h-full overflow-y-auto px-6 py-6" style={{ backgroundColor: "#1e1e2e" }}>
      <div className="mx-auto max-w-4xl space-y-6">

        {/* ── Overall score card ── */}
        <div
          className="flex flex-col gap-3 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: "#181825", border: "1px solid #313244" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
              Overall mastery
            </p>
            <div className="mt-1 flex items-end gap-3">
              <span
                className="text-5xl font-extrabold tabular-nums leading-none"
                style={{ color: masteryColor(avg) }}
              >
                {avg}%
              </span>
              <span
                className="mb-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: masteryBg(avg), color: masteryColor(avg) }}
              >
                {masteryLabel(avg)}
              </span>
            </div>
            <div className="mt-3 w-64">
              <ProgressBar mastery={avg} />
            </div>
          </div>

          <div className="text-sm" style={{ color: "#6c7086" }}>
            <p>🐍 Python Curriculum</p>
            <p className="mt-0.5">{started} of {MODULES.length} modules started</p>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Modules Started"  value={started}     accent="#cba6f7" />
          <StatCard label="Mastered"         value={mastered}    accent="#a6e3a1" />
          <StatCard label="In Progress"      value={inProgress}  accent="#f9e2af" />
          <StatCard label="Streak"           value={`${streakDays}d`} accent="#fab387" />
        </div>

        {/* ── Module grid ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
            Curriculum modules
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MODULES.map((mod) => (
              <ModuleCard key={mod.number} mod={mod} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
