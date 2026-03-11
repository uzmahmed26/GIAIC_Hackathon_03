"use client";
import { useState, useEffect } from "react";
import { getSession, getAvatarInitials } from "@/src/lib/auth"; // getAvatarInitials used in useEffect

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarInitials, setAvatarInitials] = useState("?");

  useEffect(() => {
    const user = getSession();
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setAvatarInitials(getAvatarInitials(user.name));
    }
  }, []);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputStyle = { background: "#313244", color: "#cdd6f4", border: "1px solid #45475a" };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "#cdd6f4" }}>Settings</h1>

      {/* Profile */}
      <div className="rounded-2xl border p-6" style={{ background: "#181825", borderColor: "#313244" }}>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#cdd6f4" }}>Profile</h2>
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {avatarInitials}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#cdd6f4" }}>{name}</p>
            <p className="text-xs" style={{ color: "#6c7086" }}>student</p>
          </div>
        </div>
        <div className="space-y-4">
          {[{ label: "Full name", value: name, setter: setName, type: "text" }, { label: "Email", value: email, setter: setEmail, type: "email" }].map(({ label, value, setter, type }) => (
            <div key={label}>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#45475a")}
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
            style={{ background: saved ? "#a6e3a1" : "#6366f1", color: saved ? "#1e1e2e" : "white" }}
          >
            {saved ? "✓ Saved!" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border p-6" style={{ background: "#181825", borderColor: "#313244" }}>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#cdd6f4" }}>Preferences</h2>
        <div className="space-y-4">
          {[
            { label: "Email notifications", desc: "Get notified about new exercises and achievements" },
            { label: "Daily streak reminders", desc: "Daily reminder to maintain your streak" },
            { label: "Leaderboard visibility", desc: "Show your progress to other students" },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#cdd6f4" }}>{pref.label}</p>
                <p className="text-xs" style={{ color: "#6c7086" }}>{pref.desc}</p>
              </div>
              <button
                className="relative h-6 w-11 rounded-full transition-all"
                style={{ background: "#6366f1" }}
              >
                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-all" style={{ transform: "translateX(20px)" }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
